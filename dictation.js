/* =============================================
   TALK TO ME — English Learning App
   dictation.js — Modo Dictado
   Captura de voz, deduplicacion de sesiones, timer, word counter,
   autocomplete chips, y guardado de sesion. Independiente de Pronunciacion.
   ============================================= */

'use strict';

// ============ PHRASE BANK & AUTOCOMPLETE ============
const PHRASE_BANK = [
  "These days, I'm pretty busy with my routine.",
  "Right now I'm just here, talking to myself.",
  "Today I want to talk about my daily routine.",
  "I've been trying to improve my English every day.",
  "Let me tell you about something that happened today.",
  "I think the most important thing right now is to practice.",
  "Every morning, I wake up and try to think in English.",
  "I want to describe my room and everything in it.",
  "Something I find challenging about English is the pronunciation.",
  "I'm going to try to speak for one full minute without stopping.",
  "Let me talk about a movie I watched recently.",
  "I have a lot of things on my mind today.",
  "One of my favorite things about learning English is the music.",
  "I want to improve my English so I can travel more.",
  "Let me tell you about my plans for this week.",
  "Let me talk about a person who inspires me.",
  "I want to explain how I usually spend my weekends.",
  "Today I feel like talking about food, especially my favorite dish.",
  "Let me describe the last trip I took, even if it was a short one.",
  "I want to talk about a goal I'm working on right now.",
  "Something I'd like to change about my daily routine is this.",
  "Let me tell you about a habit I'm trying to build.",
  "I want to talk about the city where I live.",
  "Let me describe my job or what I study.",
  "I want to talk about a mistake I made and what I learned from it.",
  "Let me tell you about a book or show I really enjoyed.",
  "I want to talk about how technology has changed my life.",
  "Something that makes me nervous is speaking in public, but I'm practicing.",
  "Let me describe a typical conversation I have with my family.",
  "I want to talk about what motivates me to keep learning English.",
  "Let me tell you three things I did today, in order.",
  "I want to describe someone close to me and why they matter to me.",
  "Let me talk about a problem I'm trying to solve these days.",
  "I want to explain what a perfect day would look like for me.",
  "Let me describe the weather today and how it affects my mood.",
  "I was _ but _ so I _ then _.",
  "I think _ because _ also _ so _",
  "I used to _ but now I _ because _ so _",
  "the thing is _ so _ I mean _ that's why _",
  "First _ then _ after that _ finally _",
  "On one hand _ but on the other hand _ so in the end _",
  "I remember _ and I felt _ because _ that's why _",
  "Even though _ I still _ since _ so now _",
  "Whenever I _ I usually _ because _ although _",
  "If I could _ I would _ because _ but for now _",
  "At first I thought _ but then I realized _ so _",
  "I'm not sure _ but I think _ maybe _ we'll see _",
  "It all started when _ then _ and eventually _",
  "What I like about _ is _ especially because _",
  "Compared to before, now I _ which means _",
];

const AC = {
  "i have": ["I have a dog.", "I have been studying for two hours.", "I have never been to London."],
  "i want": ["I want to improve my English.", "I want to travel someday.", "I want to tell you something."],
  "i think": ["I think English is fascinating.", "I think I need more practice.", "I think the best way to learn is to speak."],
  "i can": ["I can speak a little English.", "I can understand most things.", "I can try to explain."],
  "i would": ["I would like to learn more.", "I would love to travel.", "I would say it's getting easier."],
  "there is": ["There is a big difference.", "There is something I want to say.", "There is a lot to learn."],
  "i need": ["I need to practice more.", "I need to improve my pronunciation.", "I need to listen more carefully."],
};

// ============ DICTADO STATE ============
let dictadoRecognition = null;
let dictadoActive = false;
let finalText = '';
let dictadoSessionId = 0;

// Timer state
let dictadoTimerInterval = null;
let dictadoStartTs = 0;
let dictadoElapsedMs = 0;

// ============ TIMER HELPERS ============
function fmtTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getDurationMs() {
  const d = state.dictado.duration;
  if (d === 'free') return null;
  return Number(d) * 1000;
}

function startDictadoTimer() {
  dictadoStartTs = Date.now() - dictadoElapsedMs;
  const durationMs = getDurationMs();
  dictadoTimerInterval = setInterval(() => {
    dictadoElapsedMs = Date.now() - dictadoStartTs;
    if (durationMs != null) {
      const remaining = Math.max(0, durationMs - dictadoElapsedMs);
      document.getElementById('dictado-timer').textContent = fmtTimer(remaining);
      if (remaining <= 0) {
        stopDictado();
        return;
      }
    } else {
      document.getElementById('dictado-timer').textContent = fmtTimer(dictadoElapsedMs);
    }
  }, 250);
}

function stopDictadoTimer() {
  if (dictadoTimerInterval) clearInterval(dictadoTimerInterval);
  dictadoTimerInterval = null;
}

function resetDictadoTimer() {
  stopDictadoTimer();
  dictadoElapsedMs = 0;
  const durationMs = getDurationMs();
  document.getElementById('dictado-timer').textContent = durationMs != null ? fmtTimer(durationMs) : '00:00';
}

// ============ WORD COUNTER ============
// Only shown for timed modes, not Free mode.
function updateWordCounter() {
  const wrap = document.getElementById('word-counter');
  if (!wrap) return;
  const isTimed = state.dictado.duration !== 'free';
  wrap.classList.toggle('hidden', !isTimed);
  if (isTimed) {
    const words = finalText.trim() ? finalText.trim().split(/\s+/).filter(Boolean).length : 0;
    document.getElementById('word-counter-val').textContent = words;
  }
}

// ============ OVERLAP DEDUPLICATION ============
// Chrome on Android restarts the recognition session on every speech pause
// (continuous:true doesn't hold reliably). When a new session starts, it
// can re-hear audio from the previous one and produce long duplicates.
// We strip overlapping words at session boundaries using exact match first,
// then a fuzzy fallback (≥70% match over a window of up to 40 words).
function normalizeForOverlap(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function wordSimilar(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  let diff = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diff++;
    if (diff > 2) return false;
  }
  return true;
}

function stripDictadoOverlap(existingText, newWordsArr) {
  const existingWords = existingText.trim().split(/\s+/).filter(Boolean).map(normalizeForOverlap);
  const newWordsNorm = newWordsArr.map(normalizeForOverlap);
  const maxOverlap = Math.min(existingWords.length, newWordsNorm.length, 40);

  // Step 1 — exact match (handles Desktop where sessions rarely restart)
  for (let len = maxOverlap; len > 0; len--) {
    const tail = existingWords.slice(-len);
    const head = newWordsNorm.slice(0, len);
    if (tail.join(' ') === head.join(' ')) {
      return newWordsArr.slice(len);
    }
  }

  // Step 2 — fuzzy fallback (handles Android duplicate-audio edge cases)
  for (let len = maxOverlap; len >= 3; len--) {
    const tail = existingWords.slice(-len);
    const head = newWordsNorm.slice(0, len);
    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (wordSimilar(tail[i], head[i])) matches++;
    }
    if (matches / len >= 0.7) {
      return newWordsArr.slice(len);
    }
  }

  return newWordsArr;
}

// ============ RECOGNITION FACTORY ============
function createDictadoRecognition(sessionId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let sessionCommitted = '';

  rec.onresult = e => {
    if (sessionId !== dictadoSessionId || !dictadoActive) return;

    let interim = '';
    let sessionFinalNow = '';
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) sessionFinalNow += transcript + ' ';
      else interim += transcript;
    }
    sessionFinalNow = sessionFinalNow.trim();

    if (sessionFinalNow && sessionFinalNow !== sessionCommitted) {
      let newPortion;
      if (sessionCommitted && sessionFinalNow.toLowerCase().startsWith(sessionCommitted.toLowerCase())) {
        newPortion = sessionFinalNow.slice(sessionCommitted.length).trim();
      } else {
        newPortion = sessionFinalNow;
      }

      if (newPortion) {
        const newWords = newPortion.split(/\s+/).filter(Boolean);
        const trimmedWords = stripDictadoOverlap(finalText, newWords);
        const trimmed = trimmedWords.join(' ').trim();
        if (trimmed) {
          finalText += (finalText && !finalText.endsWith(' ') ? ' ' : '') + trimmed + ' ';
          document.getElementById('transcript-final').textContent = finalText;
          updateSuggestions(finalText);
          updateWordCounter();
        }
      }
      sessionCommitted = sessionFinalNow;
    }
    document.getElementById('transcript-interim').textContent = interim;
  };

  rec.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Error: ' + e.error, 'error');
  };

  // Android: delay restart to let the audio track fully release before
  // reopening; on Desktop this handler almost never fires.
  rec.onend = () => {
    if (dictadoActive && sessionId === dictadoSessionId) {
      dictadoSessionId++;
      const newSession = dictadoSessionId;
      setTimeout(() => {
        if (!dictadoActive || newSession !== dictadoSessionId) return;
        dictadoRecognition = createDictadoRecognition(newSession);
        try { dictadoRecognition.start(); } catch (e) { stopDictado(); }
      }, 300);
    }
  };

  return rec;
}

// ============ START / STOP ============
function stopDictado() {
  const wasActive = dictadoActive;
  dictadoActive = false;
  dictadoSessionId++;
  if (dictadoRecognition) {
    try { dictadoRecognition.stop(); } catch(e) {}
    dictadoRecognition = null;
  }
  document.getElementById('mic-btn').classList.remove('active');
  document.querySelector('.mic-stage')?.classList.remove('active');
  document.getElementById('wave-bars').classList.remove('active');
  document.getElementById('mic-status').textContent = 'Tap to speak';
  stopDictadoTimer();
  setDurationChipsDisabled(false);

  if (wasActive) finishDictadoSession();
}

async function finishDictadoSession() {
  const text = finalText.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const minutes = dictadoElapsedMs / 60000;
  const wpm = minutes > 0.05 ? Math.round(words / minutes) : 0;

  if (words === 0) return; // nothing spoken — skip summary

  const ideal = 130;
  const diff = Math.abs(wpm - ideal);
  const fluency = wpm > 0 ? Math.max(30, Math.min(100, Math.round(100 - diff * 0.5))) : 0;

  document.getElementById('dictado-summary').classList.remove('hidden');
  document.getElementById('sum-words').textContent = words;
  document.getElementById('sum-wpm').textContent = wpm;
  document.getElementById('sum-fluency').textContent = fluency + '%';

  const modeKey = String(state.dictado.duration);
  if (!state.stats.bestWPMByMode) state.stats.bestWPMByMode = freshStats().bestWPMByMode;
  const prevBestForMode = state.stats.bestWPMByMode[modeKey] || 0;

  const banner = document.getElementById('record-banner');
  if (prevBestForMode > 0 && wpm > prevBestForMode) {
    document.getElementById('record-banner-text').textContent = `New Record! WPM: ${wpm} (${DURATION_LABELS[modeKey]})`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
  if (wpm > prevBestForMode) state.stats.bestWPMByMode[modeKey] = wpm;
  if (fluency > (state.stats.bestFluency || 0)) state.stats.bestFluency = fluency;

  state.stats.wordsTotal = (state.stats.wordsTotal || 0) + words;
  if (!state.stats.sessionsByMode) state.stats.sessionsByMode = freshStats().sessionsByMode;
  state.stats.sessionsByMode[modeKey] = (state.stats.sessionsByMode[modeKey] || 0) + 1;
  state.stats.sessions = (state.stats.sessions || 0) + 1;
  await idbPut('stats', { id: 'main', ...state.stats });
  renderRecordBadge();
  renderDesktopStats();
  renderModeRecordLists();
  await addXP(10);

  await logSession({ type: 'dictado', mode: modeKey, wpm, fluency, words, text: text.slice(0, 120) });
  if (state.currentScreen === 'historial') renderHistorialScreen();
  else renderRecentActivitySidebar((await idbGetAll('sessions')).sort((a,b)=>b.created-a.created).slice(0,5));
}

function toggleDictado() {
  if (dictadoActive) {
    stopDictado();
    return;
  }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('Speech recognition not available. Use Chrome.', 'error');
    return;
  }

  // Clear any leftover transcript so WPM doesn't accumulate across sessions.
  finalText = '';
  document.getElementById('transcript-final').textContent = '';
  document.getElementById('transcript-interim').textContent = '';
  document.getElementById('sugg-chips').innerHTML = '';
  document.getElementById('dictado-summary').classList.add('hidden');
  document.getElementById('record-banner').classList.add('hidden');

  resetDictadoTimer();
  updateWordCounter();
  startDictadoTimer();
  setDurationChipsDisabled(true);

  dictadoSessionId++;
  const sessionId = dictadoSessionId;
  dictadoRecognition = createDictadoRecognition(sessionId);
  dictadoRecognition.start();
  dictadoActive = true;
  document.getElementById('mic-btn').classList.add('active');
  document.querySelector('.mic-stage')?.classList.add('active');
  document.getElementById('wave-bars').classList.add('active');
  document.getElementById('mic-status').textContent = 'Listening... (tap to stop)';
}

// ============ AUTOCOMPLETE SUGGESTIONS ============
function updateSuggestions(text) {
  const chips = document.getElementById('sugg-chips');
  chips.innerHTML = '';
  const lower = text.toLowerCase().trim();
  let suggestions = [];

  for (const [key, vals] of Object.entries(AC)) {
    if (lower.endsWith(key) || lower.includes(key)) {
      suggestions = [...suggestions, ...vals];
    }
  }

  suggestions.slice(0, 6).forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      finalText += s + ' ';
      document.getElementById('transcript-final').textContent = finalText;
      updateWordCounter();
    });
    chips.appendChild(chip);
  });
}

function seedSuggestionChips() {
  document.getElementById('sugg-chips').innerHTML = '';
  Object.values(AC).slice(0, 2).flat().slice(0, 5).forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      finalText += s + ' ';
      document.getElementById('transcript-final').textContent = finalText;
      updateWordCounter();
    });
    document.getElementById('sugg-chips').appendChild(chip);
  });
}

// ============ PROMPT PHRASE ============
function refreshPromptPhrase() {
  const phrase = PHRASE_BANK[Math.floor(Math.random() * PHRASE_BANK.length)];
  document.getElementById('prompt-phrase').textContent = phrase;
  state.dictado.currentPhrase = phrase;
}

// ============ SAVE DICTADO AS CARD ============
async function saveDictadoAsCard() {
  const text = finalText.trim();
  if (!text) { toast('No text to save', 'error'); return; }
  const id = await idbPut('phrases', { text, title: text.slice(0, 40) + '...', trans: '', created: Date.now() });
  state.phrases.push({ id, text, title: text.slice(0,40) + '...', trans: '', created: Date.now() });
  const mazoId = 'general';
  const phraseIds = state.mazos[mazoId] || [];
  phraseIds.push(id);
  state.mazos[mazoId] = phraseIds;
  await idbPut('mazos', { id: mazoId, phraseIds });
  await addXP(5);
  toast('Saved as card', 'success');
}

// ============ DURATION CHIPS ============
function setDurationChipsDisabled(disabled) {
  document.querySelectorAll('.dur-chip').forEach(btn => { btn.disabled = disabled; });
  const dropdownBtn = document.getElementById('duration-dropdown-btn');
  if (dropdownBtn) dropdownBtn.disabled = disabled;
}

function selectDuration(dur) {
  state.dictado.duration = dur;
  document.querySelectorAll('.dur-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dur === String(dur));
  });
  const label = document.getElementById('duration-dropdown-label');
  if (label) label.textContent = 'Time: ' + (dur === 'free' ? 'Free' : dur + 's');
  resetDictadoTimer();
  updateWordCounter();
}

// ============ EVENT LISTENERS (Dictado) ============
document.getElementById('mic-btn').addEventListener('click', toggleDictado);

document.getElementById('btn-delete-last').addEventListener('click', () => {
  finalText = finalText.trimEnd().split(' ').slice(0, -1).join(' ') + (finalText.trim() ? ' ' : '');
  document.getElementById('transcript-final').textContent = finalText;
  updateWordCounter();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  finalText = '';
  document.getElementById('transcript-final').textContent = '';
  document.getElementById('transcript-interim').textContent = '';
  document.getElementById('sugg-chips').innerHTML = '';
  document.getElementById('dictado-summary').classList.add('hidden');
  resetDictadoTimer();
  updateWordCounter();
});

document.getElementById('btn-save-dictado').addEventListener('click', saveDictadoAsCard);
document.getElementById('prompt-refresh').addEventListener('click', refreshPromptPhrase);

// Duration chips — desktop inline + mobile dropdown
document.querySelectorAll('.dur-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    if (dictadoActive) return;
    selectDuration(btn.dataset.dur === 'free' ? 'free' : Number(btn.dataset.dur));
    document.getElementById('duration-dropdown-menu')?.classList.add('hidden');
  });
});

document.getElementById('duration-dropdown-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('duration-dropdown-menu').classList.toggle('hidden');
});
document.addEventListener('click', e => {
  const wrap = document.getElementById('duration-dropdown-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('duration-dropdown-menu')?.classList.add('hidden');
  }
});

// Keyboard shortcuts (Space = toggle, Backspace = delete last, Ctrl+L = clear)
document.addEventListener('keydown', e => {
  if (state.currentScreen !== 'home' || state.currentModule !== 'dictado') return;
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggleDictado();
  }
  if (e.code === 'Backspace') {
    e.preventDefault();
    finalText = finalText.trimEnd().split(' ').slice(0, -1).join(' ') + ' ';
    document.getElementById('transcript-final').textContent = finalText;
    updateWordCounter();
  }
  if (e.ctrlKey && e.code === 'KeyL') {
    e.preventDefault();
    finalText = '';
    document.getElementById('transcript-final').textContent = '';
    document.getElementById('transcript-interim').textContent = '';
    updateWordCounter();
  }
});