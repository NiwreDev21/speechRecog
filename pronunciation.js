/* =============================================
   TALK TO ME — English Learning App
   pronunciation.js — Modo Pronunciacion
   Comparacion de la voz del usuario contra un texto de referencia, con
   scoring palabra por palabra. Independiente de Dictado.
   ============================================= */

'use strict';

// ============ PRONUNCIATION ============
let recognition = null;
let pronunNativeBlob = null;
let pronunFinalText = '';
let pronunTextVisible = false; // tracks Show/Hide state for the whole session on the current card

function setPronunShowBtnLabel(visible) {
  const btn = document.getElementById('pronun-show-btn');
  if (!btn) return;
  if (visible) {
    btn.innerHTML = '<span class="msi">visibility_off</span> Hide Text';
  } else {
    btn.innerHTML = '<span class="msi">visibility</span> Show Text';
  }
}

async function populatePronunSelect() {
  const sel = document.getElementById('pronun-phrase-select');
  sel.innerHTML = '<option value="">— Select card —</option>';
  for (const p of state.phrases) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.title || p.text?.slice(0, 40) || 'Untitled';
    sel.appendChild(opt);
  }
  if (state.pronun.phraseId) {
    sel.value = state.pronun.phraseId;
    loadPronunPhrase(state.pronun.phraseId);
  }
}

async function loadPronunPhrase(phraseId) {
  state.pronun.phraseId = phraseId;
  const phrase = state.phrases.find(p => p.id === phraseId);
  if (!phrase) return;

  const textEl = document.getElementById('recog-text-display');
  textEl.textContent = phrase.text || '';
  pronunTextVisible = false;
  textEl.classList.add('blurred');
  setPronunShowBtnLabel(false);
  document.getElementById('pronun-show-btn').style.display = '';
  document.getElementById('pronun-start-btn').disabled = false;

  resetPronunResults();

  pronunNativeBlob = null;
  const audioWrap = document.getElementById('pronun-audio-wrap');
  const uploadRow = document.getElementById('pronun-audio-upload');
  audioWrap.innerHTML = '';
  const rec = await getAudioRecord(phraseId, 'original');
  if (rec) {
    pronunNativeBlob = rec.blob;
    const player = createAudioPlayer(rec.blob, { showLoop: false });
    audioWrap.appendChild(player.el);
    uploadRow.classList.add('hidden');
  } else {
    uploadRow.classList.remove('hidden');
  }
}

function resetPronunResults() {
  document.getElementById('pronun-live-wrap').classList.add('hidden');
  document.getElementById('pronun-analyzing').classList.add('hidden');
  document.getElementById('pronun-results').classList.add('hidden');
  document.getElementById('pronun-start-btn').classList.remove('hidden');
  document.getElementById('pronun-cta-label').classList.remove('hidden');
  document.getElementById('pronun-stop-btn').classList.add('hidden');
  document.getElementById('listening-state').classList.add('hidden');
  document.querySelector('.pronun-mic-stage')?.classList.remove('active');
}

document.getElementById('pronun-audio-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  const phraseId = state.pronun.phraseId;
  if (!file || !phraseId) return;
  await saveAudioBlob(phraseId, 'original', file, 'reference');
  pronunNativeBlob = file;
  const audioWrap = document.getElementById('pronun-audio-wrap');
  audioWrap.innerHTML = '';
  const player = createAudioPlayer(file, { showLoop: false });
  audioWrap.appendChild(player.el);
  document.getElementById('pronun-audio-upload').classList.add('hidden');
  toast('Reference audio saved', 'success');
});

async function startPronun() {
  const phraseId = state.pronun.phraseId;
  if (!phraseId) { toast('Select a card', 'error'); return; }

  const phrase = state.phrases.find(p => p.id === phraseId);
  if (!phrase || !phrase.text) { toast('This card has no text', 'error'); return; }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Your browser does not support speech recognition. Use Chrome.', 'error');
    return;
  }

  resetPronunResults();
  pronunFinalText = '';

  document.getElementById('listening-state').classList.remove('hidden');
  document.getElementById('pronun-start-btn').classList.add('hidden');
  document.getElementById('pronun-cta-label').classList.add('hidden');
  document.getElementById('pronun-stop-btn').classList.remove('hidden');
  document.querySelector('.pronun-mic-stage')?.classList.add('active');

  const liveWrap = document.getElementById('pronun-live-wrap');
  const liveFinalEl = document.getElementById('pronun-live-text');
  const liveInterimEl = document.getElementById('pronun-live-interim');
  liveFinalEl.textContent = '';
  liveInterimEl.textContent = '';
  liveWrap.classList.remove('hidden');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = e => {
    let finalTextR = '';
    let interimText = '';
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTextR += transcript + ' ';
      else interimText += transcript;
    }
    pronunFinalText = finalTextR.trim();
    liveFinalEl.textContent = pronunFinalText;
    liveInterimEl.textContent = interimText;
  };

  recognition.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast('Recognition error: ' + e.error, 'error');
    }
  };

  recognition.start();
  state.pronun.listening = true;
}

function stopPronun() {
  state.pronun.listening = false;
  document.getElementById('listening-state').classList.add('hidden');
  document.getElementById('pronun-start-btn').classList.remove('hidden');
  document.getElementById('pronun-cta-label').classList.remove('hidden');
  document.getElementById('pronun-stop-btn').classList.add('hidden');
  document.querySelector('.pronun-mic-stage')?.classList.remove('active');

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }

  if (!state.pronun.phraseId) return;

  document.getElementById('pronun-live-wrap').classList.add('hidden');
  document.getElementById('pronun-analyzing').classList.remove('hidden');

  const phrase = state.phrases.find(p => p.id === state.pronun.phraseId);
  analyzeFullPronunciation(phrase?.text || '', pronunFinalText).then(() => {
    document.getElementById('pronun-analyzing').classList.add('hidden');
  });
}

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z']/g, '');
}

async function analyzeFullPronunciation(original, spoken) {
  const origWords = original.split(/\s+/).map(normalizeWord).filter(Boolean);
  const spokWords = spoken.split(/\s+/).map(normalizeWord).filter(Boolean);

  const floatTextEl = document.getElementById('pronun-float-text');
  floatTextEl.innerHTML = '';

  let correct = 0;
  origWords.forEach(word => {
    const span = document.createElement('span');
    const found = spokWords.includes(word);
    span.className = found ? 'word-correct' : 'word-wrong';
    if (found) correct++;
    span.textContent = word;
    floatTextEl.appendChild(span);
    floatTextEl.appendChild(document.createTextNode(' '));
  });

  const overall = origWords.length > 0 ? Math.round((correct / origWords.length) * 100) : 0;
  renderPronunResults(overall);

  // ---- Stats (per-session pronunciation accuracy; no global "record" shown here) ----
  state.stats.pronunCount = (state.stats.pronunCount || 0) + 1;
  const prevTotal = (state.stats.avgPronun || 0) * ((state.stats.pronunCount || 1) - 1);
  state.stats.avgPronun = Math.round((prevTotal + overall) / state.stats.pronunCount);
  if (overall > (state.stats.bestFluency || 0)) state.stats.bestFluency = overall;
  await idbPut('stats', { id: 'main', ...state.stats });
  await addXP(15);
  renderDesktopStats();

  await logSession({ type: 'pronun', score: overall, text: original });
  if (state.currentScreen === 'historial') renderHistorialScreen();
  else renderRecentActivitySidebar((await idbGetAll('sessions')).sort((a,b)=>b.created-a.created).slice(0,5));
}

function renderPronunResults(overall) {
  document.getElementById('pronun-results').classList.remove('hidden');

  const arc = document.getElementById('score-circle-arc');
  const circumference = 314;
  arc.style.transition = 'stroke-dashoffset 0.8s ease';
  arc.style.strokeDashoffset = circumference - (overall / 100) * circumference;
  arc.style.stroke = overall >= 80 ? 'var(--accent)' : overall >= 60 ? 'var(--orange)' : 'var(--red)';
  document.getElementById('score-num').textContent = overall + '%';
}

document.getElementById('pronun-start-btn').addEventListener('click', startPronun);
document.getElementById('pronun-stop-btn').addEventListener('click', stopPronun);


// ============ EVENT LISTENERS (Pronunciacion) ============
// Pronunciation
document.getElementById('pronun-phrase-select').addEventListener('change', e => {
  if (e.target.value) loadPronunPhrase(parseInt(e.target.value));
});
document.getElementById('pronun-show-btn').addEventListener('click', () => {
  const textEl = document.getElementById('recog-text-display');
  pronunTextVisible = !pronunTextVisible;
  textEl.classList.toggle('blurred', !pronunTextVisible);
  setPronunShowBtnLabel(pronunTextVisible);
});

