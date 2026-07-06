/* =============================================
   TALK TO ME — English Learning App
   ai-tutor.js — Panel de IA Tutor (Gemini Live)
   UI del panel de conversacion con IA + ajustes de proveedor en Perfil.
   Depende de GeminiLiveClient, definido en gemini-live.js.
   ============================================= */

'use strict';

// ============ AI TUTOR SYSTEM PROMPT ============
const AI_TUTOR_SYSTEM_INSTRUCTION =
  "You are a friendly, patient English-speaking tutor inside the 'Talk to Me' app. " +
  "Have a natural spoken conversation in English with the learner to help them practice. " +
  "Keep your responses conversational and not too long. Gently correct significant mistakes " +
  "without breaking the flow too much, and encourage the learner to keep talking.";

// ============ AI TUTOR (Gemini Live) ============
function aiPanelEls() {
  return {
    panel: document.getElementById('ai-panel'),
    viewSelect: document.getElementById('ai-view-select'),
    viewKey: document.getElementById('ai-view-key'),
    viewChat: document.getElementById('ai-view-chat'),
    statusDot: document.getElementById('ai-status-dot'),
    statusText: document.getElementById('ai-status-text'),
    messages: document.getElementById('ai-messages'),
    micBtn: document.getElementById('ai-mic-btn'),
  };
}

function openAIPanel() {
  const { panel } = aiPanelEls();
  panel.classList.remove('hidden');
  renderAIView();
}

function closeAIPanel() {
  const { panel } = aiPanelEls();
  panel.classList.add('hidden');
  endAISession();
}

function renderAIView() {
  const { viewSelect, viewKey, viewChat, messages } = aiPanelEls();
  viewSelect.classList.add('hidden');
  viewKey.classList.add('hidden');
  viewChat.classList.add('hidden');

  if (!state.cfg.aiProvider) {
    viewSelect.classList.remove('hidden');
  } else if (state.cfg.aiProvider === 'own' && !state.cfg.geminiApiKey) {
    viewKey.classList.remove('hidden');
  } else {
    viewChat.classList.remove('hidden');
    if (!messages.children.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-empty-state';
      empty.id = 'ai-empty-state';
      empty.innerHTML = '<span class="msi">graphic_eq</span>Tap the mic and start speaking English.';
      messages.appendChild(empty);
    }
  }
}

async function chooseAIProvider(provider) {
  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  renderAIView();
}

async function saveAIKeyFromPanel() {
  const input = document.getElementById('ai-key-input');
  const key = input.value.trim();
  if (!key) { toast('Paste a valid API key', 'error'); return; }
  state.cfg.geminiApiKey = key;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('API key saved', 'success');
  renderAIView();
}

function setAIStatus(status) {
  state.ai.status = status;
  const { statusDot, statusText } = aiPanelEls();
  const labels = {
    idle: 'Idle', connecting: 'Connecting…', ready: 'Ready',
    listening: 'Listening…', speaking: 'Speaking…',
  };
  statusDot.className = 'ai-status-dot ' + (status === 'idle' ? '' : status);
  statusText.textContent = labels[status] || status;
}

function clearAIEmptyState() {
  const empty = document.getElementById('ai-empty-state');
  if (empty) empty.remove();
}

function appendAIText(role, text, finished) {
  if (!text) return;
  clearAIEmptyState();
  const { messages } = aiPanelEls();

  // Turn boundary real: en cuanto habla el otro (usuario <-> IA), se cierran
  // las burbujas abiertas. Así cada intervención arranca una burbuja nueva
  // en vez de seguir pegándose a todo lo anterior.
  if (state.ai.lastRole && state.ai.lastRole !== role) {
    state.ai.currentUserBubble = null;
    state.ai.currentModelBubble = null;
  }
  state.ai.lastRole = role;

  const key = role === 'user' ? 'currentUserBubble' : 'currentModelBubble';

  if (!state.ai[key]) {
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ' + role;
    bubble.textContent = '';
    messages.appendChild(bubble);
    state.ai[key] = bubble;
  }
  state.ai[key].textContent += text;
  messages.scrollTop = messages.scrollHeight;

  if (finished) {
    state.ai[key] = null;
    state.ai.lastRole = null;
  }
}

async function startAISession() {
  if (state.ai.sessionActive) return;

  const mode = state.cfg.aiProvider;
  if (!mode) { toast('Choose an AI Tutor first', 'error'); return; }
  if (mode === 'own' && !state.cfg.geminiApiKey) { toast('Add your API key first', 'error'); return; }

  const client = new GeminiLiveClient({
    mode,
    apiKey: state.cfg.geminiApiKey,
    systemInstruction: AI_TUTOR_SYSTEM_INSTRUCTION,
    onStatus: setAIStatus,
    onUserText: (text, finished) => appendAIText('user', text, finished),
    onModelText: (text, finished) => appendAIText('model', text, finished),
    onError: (err) => {
      toast(err.message || 'AI Tutor connection error', 'error');
      endAISession();
    },
    onClose: () => {
      if (state.ai.sessionActive) endAISession();
    },
  });

  state.ai.client = client;
  state.ai.sessionActive = true;

  const { micBtn } = aiPanelEls();
  micBtn.classList.add('active');

  try {
    await client.connect();
    await client.startMic();
  } catch (err) {
    toast(err.message || 'Could not start the AI Tutor session', 'error');
    endAISession();
  }
}

function endAISession() {
  const { micBtn } = aiPanelEls();
  if (micBtn) micBtn.classList.remove('active');
  if (state.ai.client) {
    state.ai.client.disconnect();
    state.ai.client = null;
  }
  state.ai.sessionActive = false;
  state.ai.currentUserBubble = null;
  state.ai.currentModelBubble = null;
  state.ai.lastRole = null;
  setAIStatus('idle');
}

function toggleAIMic() {
  if (state.ai.sessionActive) endAISession();
  else startAISession();
}

// ---- Settings screen: AI Tutor section ----
function renderAISettingsSection() {
  const radioOwn = document.getElementById('ai-radio-own');
  const radioDev = document.getElementById('ai-radio-developer');
  const keyRow = document.getElementById('ai-settings-key-row');
  const keyInput = document.getElementById('ai-settings-key-input');
  if (!radioOwn) return;

  radioOwn.checked = state.cfg.aiProvider === 'own';
  radioDev.checked = state.cfg.aiProvider === 'developer';
  keyInput.value = state.cfg.geminiApiKey || '';
  keyRow.classList.toggle('hidden', state.cfg.aiProvider !== 'own');
}

async function saveAISettings() {
  const provider = document.getElementById('ai-radio-own').checked ? 'own'
    : document.getElementById('ai-radio-developer').checked ? 'developer' : null;

  if (!provider) { toast('Choose an AI Tutor option', 'error'); return; }

  if (provider === 'own') {
    const key = document.getElementById('ai-settings-key-input').value.trim();
    if (!key) { toast('Add your Gemini API key', 'error'); return; }
    state.cfg.geminiApiKey = key;
  }

  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('AI Tutor settings saved', 'success');
  renderAISettingsSection();
}


// ============ EVENT LISTENERS (AI Tutor) ============
document.getElementById('ai-btn').addEventListener('click', openAIPanel);
document.getElementById('ai-panel-close').addEventListener('click', closeAIPanel);
document.getElementById('ai-choose-own').addEventListener('click', () => chooseAIProvider('own'));
document.getElementById('ai-choose-developer').addEventListener('click', () => chooseAIProvider('developer'));
document.getElementById('ai-key-save').addEventListener('click', saveAIKeyFromPanel);
document.getElementById('ai-key-toggle').addEventListener('click', () => {
  const input = document.getElementById('ai-key-input');
  const icon = document.querySelector('#ai-key-toggle .msi');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-mic-btn').addEventListener('click', toggleAIMic);
document.getElementById('ai-end-btn').addEventListener('click', endAISession);

document.getElementById('ai-settings-key-toggle').addEventListener('click', () => {
  const input = document.getElementById('ai-settings-key-input');
  const icon = document.querySelector('#ai-settings-key-toggle .msi');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-radio-own').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-radio-developer').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-settings-save-btn').addEventListener('click', saveAISettings);

