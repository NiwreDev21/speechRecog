/* =============================================
   TALK TO ME — English Learning App
   screens.js — Pantallas de gestion
   Historial, Tarjetas y Perfil (incluye reset de records, erase de datos y
   ajustes). Se agrupan porque son pantallas simples de listar/crear/borrar
   con complejidad y patrones de render muy similares entre si.
   ============================================= */

'use strict';

// ============ PROFILE SCREEN ============
function renderProfileScreen() {
  const { xp, level, xpIntoLevel, pct, title } = getLevelInfo();
  document.getElementById('profile-name-display').textContent = state.cfg.userName || 'Your name';
  document.getElementById('profile-title-text').textContent = title;
  document.getElementById('xp-bar-fill').style.width = pct + '%';
  document.getElementById('xp-current').textContent = xpIntoLevel;
  document.getElementById('xp-target').textContent = XP_PER_LEVEL;
  document.getElementById('xp-next-level').textContent = level + 1;
  document.getElementById('profile-tagline').textContent = TAGLINES[Math.min(TAGLINES.length - 1, Math.floor(pct / 30))];

  document.getElementById('metric-best-wpm').textContent = `${(state.stats.bestWPMByMode && state.stats.bestWPMByMode.free) || 0} WPM`;
  document.getElementById('metric-fluency').textContent = `${state.stats.bestFluency || 0}%`;

  document.getElementById('cfg-username').value = state.cfg.userName || 'Your name';
  document.getElementById('cfg-notif').checked = !!state.cfg.notifEnabled;
  document.getElementById('cfg-notif-time').value = state.cfg.notifTime || '09:00';

  renderModeRecordLists();
  renderStorageInfo();
  renderAISettingsSection();
}

async function saveProfileSettings() {
  const name = document.getElementById('cfg-username').value.trim();
  state.cfg.userName = name || 'Your name';
  state.cfg.notifEnabled = document.getElementById('cfg-notif').checked;
  state.cfg.notifTime = document.getElementById('cfg-notif-time').value || '09:00';
  await idbPut('cfg', { id: 'main', ...state.cfg });
  renderGreeting();
  renderProfileScreen();
  toast('Profile updated', 'success');
}

// ============ DATA & STORAGE (Profile) ============
function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function renderStorageInfo() {
  const usedEl = document.getElementById('storage-used-val');
  const quotaEl = document.getElementById('storage-quota-val');
  const fillEl = document.getElementById('storage-bar-fill');
  if (!usedEl || !quotaEl) return;

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      usedEl.textContent = fmtBytes(usage);
      quotaEl.textContent = fmtBytes(quota);
      if (fillEl) {
        const pct = quota ? Math.min(100, (usage / quota) * 100) : 0;
        fillEl.style.width = pct + '%';
      }
      return;
    } catch (e) { /* fall through */ }
  }
  usedEl.textContent = 'Not available';
  quotaEl.textContent = 'Not available';
  if (fillEl) fillEl.style.width = '0%';
}

// ============ RESET RECORDS ============
async function resetRecords() {
  const freshBestByMode = { '15': 0, '30': 0, '60': 0, '120': 0, free: 0 };
  state.stats.bestWPMByMode = { ...freshBestByMode };
  state.stats.bestWPM = 0;
  state.stats.bestFluency = 0;
  state.stats.avgPronun = 0;
  state.stats.pronunCount = 0;
  await idbPut('stats', { id: 'main', ...state.stats });
  renderRecordBadge();
  renderDesktopStats();
  renderModeRecordLists();
  if (state.currentScreen === 'profile') renderProfileScreen();
  toast('Records reset', 'success');
}

// ============ ERASE ALL DATA ============
async function eraseAllData() {
  await Promise.all(['phrases', 'mazos', 'audio', 'sessions', 'stats', 'cfg'].map(idbClear));
  state.stats = freshStats();
  state.cfg = { notifEnabled: false, notifTime: '09:00', userName: 'Your name', focusMode: false, aiProvider: null, geminiApiKey: '' };
  state.phrases = [];
  state.mazos = {};
  finalText = '';
  document.getElementById('transcript-final').textContent = '';
  await loadData();
  populatePronunSelect();
  renderTarjetasScreen();
  renderHistorialScreen();
  toast('All data erased', 'success');
}

document.getElementById('btn-reset-records').addEventListener('click', async () => {
  const ok = await askConfirm(
    'Reset all records?',
    'This will clear all best WPM scores and pronunciation averages. Your cards, sessions, and settings will not be affected.',
    'Reset records'
  );
  if (ok) await resetRecords();
});

document.getElementById('btn-clear-all-data').addEventListener('click', async () => {
  const ok = await askConfirm(
    'Erase all data?',
    'This permanently deletes every card, session, stat and setting stored on this device. This cannot be undone.',
    'Erase everything'
  );
  if (ok) await eraseAllData();
});

// ============ SESSIONS / HISTORY ============
async function logSession(entry) {
  await idbPut('sessions', { created: Date.now(), ...entry });
  state.stats.sessions = (state.stats.sessions || 0) + 1;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

async function renderHistorialScreen() {
  const list = document.getElementById('historial-list');
  const sessions = (await idbGetAll('sessions')).sort((a, b) => b.created - a.created);
  if (!sessions.length) {
    list.innerHTML = '<div class="empty-state">No sessions yet. Start practicing to build your history!</div>';
  } else {
    list.innerHTML = sessions.slice(0, 100).map(s => {
      const isDictado = s.type === 'dictado';
      const icon = isDictado ? 'keyboard_voice' : 'graphic_eq';
      const title = isDictado ? `Dictation · ${DURATION_LABELS[s.mode] || s.mode}` : 'Pronunciation practice';
      const sub = s.text ? s.text.slice(0, 70) : '';
      const metric = isDictado ? `${s.wpm} WPM` : `${s.score}%`;
      return `<div class="historial-item">
        <div class="historial-item-icon"><span class="msi">${icon}</span></div>
        <div class="historial-item-body">
          <div class="historial-item-title">${title}</div>
          <div class="historial-item-sub">${sub}</div>
        </div>
        <div class="historial-item-right">
          <div class="historial-item-metric">${metric}</div>
          <div class="historial-item-time">${timeAgo(s.created)}</div>
        </div>
      </div>`;
    }).join('');
  }
  renderRecentActivitySidebar(sessions.slice(0, 5));
}

function renderRecentActivitySidebar(sessions) {
  const el = document.getElementById('sidebar-activity-list');
  if (!el) return;
  if (!sessions || !sessions.length) {
    el.innerHTML = '<div class="sidebar-activity-empty">No sessions yet</div>';
    return;
  }
  el.innerHTML = sessions.map(s => {
    const isDictado = s.type === 'dictado';
    const icon = isDictado ? 'keyboard_voice' : 'graphic_eq';
    const title = isDictado ? `Dictation (${DURATION_LABELS[s.mode] || s.mode})` : 'Pronunciation';
    const metric = isDictado ? `${s.wpm} WPM` : `${s.score}%`;
    return `<div class="sidebar-activity-item">
      <div class="sidebar-activity-icon"><span class="msi">${icon}</span></div>
      <div class="sidebar-activity-info">
        <div class="sidebar-activity-title">${title}</div>
        <div class="sidebar-activity-time">${timeAgo(s.created)}</div>
      </div>
      <div class="sidebar-activity-metric">${metric}</div>
    </div>`;
  }).join('');
}

// ============ TARJETAS / CARDS SCREEN ============
function renderTarjetasScreen() {
  const grid = document.getElementById('tarjetas-grid');
  if (!grid) return;
  if (!state.phrases.length) {
    grid.innerHTML = '<div class="empty-state">No cards yet. Create one to get started!</div>';
    return;
  }
  grid.innerHTML = '';
  state.phrases.slice().reverse().forEach(p => {
    const card = document.createElement('div');
    card.className = 'tarjeta-card';
    const created = p.created ? new Date(p.created).toLocaleDateString() : '';
    card.innerHTML = `
      <div class="tarjeta-card-text"></div>
      <div class="tarjeta-card-meta">${created}</div>
      <div class="tarjeta-card-actions">
        <button class="btn btn-ghost btn-sm tarjeta-practice-btn" type="button"><span class="msi">graphic_eq</span> Practice</button>
        <button class="btn btn-ghost btn-sm tarjeta-delete-btn" type="button" title="Delete"><span class="msi">delete</span></button>
      </div>`;
    card.querySelector('.tarjeta-card-text').textContent = p.text;
    card.querySelector('.tarjeta-practice-btn').addEventListener('click', () => {
      switchModule('pronun');
      goToScreen('home');
      setTimeout(() => {
        const sel = document.getElementById('pronun-phrase-select');
        sel.value = p.id;
        loadPronunPhrase(p.id);
      }, 0);
    });
    card.querySelector('.tarjeta-delete-btn').addEventListener('click', async () => {
      const ok = await askConfirm('Delete this card?', 'This phrase and any reference audio linked to it will be removed.', 'Delete');
      if (!ok) return;
      await idbDelete('phrases', p.id);
      state.phrases = state.phrases.filter(x => x.id !== p.id);
      for (const [mazoId, ids] of Object.entries(state.mazos)) {
        state.mazos[mazoId] = ids.filter(id => id !== p.id);
        await idbPut('mazos', { id: mazoId, phraseIds: state.mazos[mazoId] });
      }
      renderTarjetasScreen();
      populatePronunSelect();
      toast('Card deleted', 'success');
    });
    grid.appendChild(card);
  });
}

// ============ CREATE CARD (FAB / Sidebar) ============
function openTarjetaModal() {
  const text = finalText.trim();
  document.getElementById('tarjeta-text-input').value = text || '';
  document.getElementById('tarjeta-modal').classList.remove('hidden');
}

function closeTarjetaModal() {
  document.getElementById('tarjeta-modal').classList.add('hidden');
}

async function createTarjeta() {
  const text = document.getElementById('tarjeta-text-input').value.trim();
  if (!text) { toast('Write a phrase for the card', 'error'); return; }

  const id = await idbPut('phrases', { text, title: text.slice(0, 40) + (text.length > 40 ? '...' : ''), trans: '', created: Date.now() });
  state.phrases.push({ id, text, title: text.slice(0,40) + (text.length > 40 ? '...' : ''), trans: '', created: Date.now() });

  const mazoId = 'general';
  const phraseIds = state.mazos[mazoId] || [];
  phraseIds.push(id);
  state.mazos[mazoId] = phraseIds;
  await idbPut('mazos', { id: mazoId, phraseIds });

  await addXP(10);
  toast('Card created', 'success');
  closeTarjetaModal();

  if (state.currentModule === 'pronun') populatePronunSelect();
  if (state.currentScreen === 'tarjetas') renderTarjetasScreen();
}

// ============ EVENT LISTENERS (Perfil / Tarjetas) ============
document.getElementById('profile-save-btn').addEventListener('click', saveProfileSettings);
document.getElementById('sidebar-new-card-btn').addEventListener('click', openTarjetaModal);
document.getElementById('tarjetas-new-btn').addEventListener('click', openTarjetaModal);
document.getElementById('fab-create-mazo').addEventListener('click', openTarjetaModal);
document.getElementById('tarjeta-modal-close').addEventListener('click', closeTarjetaModal);
document.getElementById('tarjeta-cancel-btn').addEventListener('click', closeTarjetaModal);
document.getElementById('tarjeta-create-btn').addEventListener('click', createTarjeta);
document.getElementById('tarjeta-use-dictado-btn').addEventListener('click', () => {
  document.getElementById('tarjeta-text-input').value = finalText.trim();
});
document.getElementById('tarjeta-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('tarjeta-modal')) closeTarjetaModal();
});