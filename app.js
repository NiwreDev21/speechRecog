/* =============================================
   TALK TO ME — English Learning App
   app.js — Nucleo de la aplicacion
   Estado global, constantes compartidas entre features, componentes de UI
   genericos (toast, modales, reproductor de audio), navegacion entre
   pantallas, dashboard de inicio (saludo/records/XP), modo enfoque e init().
   ============================================= */

'use strict';

// ============ SHARED CONSTANTS ============
const XP_PER_LEVEL = 1000;
const LEVEL_TITLES = [
  { min: 0, title: 'Beginner Speaker' },
  { min: 3, title: 'Language Enthusiast' },
  { min: 6, title: 'Fluent Explorer' },
  { min: 10, title: 'English Master' },
];

const TAGLINES = [
  'Every practice brings you closer to fluency.',
  'Your progress is solid and consistent.',
  'Your climb is steady and impressive.',
  "You're very close to the next level.",
];

const DURATION_MODES = ['15', '30', '60', '120', 'free'];
const DURATION_LABELS = { '15': '15 seconds', '30': '30 seconds', '60': '60 seconds', '120': '120 seconds', free: 'Free' };

// ============ STATE ============
function freshStats() {
  return {
    sessions: 0, minutes: 0,
    avgPronun: 0, pronunCount: 0,
    streak: 0, lastDate: null,
    bestWPM: 0, bestFluency: 0, wordsTotal: 0,
    xp: 0,
    bestWPMByMode: { '15': 0, '30': 0, '60': 0, '120': 0, free: 0 },
    sessionsByMode: { '15': 0, '30': 0, '60': 0, '120': 0, free: 0 },
  };
}

let state = {
  currentModule: 'dictado',
  currentScreen: 'home',
  phrases: [],
  mazos: {},
  stats: freshStats(),
  cfg: {
    notifEnabled: false, notifTime: '09:00', userName: 'Your name', focusMode: false,
    aiProvider: null,
    geminiApiKey: '',
  },
  pronun: { phraseId: null, recognition: null, listening: false },
  dictado: { recognition: null, active: false, finalText: '', currentPhrase: '', duration: 'free' },
  ai: {
    client: null,
    status: 'idle',
    sessionActive: false,
    currentUserBubble: null,
    currentModelBubble: null,
    lastRole: null,
  },
};

const activePlayers = new Map();

// ============ TOAST ============
const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info' };

function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon-wrap"><span class="msi">${TOAST_ICONS[type] || TOAST_ICONS.info}</span></span>
    <span class="toast-msg"></span>
    <button class="toast-close" aria-label="Close" type="button">×</button>
    <span class="toast-progress" style="animation-duration:${duration}ms"></span>
  `;
  el.querySelector('.toast-msg').textContent = msg;
  container.appendChild(el);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.add('hide');
    setTimeout(() => el.remove(), 220);
  };

  el.querySelector('.toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// ============ GENERIC CONFIRM MODAL ============
let confirmResolver = null;

function askConfirm(title, text, okLabel) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-text').textContent = text;
  const okBtn = document.getElementById('confirm-modal-ok');
  okBtn.textContent = okLabel || 'Confirm';
  document.getElementById('confirm-modal').classList.remove('hidden');
  return new Promise(resolve => { confirmResolver = resolve; });
}

function closeConfirmModal(result) {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
}

document.getElementById('confirm-modal-ok').addEventListener('click', () => closeConfirmModal(true));
document.getElementById('confirm-modal-cancel').addEventListener('click', () => closeConfirmModal(false));
document.getElementById('confirm-modal-close').addEventListener('click', () => closeConfirmModal(false));
document.getElementById('confirm-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-modal')) closeConfirmModal(false);
});

// ============ HELP MODAL ============
function openHelpModal() { document.getElementById('help-modal').classList.remove('hidden'); }
function closeHelpModal() { document.getElementById('help-modal').classList.add('hidden'); }
document.getElementById('sidebar-help-btn').addEventListener('click', openHelpModal);
document.getElementById('help-modal-close').addEventListener('click', closeHelpModal);
document.getElementById('help-modal-ok').addEventListener('click', closeHelpModal);
document.getElementById('help-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('help-modal')) closeHelpModal();
});

// ============ AUDIO PLAYER COMPONENT ============
function createAudioPlayer(blob, opts = {}) {
  const { showLoop = true, showSpeed = true, id = Math.random().toString(36).slice(2) } = opts;
  const url = blobURL(blob);
  const audio = new Audio(url);
  audio.preload = 'metadata';

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let speedIdx = 2;
  let looping = false;

  const wrap = document.createElement('div');
  wrap.className = 'audio-player';
  wrap.dataset.playerId = id;

  const playBtn = document.createElement('button');
  playBtn.className = 'ap-btn';
  playBtn.textContent = '▶';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'ap-progress-wrap';
  const progressTrack = document.createElement('div');
  progressTrack.className = 'ap-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'ap-progress-fill';
  progressTrack.appendChild(progressFill);
  progressWrap.appendChild(progressTrack);

  const timeEl = document.createElement('div');
  timeEl.className = 'ap-time';
  timeEl.textContent = '0:00 / 0:00';

  const speedBtn = document.createElement('button');
  speedBtn.className = 'ap-speed';
  speedBtn.textContent = '1×';

  const loopBtn = document.createElement('button');
  loopBtn.className = 'ap-btn ap-loop';
  loopBtn.textContent = '↺';
  loopBtn.title = 'Loop';

  function fmtTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
  }

  audio.addEventListener('loadedmetadata', () => {
    timeEl.textContent = `0:00 / ${fmtTime(audio.duration)}`;
  });
  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressFill.style.width = pct + '%';
    timeEl.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
  });
  audio.addEventListener('play', () => { playBtn.innerHTML = '<span class="msi">pause</span>'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    if (looping) {
      setTimeout(() => audio.play(), 300);
      if (opts.onLoop) opts.onLoop();
    } else {
      if (opts.onEnd) opts.onEnd();
    }
  });

  playBtn.addEventListener('click', () => {
    activePlayers.forEach((ap, pid) => { if (pid !== id) ap.pause(); });
    if (audio.paused) audio.play();
    else audio.pause();
  });

  progressWrap.addEventListener('click', e => {
    const rect = progressTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = audio.duration * ratio;
  });

  if (showSpeed) {
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      audio.playbackRate = speeds[speedIdx];
      speedBtn.textContent = speeds[speedIdx] + '×';
    });
  }

  if (showLoop) {
    loopBtn.addEventListener('click', () => {
      looping = !looping;
      loopBtn.classList.toggle('active', looping);
    });
  }

  wrap.appendChild(playBtn);
  wrap.appendChild(progressWrap);
  wrap.appendChild(timeEl);
  if (showSpeed) wrap.appendChild(speedBtn);
  if (showLoop) wrap.appendChild(loopBtn);

  const api = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.currentTime = 0; },
    setLoop: v => { looping = v; loopBtn.classList.toggle('active', v); },
    isLooping: () => looping,
    el: wrap,
    audio,
    id,
  };

  activePlayers.set(id, api);
  return api;
}

// ============ NAVIGATION (mode switcher: Dictation / Pronunciation) ============
function switchModule(mod) {
  document.querySelectorAll('.module-panel').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('module-' + mod);
  if (el) el.classList.add('active');
  state.currentModule = mod;

  stopDictado();
  stopPronun();

  renderModeSwitcher();
  renderSidebarNav();

  const durationRow = document.getElementById('duration-row');
  if (durationRow) durationRow.classList.toggle('hidden', mod !== 'dictado');

  const greeting = document.getElementById('home-greeting');
  if (greeting) greeting.classList.toggle('hidden', mod === 'pronun');

  if (mod === 'pronun') populatePronunSelect();
}

function renderModeSwitcher() {
  const icon = document.getElementById('mode-switcher-icon');
  const label = document.getElementById('mode-switcher-label');
  if (state.currentModule === 'dictado') {
    if (icon) icon.textContent = 'keyboard_voice';
    if (label) label.textContent = 'Dictation';
  } else {
    if (icon) icon.textContent = 'graphic_eq';
    if (label) label.textContent = 'Pronunciation';
  }
  document.querySelectorAll('.mode-dropdown-item').forEach(btn => {
    if (btn.dataset.module) btn.classList.toggle('active', btn.dataset.module === state.currentModule);
  });
}

function toggleModeDropdown(force) {
  const dd = document.getElementById('mode-dropdown');
  if (!dd) return;
  const show = force !== undefined ? force : dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !show);
}

// ============ DESKTOP SIDEBAR NAV STATE ============
function renderSidebarNav() {
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    const nav = btn.dataset.nav;
    let isActive = false;
    if (nav === 'dictado' || nav === 'pronun') {
      isActive = state.currentScreen === 'home' && state.currentModule === nav;
    } else {
      isActive = state.currentScreen === nav;
    }
    btn.classList.toggle('active', isActive);
  });
}

// ============ SCREEN NAVIGATION ============
function goToScreen(screen) {
  state.currentScreen = screen;
  document.getElementById('home-section').classList.toggle('active', screen === 'home');
  document.getElementById('profile-section').classList.toggle('active', screen === 'profile');
  document.getElementById('historial-section').classList.toggle('active', screen === 'historial');
  document.getElementById('tarjetas-section').classList.toggle('active', screen === 'tarjetas');
  document.getElementById('topbar-back-btn').classList.toggle('hidden', screen === 'home');
  document.getElementById('topbar-logo').classList.toggle('hidden', screen !== 'home');
  document.getElementById('fab-create-mazo').classList.toggle('hidden', screen !== 'home' && screen !== 'tarjetas');

  if (screen === 'home') {
    stopPronun();
  } else {
    stopDictado();
    stopPronun();
  }

  if (screen === 'profile') renderProfileScreen();
  if (screen === 'historial') renderHistorialScreen();
  if (screen === 'tarjetas') renderTarjetasScreen();

  renderSidebarNav();
}

// ============ DATA / GREETING ============
async function loadData() {
  state.phrases = await idbGetAll('phrases');
  const mazoRecords = await idbGetAll('mazos');
  state.mazos = {};
  for (const m of mazoRecords) state.mazos[m.id] = m.phraseIds || [];
  const statsRec = await idbGet('stats', 'main');
  if (statsRec) {
    state.stats = { ...freshStats(), ...statsRec };
    state.stats.bestWPMByMode = { ...freshStats().bestWPMByMode, ...(statsRec.bestWPMByMode || {}) };
    state.stats.sessionsByMode = { ...freshStats().sessionsByMode, ...(statsRec.sessionsByMode || {}) };
    if (statsRec.bestWPM && !statsRec.bestWPMByMode) {
      state.stats.bestWPMByMode.free = statsRec.bestWPM;
    }
  }
  const cfgRec = await idbGet('cfg', 'main');
  if (cfgRec) state.cfg = { ...state.cfg, ...cfgRec };
  renderGreeting();
  renderLevelBadge();
  renderRecordBadge();
  renderDesktopStats();
  renderModeRecordLists();
  applyFocusModeUI();
}

function renderGreeting() {
  const el = document.getElementById('home-username');
  if (el) el.textContent = state.cfg.userName || 'Your name';
}

function renderRecordBadge() {
  const val = (state.stats.bestWPMByMode && state.stats.bestWPMByMode.free) || 0;
  const el = document.getElementById('home-record-wpm');
  if (el) el.textContent = val;
  const side = document.getElementById('side-record-wpm');
  if (side) side.textContent = val;
  const sub = document.getElementById('side-record-sub');
  if (sub) sub.textContent = `${state.stats.sessions || 0} sessions completed`;
}

// ============ DESKTOP SIDEBAR STATS ============
function renderDesktopStats() {
  const words = document.getElementById('side-stat-words');
  const wpm = document.getElementById('side-stat-wpm');
  const fluency = document.getElementById('side-stat-fluency');
  const pronun = document.getElementById('side-stat-pronun');
  const sessions = document.getElementById('side-stat-sessions');
  if (words) words.textContent = state.stats.wordsTotal || 0;
  if (wpm) wpm.textContent = (state.stats.bestWPMByMode && state.stats.bestWPMByMode.free) || 0;
  if (fluency) fluency.textContent = (state.stats.bestFluency || 0) + '%';
  if (pronun) pronun.textContent = (state.stats.avgPronun || 0) + '%';
  if (sessions) sessions.textContent = state.stats.sessions || 0;
}

// ============ PER-MODE RECORD LISTS ============
function modeRecordRowsHTML() {
  return DURATION_MODES.map(mode => {
    const val = (state.stats.bestWPMByMode && state.stats.bestWPMByMode[mode]) || 0;
    return `<div class="duration-record-row">
      <span class="duration-record-label">${DURATION_LABELS[mode]}</span>
      <span class="duration-record-val">${val > 0 ? val + ' WPM' : '—'}</span>
    </div>`;
  }).join('');
}

function renderModeRecordLists() {
  const profileList = document.getElementById('duration-records-list');
  if (profileList) profileList.innerHTML = modeRecordRowsHTML();

  const sidebarList = document.getElementById('sidebar-duration-records-list');
  if (sidebarList) sidebarList.innerHTML = modeRecordRowsHTML();

  const mini = document.getElementById('sidebar-records-mini-list');
  if (mini) {
    mini.innerHTML = DURATION_MODES.map(mode => {
      const val = (state.stats.bestWPMByMode && state.stats.bestWPMByMode[mode]) || 0;
      const short = mode === 'free' ? 'Free' : mode + 's';
      return `<div class="sidebar-records-mini-row"><span>${short}</span><span>${val > 0 ? val : '—'}</span></div>`;
    }).join('');
  }
}

// ============ XP / LEVEL SYSTEM ============
function getLevelInfo() {
  const xp = state.stats.xp || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  let title = LEVEL_TITLES[0].title;
  for (const t of LEVEL_TITLES) if (level >= t.min + 1 || (t.min === 0)) { if (level - 1 >= t.min) title = t.title; }
  return { xp, level, xpIntoLevel, pct, title };
}

async function addXP(amount) {
  const before = getLevelInfo().level;
  state.stats.xp = (state.stats.xp || 0) + amount;
  await idbPut('stats', { id: 'main', ...state.stats });
  const after = getLevelInfo().level;
  renderLevelBadge();
  if (after > before) toast(`You reached level ${after}! 🎉`, 'success');
}

function renderLevelBadge() {
  const { level } = getLevelInfo();
  const lvNum = document.getElementById('lv-num');
  if (lvNum) lvNum.textContent = level;
}

// ============ FOCUS MODE ============
function applyFocusModeUI() {
  const shell = document.querySelector('.app-shell');
  const banner = document.getElementById('sidebar-focus-banner');
  const sub = document.getElementById('focus-banner-sub');
  const isOn = !!state.cfg.focusMode;
  if (shell) shell.classList.toggle('focus-mode', isOn);
  if (banner) banner.classList.toggle('active', isOn);
  if (sub) sub.textContent = isOn ? 'Extra panels are hidden' : 'Hide extra panels while you practice';
}

async function toggleFocusMode() {
  state.cfg.focusMode = !state.cfg.focusMode;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  applyFocusModeUI();
  toast(state.cfg.focusMode ? 'Focus mode on' : 'Focus mode off', 'info', 1600);
}

// ============ SERVICE WORKER ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error:', err));
}

// ============ EVENT LISTENERS (navegacion / cascara) ============
document.getElementById('profile-btn').addEventListener('click', () => goToScreen('profile'));
document.getElementById('topbar-logo').addEventListener('click', () => goToScreen('home'));
document.getElementById('topbar-back-btn').addEventListener('click', () => goToScreen('home'));

document.getElementById('mode-switcher-btn').addEventListener('click', e => {
  e.stopPropagation();
  toggleModeDropdown();
});
document.querySelectorAll('.mode-dropdown-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.module) {
      switchModule(btn.dataset.module);
      goToScreen('home');
    } else if (btn.dataset.nav) {
      goToScreen(btn.dataset.nav);
    }
    toggleModeDropdown(false);
  });
});
document.addEventListener('click', e => {
  const wrap = document.getElementById('mode-switcher-wrap');
  if (wrap && !wrap.contains(e.target)) toggleModeDropdown(false);
});

document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const nav = btn.dataset.nav;
    if (nav === 'dictado' || nav === 'pronun') {
      switchModule(nav);
      goToScreen('home');
    } else {
      goToScreen(nav);
    }
  });
});
document.getElementById('sidebar-viewall-btn').addEventListener('click', () => goToScreen('historial'));
document.getElementById('sidebar-focus-banner').addEventListener('click', toggleFocusMode);

// ============ ICON GENERATION ============
function generateIcons() {
  const sizes = [192, 512];
  sizes.forEach(size => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#121316';
    ctx.beginPath();
    const r = size * 0.18;
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e5897a';
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e5897a';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    canvas.toBlob(() => {});
  });
}

// ============ INIT ============
async function init() {
  await openDB();
  await loadData();
  switchModule('dictado');
  selectDuration('free');
  goToScreen('home');
  refreshPromptPhrase();
  generateIcons();
  renderHistorialScreen();
  seedSuggestionChips();
}

init().catch(console.error);