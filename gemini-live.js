/* =============================================
   TALK TO ME — Gemini Live API client
   gemini-live.js
   Real-time bidirectional voice via Gemini Live API.
   Vanilla JS, no build step. Exposes window.GeminiLiveClient.
   ============================================= */

'use strict';

// NOTE: Google renames Live models periodically. If connecting fails,
// the FIRST thing to check is whether this model name is still valid at
// https://ai.google.dev/gemini-api/docs/live-api — do not assume an old
// name (from training data or another project) still works. Previous
// names like 'gemini-2.0-flash-live-001' and 'gemini-live-2.5-flash-preview'
// have already been discontinued.
const GEMINI_LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';

const GEMINI_WS_OWN = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const GEMINI_WS_DEVELOPER = (token) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;

const MIC_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 22050;

class GeminiLiveClient {
  constructor(opts = {}) {
    this.mode = opts.mode; // 'own' | 'developer'
    this.apiKey = opts.apiKey || null;
    this.systemInstruction = opts.systemInstruction || 'You are a friendly English speaking tutor.';
    this.tokenEndpoint = opts.tokenEndpoint || '/api/gemini-token';

    this.onStatus = opts.onStatus || (() => {});
    this.onUserText = opts.onUserText || (() => {});
    this.onModelText = opts.onModelText || (() => {});
    this.onError = opts.onError || (() => {});
    this.onClose = opts.onClose || (() => {});

    this.ws = null;
    this.setupDone = false;

    // mic capture
    this.micStream = null;
    this.inputAudioCtx = null;
    this.inputSourceNode = null;
    this.inputProcessorNode = null;
    this.micActive = false;

    // playback
    this.outputAudioCtx = null;
    this.nextStartTime = 0;
    this.activeSources = [];
  }

  async connect() {
    this.onStatus('connecting');
    let wsUrl;

    if (this.mode === 'own') {
      if (!this.apiKey) throw new Error('Missing Gemini API key.');
      wsUrl = GEMINI_WS_OWN(this.apiKey);
    } else if (this.mode === 'developer') {
      const token = await this._fetchEphemeralToken();
      wsUrl = GEMINI_WS_DEVELOPER(token);
    } else {
      throw new Error(`Unknown GeminiLiveClient mode: "${this.mode}"`);
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._sendSetup();
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = await this._parseMessage(event.data);
          this._handleServerMessage(msg, () => {
            if (!settled) { settled = true; resolve(); }
          });
        } catch (err) {
          this.onError(err instanceof Error ? err : new Error(String(err)));
        }
      };

      this.ws.onerror = () => {
        // The WebSocket 'error' event carries no useful detail; the real
        // reason always shows up in onclose (code/reason) right after.
      };

      this.ws.onclose = (event) => {
        const wasSettled = settled;
        settled = true;
        this.setupDone = false;
        this.onStatus('idle');
        this.onClose(event.code, event.reason);
        if (!wasSettled) {
          reject(new Error(
            event.reason
              ? `Connection closed (${event.code}): ${event.reason}`
              : `Connection closed unexpectedly (code ${event.code}). If this just started happening, check whether "${GEMINI_LIVE_MODEL}" is still the current model name at https://ai.google.dev/gemini-api/docs/live-api`
          ));
        }
      };
    });
  }

  async _fetchEphemeralToken() {
    let res;
    try {
      res = await fetch(this.tokenEndpoint, { method: 'POST' });
    } catch (err) {
      throw new Error(`Could not reach ${this.tokenEndpoint}: ${err.message}`);
    }
    let body;
    try {
      body = await res.json();
    } catch (err) {
      throw new Error(`Server returned a non-JSON response (status ${res.status}) from ${this.tokenEndpoint}.`);
    }
    if (!res.ok) {
      throw new Error(body?.error || `Token request failed with status ${res.status}.`);
    }
    if (!body?.token) {
      throw new Error('Token endpoint responded without a token.');
    }
    return body.token;
  }

  async _parseMessage(data) {
    let text;
    if (data instanceof Blob) {
      text = await data.text();
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder().decode(data);
    } else {
      text = data;
    }
    return JSON.parse(text);
  }

  _sendSetup() {
    const setupMsg = {
      setup: {
        model: GEMINI_LIVE_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
        },
        systemInstruction: {
          parts: [{ text: this.systemInstruction }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    };
    this.ws.send(JSON.stringify(setupMsg));
  }

  _handleServerMessage(msg, onReady) {
    if (msg.error) {
      throw new Error(msg.error.message || JSON.stringify(msg.error));
    }

    if (msg.setupComplete) {
      this.setupDone = true;
      this.onStatus('ready');
      onReady();
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.interrupted) {
        this._clearPlaybackQueue();
      }

      if (sc.inputTranscription?.text) {
        this.onUserText(sc.inputTranscription.text, !!sc.inputTranscription.finished);
      }

      if (sc.outputTranscription?.text) {
        this.onModelText(sc.outputTranscription.text, !!sc.outputTranscription.finished);
      }

      const parts = sc.modelTurn?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
          this._playAudioChunk(part.inlineData.data);
        }
      }

      if (sc.turnComplete) {
        this.onStatus('ready');
      }
      return;
    }
  }

  // ---------- Microphone capture (16kHz PCM16, mono) ----------
  async startMic() {
    if (this.micActive) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.setupDone) {
      throw new Error('Cannot start the microphone before the session is ready.');
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    this.inputAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.inputSourceNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);

    const bufferSize = 4096;
    this.inputProcessorNode = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

    const nativeRate = this.inputAudioCtx.sampleRate;

    this.inputProcessorNode.onaudioprocess = (e) => {
      if (!this.micActive) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const downsampled = this._downsampleTo16k(inputData, nativeRate);
      const pcm16 = this._floatTo16BitPCM(downsampled);
      const base64 = this._arrayBufferToBase64(pcm16.buffer);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}` },
          },
        }));
      }
    };

    this.inputSourceNode.connect(this.inputProcessorNode);
    this.inputProcessorNode.connect(this.inputAudioCtx.destination);

    this.micActive = true;
    this.onStatus('listening');
  }

  stopMic() {
    this.micActive = false;
    if (this.inputProcessorNode) {
      try { this.inputProcessorNode.disconnect(); } catch (e) {}
      this.inputProcessorNode.onaudioprocess = null;
      this.inputProcessorNode = null;
    }
    if (this.inputSourceNode) {
      try { this.inputSourceNode.disconnect(); } catch (e) {}
      this.inputSourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.onStatus('ready');
    }
  }

  _downsampleTo16k(float32Array, inputSampleRate) {
    if (inputSampleRate === MIC_SAMPLE_RATE) return float32Array;
    const ratio = inputSampleRate / MIC_SAMPLE_RATE;
    const newLength = Math.round(float32Array.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      result[i] = float32Array[srcIndex];
    }
    return result;
  }

  _floatTo16BitPCM(float32Array) {
    const out = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  // ---------- Playback (24kHz PCM16 -> Float32, streamed) ----------
  _playAudioChunk(base64Data) {
    if (!this.outputAudioCtx) {
      this.outputAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: PLAYBACK_SAMPLE_RATE });
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioCtx.destination);

    const startAt = Math.max(this.outputAudioCtx.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.onStatus('speaking');
    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
      if (this.activeSources.length === 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.onStatus(this.micActive ? 'listening' : 'ready');
      }
    };
  }

  _clearPlaybackQueue() {
    this.activeSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.activeSources = [];
    if (this.outputAudioCtx) this.nextStartTime = this.outputAudioCtx.currentTime;
  }

  disconnect() {
    this.stopMic();
    this._clearPlaybackQueue();
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, 'Client ended session'); } catch (e) {}
      this.ws = null;
    }
    this.setupDone = false;
  }
}

window.GeminiLiveClient = GeminiLiveClient;
