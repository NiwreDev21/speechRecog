/* =============================================
   TALK TO ME — English Learning App
   ai-tutor.js — Panel de IA Tutor con Avatar Vivo
   Avatar animado con estados idle/listening/thinking/speaking,
   burbujas únicas (sin historial), minimize sin cortar sesión.
   Depende de GeminiLiveClient (gemini-live.js).
   ============================================= */

'use strict';

// ============ SYSTEM PROMPT PERSONALIZADO ============
const AI_TUTOR_SYSTEM_INSTRUCTION = `
You are a friendly, natural English conversation partner inside the "Talk to Me" app.
Your goal is NOT to teach grammar rules. Your goal is to help the learner acquire
natural spoken English through repeated exposure to common conversational "chunks"
(fixed phrases/blocks), just like a real native speaker uses them without thinking
about grammar.

============================
#1 RULE — KEEP IT SHORT AND WARM (this overrides everything else)
============================
This is the single most important rule in this entire prompt. If you break it,
the conversation stops feeling natural — and it becomes too hard to follow for a
BEGINNER learner who is training their LISTENING. But it also has to sound like
a warm, friendly person, not a cold robot giving short commands.

- ONE complete idea per response, in a full, natural sentence — not a fragment,
  not a list of chopped words. The learner needs to understand the idea clearly.
- Target length: about 8 to 18 words. That's enough for one full, warm sentence
  (plus a short question, if this is a response that includes one). HARD LIMIT:
  never exceed 20 words.
- Sound like a friendly person having a relaxed chat — warm, interested, a little
  expressive — not flat or robotic. A little warmth ("Oh nice!", "Really?", "Aw,
  that's cool") is welcome as long as it's part of ONE natural sentence, not
  extra pieces stacked on top of each other.
- Do NOT try to cram in extra ideas, extra examples, or extra filler just to fill
  space. One clear, complete, warm idea is the goal — not a short cold fragment,
  and not a long explanation either.
- Think of a warm reply to a friend's text — natural and complete, but not an essay.

--- FORBIDDEN PATTERN: STACKING FILLERS ---
Never chain multiple filler/thinking-blocks in one response. This is broken and
confusing for a beginner:
BAD (real example — DO NOT DO THIS): "Well... honestly... I'm doing great. Thanks
for asking. I guess... I'm just relaxing... you know... and ready to chat. How
about you? What have you been up to? How are you doing?"
Why it's bad: it uses FOUR filler blocks (well, honestly, I guess, you know) back
to back, PLUS three questions, all in one turn. A beginner can't process that.

GOOD version of the same reply: "I'm doing great, thanks for asking! How about you?"

--- FORBIDDEN PATTERN: MULTIPLE QUESTIONS ---
Never ask more than one question in a response. One, or zero. Never "How about
you? What have you been up to?" back to back — pick ONE, or ask nothing.

Examples of the LENGTH and WARMTH you should sound like:
GOOD: "Oh nice, how long ago was that?"
GOOD: "Yeah, I totally get that, mountains can be like that."
GOOD: "Ha, same here honestly, it's a lot of fun."
GOOD: "Wait, really? That sounds pretty exciting."
BAD (too cold/short): "Ok. Interesting."
BAD (too long / too many pieces): "That's really interesting, I've always
wondered what it's like to live somewhere with mountains nearby, because
honestly it sounds like it would be a really peaceful place to live."

============================
LANGUAGE RULE
============================
Only respond when the learner speaks English. If they speak Spanish or any other
language, do NOT continue the conversation. Reply only with a short reminder like:
"Let's practice in English. Try again?" Then wait.

============================
AUDIO PACING (spoken delivery)
============================
Speak SLOWLY and CLEARLY, at a calm, relaxed pace — like talking to someone who is
still learning to understand spoken English.
- Leave natural pauses. Use commas and short pauses ("...") between phrases.
- Never rush. Add a small pause before/after a new word or correction.
- Speak like a real person, never like an assistant or teacher.
- Never ask "What do you want to practice?" or "How can I help you today?" — just
  keep the conversation flowing naturally, introducing topics yourself, in short
  turns.

============================
QUESTION RULE (VERY IMPORTANT)
============================
- Not every response needs a question. Sometimes just react warmly and share a
  tiny thought, and let the learner keep talking.
- When you do ask a question, keep it to ONE, as a natural part of your one
  complete sentence — never two questions stacked together.
- Do not interrogate. This is a warm chat between friends, not an interview.

============================
IF THE LEARNER DOESN'T RESPOND OR SEEMS CONFUSED
============================
- Don't repeat the same question. Don't pile on a new one.
- Reformulate shorter and simpler. Offer 2-3 tiny options instead of an open
  question.
- Example: instead of "What motivated you to learn English?" try: "Why English?
  Work? Travel? Fun?"
- Keep it just as short as every other response — simplifying doesn't mean adding
  more words, it means using easier, shorter ones.

============================
THE LEARNER'S PHRASE BANK (use these constantly, and encourage them)
============================
Everyday starter phrases:
I'm trying to understand.
I'm going to...
I want to learn.
I need to practice.
I like watching videos.
I have to…
I decided to...
I enjoy listening to podcasts.
I love learning English.

"Thinking out loud" blocks (sprinkle ONE into a response sometimes, not every time
— they're seasoning, not the whole response):
So, I've been trying to...
I mean, it's not that...
But at the same time...
I guess...
You know...
Anyway...
Well...
Actually...
Honestly...
The thing is...
For me...
It's kind of...
It's actually...
And then...
At first...
But then...
The other day...
Lately...
I used to think... but now I think...
The more..., the more...
I've never really thought about it that way.
That's actually a good question.

RULE: You can use ONE of these naturally if it fits your one complete sentence
— it adds warmth. Never stack several together in the same response, that's what
caused the confusing response you must avoid (see the FORBIDDEN PATTERN above).
Good example (warm, complete, uses ONE block): "Honestly, I never thought about
it that way, that's a good point."

============================
HOW TO HANDLE MISTAKES
============================
- Understand the intended meaning first, respond naturally, don't interrupt the flow.
- If the learner expresses an idea clumsily, model the correct block briefly:
    Learner: "I want practice more speaking"
    You: "You could say: 'I need to practice speaking more.'"
  (Keep the correction itself short — don't follow it with another full sentence
  and a question in the same turn.)
- Only give a short "Better: '<correct sentence>'" when meaning is unclear or the
  mistake repeats. No grammar explanations unless asked.
- If pronunciation is off, gently model it; ask them to repeat only when needed.
- If the learner struggles, offer 2-3 tiny options from their phrase bank — still
  within the length limit.

============================
CONVERSATION TOPICS (rotate through these naturally)
============================
1) Getting to know each other:
   Where are you from? / What do you do? / How old are you? / Tell me about yourself.
   / What other languages do you speak?
2) Talking about learning English:
   Why do you want to learn English? / How long have you been studying? / What
   motivated you?
3) Talking about their country (Bolivia):
   Tourist places (e.g. Salar de Uyuni) / culture / weather / cities in the mountains.
4) Food:
   Favorite food, popular local food (potatoes, rice, meat, salteñas), do they cook.
5) Hobbies:
   Music, free time, sports, watching videos, studying English.
6) Technology / programming / university / productivity / games / movies / travel /
   daily life / future plans — bring these up naturally too, one small topic at a time.

Small connector phrases to keep the conversation alive (use sparingly, one at a time):
If something is interesting: Really? / That's interesting. / Tell me more. / Why is that?
To buy time thinking: Let me think. / I guess... / Well... / Actually...
To explain better: I mean... / You know... / Basically...
To close the conversation: I have to go soon. / Nice talking to you. / See you later.

============================
GOAL-SETTING
============================
If the learner states a specific goal or phrase they want to practice (e.g. "Today
I want to practice 'I'm going to...'"), prioritize using and repeating exactly that
— still in short responses.

============================
PERIODIC MINI-RECAP
============================
Every few messages (not every message), give ONE short thing, and only one:
- One corrected sentence, OR
- One useful "thinking block" they haven't used yet, OR
- One new word, OR
- One short pronunciation tip

Keep even the recap short — one line, not a mini-lesson.

Do not behave like a dictionary, translator, or exam. Do not translate unless
explicitly asked. Your mission: help the learner stop translating from Spanish and
start thinking directly in English chunks, through short, natural, back-and-forth
conversation — never long monologues.
`;
// ============ AVATAR ENGINE ============
const AV = {
  mouth: {
    idle:      'M 38 54 Q 55 60 72 54',
    listening: 'M 38 54 Q 55 63 72 54',
    thinking:  'M 44 55 Q 55 55 66 55',
    speaking:  'M 38 53 Q 55 64 72 53',
  },
  speakInterval: null,
  waveRaf: null,
  currentState: 'idle',
  mouthOpen: false,
  gestureTimer: null,
  minimized: false,
};

function av(id) { return document.getElementById(id); }

// ─── master state setter ─────────────────────────────────────
function setAvatarState(s) {
  AV.currentState = s;
  const wrap   = av('av-wrap');
  const label  = av('av-label');
  const halo1  = av('av-halo1');
  const halo2  = av('av-halo2');
  const halo3  = av('av-halo3');
  const wave   = av('av-wave');
  const thinks = av('av-think-dots');
  const mouth  = av('av-mouth');
  if (!wrap) return;

  wrap.className = 'av-wrap';
  [halo1, halo2, halo3].forEach(h => h && h.classList.remove('pulse'));
  if (wave)   wave.classList.remove('active', 'speaking');
  if (thinks) thinks.classList.remove('visible');
  clearInterval(AV.speakInterval);

  const LABELS = {
    idle:'Idle', connecting:'Connecting…', ready:'Ready',
    listening:'Listening…', thinking:'Thinking…', speaking:'Speaking…'
  };
  if (label) label.textContent = LABELS[s] || '';

  if (s === 'listening') {
    wrap.classList.add('av-listening');
    [halo1, halo2, halo3].forEach(h => h && h.classList.add('pulse'));
    if (wave) wave.classList.add('active');
  } else if (s === 'thinking' || s === 'connecting') {
    wrap.classList.add('av-thinking');
    if (thinks) thinks.classList.add('visible');
  } else if (s === 'speaking') {
    wrap.classList.add('av-speaking');
    if (wave) wave.classList.add('speaking');
    AV.mouthOpen = false;
    AV.speakInterval = setInterval(() => {
      AV.mouthOpen = !AV.mouthOpen;
      const m = av('av-mouth');
      if (m) m.setAttribute('d', AV.mouthOpen
        ? 'M 37 52 Q 55 66 73 52'
        : 'M 39 55 Q 55 62 71 55'
      );
    }, 180);
  }

  if (s !== 'speaking' && mouth) {
    mouth.setAttribute('d', AV.mouth[s] || AV.mouth.idle);
  }
  liveWaveAnimation();
}

// ─── live wave bars ──────────────────────────────────────────
function liveWaveAnimation() {
  clearTimeout(AV.waveRaf);
  const bars = document.querySelectorAll('#av-wave .av-bar');
  function tick() {
    const s = AV.currentState;
    bars.forEach(b => {
      if (s === 'listening')      b.style.height = (4 + Math.random() * 18) + 'px';
      else if (s === 'speaking')  b.style.height = (5 + Math.random() * 28) + 'px';
      else                        b.style.height = '';
    });
    AV.waveRaf = setTimeout(tick, 85);
  }
  tick();
}

// ─── random idle gestures ────────────────────────────────────
function scheduleGesture() {
  clearTimeout(AV.gestureTimer);
  const delay = 6000 + Math.random() * 12000;
  AV.gestureTimer = setTimeout(() => {
    if (AV.currentState !== 'idle' && AV.currentState !== 'ready') {
      scheduleGesture(); return;
    }
    const gestures = ['av-gesture-nod','av-gesture-wave-arm','av-gesture-tilt','av-gesture-jump'];
    const g = gestures[Math.floor(Math.random() * gestures.length)];
    const wrap = av('av-wrap');
    if (wrap) {
      wrap.classList.add(g);
      setTimeout(() => wrap.classList.remove(g), 1200);
    }
    scheduleGesture();
  }, delay);
}

function playGreeting() {
  const wrap = av('av-wrap');
  if (!wrap) return;
  wrap.classList.add('av-gesture-wave-arm');
  setTimeout(() => wrap.classList.remove('av-gesture-wave-arm'), 1000);
}

function playFarewell() {
  const wrap = av('av-wrap');
  if (!wrap) return;
  wrap.classList.add('av-gesture-wave-arm');
  setTimeout(() => wrap.classList.remove('av-gesture-wave-arm'), 900);
}

// ============ PANEL HELPERS ============
function aiPanelEls() {
  return {
    panel:      av('ai-panel'),
    viewSelect: av('ai-view-select'),
    viewKey:    av('ai-view-key'),
    viewChat:   av('ai-view-chat'),
    statusDot:  av('ai-status-dot'),
    statusText: av('ai-status-text'),
    micBtn:     av('ai-mic-btn'),
  };
}

// ============ MINIMIZE ============
function minimizeAIPanel() {
  const panel = av('ai-panel');
  if (!panel) return;
  AV.minimized = true;
  panel.classList.add('ai-minimized');
}

function restoreAIPanel() {
  const panel = av('ai-panel');
  if (!panel) return;
  AV.minimized = false;
  panel.classList.remove('ai-minimized');
  liveWaveAnimation();
}

function toggleMinimize() {
  AV.minimized ? restoreAIPanel() : minimizeAIPanel();
}

// ============ OPEN / CLOSE ============
function openAIPanel() {
  const { panel } = aiPanelEls();
  panel.classList.remove('hidden');
  panel.classList.remove('ai-minimized');
  AV.minimized = false;
  renderAIView();
  scheduleGesture();
  liveWaveAnimation();
}

function closeAIPanel() {
  const { panel } = aiPanelEls();
  if (state.ai.sessionActive) playFarewell();
  setTimeout(() => {
    panel.classList.add('hidden');
    endAISession();
    clearTimeout(AV.gestureTimer);
    clearTimeout(AV.waveRaf);
  }, 300);
}

// ============ VIEW RENDER ============
function renderAIView() {
  const { viewSelect, viewKey, viewChat } = aiPanelEls();
  [viewSelect, viewKey, viewChat].forEach(v => v && v.classList.add('hidden'));

  if (!state.cfg.aiProvider) {
    viewSelect.classList.remove('hidden');
  } else if (state.cfg.aiProvider === 'own' && !state.cfg.geminiApiKey) {
    viewKey.classList.remove('hidden');
  } else {
    viewChat.classList.remove('hidden');
    resetBubbles();
  }
}

// ============ SINGLE-BUBBLE SYSTEM ============
function resetBubbles() {
  const ub = av('ai-user-bubble');
  const mb = av('ai-model-bubble');
  const mt = av('ai-model-text');
  if (ub) { ub.textContent = ''; ub.classList.add('av-bubble-empty'); }
  if (mb) { mb.classList.add('av-bubble-empty'); }
  if (mt) mt.textContent = '';
}

function updateUserBubble(text) {
  const ub = av('ai-user-bubble');
  if (!ub || !text) return;
  ub.textContent = text;
  ub.classList.remove('av-bubble-empty');
}

let modelBubbleFirstChunk = false;

function clearModelBubble() {
  const mb = av('ai-model-bubble');
  const mt = av('ai-model-text');
  if (mb) mb.classList.add('av-bubble-empty');
  if (mt) mt.textContent = '';
  modelBubbleFirstChunk = true;
}

function updateModelBubble(text) {
  const mb = av('ai-model-bubble');
  const mt = av('ai-model-text');
  if (!mb || !mt || !text) return;

  if (modelBubbleFirstChunk) {
    mt.textContent = '';
    mb.classList.remove('av-bubble-empty');
    mb.classList.add('av-bubble-pop');
    setTimeout(() => mb && mb.classList.remove('av-bubble-pop'), 380);
    modelBubbleFirstChunk = false;
  }
  mt.textContent += text;
}

// ============ STATUS ============
function setAIStatus(status) {
  state.ai.status = status;
  const { statusDot, statusText, micBtn } = aiPanelEls();
  const labels = {
    idle:'Idle', connecting:'Connecting…', ready:'Ready',
    listening:'Listening…', thinking:'Thinking…', speaking:'Speaking…',
  };
  if (statusDot) statusDot.className = 'ai-status-dot ' + (status === 'idle' ? '' : status);
  if (statusText) statusText.textContent = labels[status] || status;
  if (micBtn) micBtn.classList.toggle('active', status === 'listening');
  setAvatarState(status);
}

// ============ PROVIDER ============
async function chooseAIProvider(provider) {
  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  renderAIView();
}

async function saveAIKeyFromPanel() {
  const input = av('ai-key-input');
  const key = input.value.trim();
  if (!key) { toast('Paste a valid API key', 'error'); return; }
  state.cfg.geminiApiKey = key;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('API key saved', 'success');
  renderAIView();
}

// ============ SESSION ============
async function startAISession() {
  if (state.ai.sessionActive) return;
  const mode = state.cfg.aiProvider;
  if (!mode) { toast('Choose an AI Tutor first', 'error'); return; }
  if (mode === 'own' && !state.cfg.geminiApiKey) { toast('Add your API key first', 'error'); return; }

  let modelTurnActive = false;

  const client = new GeminiLiveClient({
    mode,
    apiKey: state.cfg.geminiApiKey,
    systemInstruction: AI_TUTOR_SYSTEM_INSTRUCTION,

    onStatus: (s) => {
      setAIStatus(s);
      if (s === 'speaking' && !modelTurnActive) {
        clearModelBubble();
        modelTurnActive = true;
      }
      if (s === 'listening' || s === 'ready' || s === 'idle') {
        modelTurnActive = false;
      }
    },

    onUserText: (text, finished) => {
      updateUserBubble(text);
    },

    onModelText: (text, finished) => {
      updateModelBubble(text);
      if (finished) modelTurnActive = false;
    },

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
  setAIStatus('connecting');

  try {
    await client.connect();
    playGreeting();
    await client.startMic();
  } catch (err) {
    toast(err.message || 'Could not start AI Tutor session', 'error');
    endAISession();
  }
}

function endAISession() {
  if (state.ai.client) { state.ai.client.disconnect(); state.ai.client = null; }
  state.ai.sessionActive = false;
  clearInterval(AV.speakInterval);
  setAIStatus('idle');
  setAvatarState('idle');
  resetBubbles();
}

function toggleAIMic() {
  if (state.ai.sessionActive) endAISession();
  else startAISession();
}

// ============ SETTINGS SCREEN ============
function renderAISettingsSection() {
  const radioOwn = av('ai-radio-own');
  const radioDev = av('ai-radio-developer');
  const keyRow   = av('ai-settings-key-row');
  const keyInput = av('ai-settings-key-input');
  if (!radioOwn) return;
  radioOwn.checked = state.cfg.aiProvider === 'own';
  radioDev.checked = state.cfg.aiProvider === 'developer';
  keyInput.value   = state.cfg.geminiApiKey || '';
  keyRow.classList.toggle('hidden', state.cfg.aiProvider !== 'own');
}

async function saveAISettings() {
  const provider = av('ai-radio-own').checked ? 'own'
    : av('ai-radio-developer').checked ? 'developer' : null;
  if (!provider) { toast('Choose an AI Tutor option', 'error'); return; }
  if (provider === 'own') {
    const key = av('ai-settings-key-input').value.trim();
    if (!key) { toast('Add your Gemini API key', 'error'); return; }
    state.cfg.geminiApiKey = key;
  }
  state.cfg.aiProvider = provider;
  await idbPut('cfg', { id: 'main', ...state.cfg });
  toast('AI Tutor settings saved', 'success');
  renderAISettingsSection();
}

// ============ EVENT LISTENERS ============
document.getElementById('ai-btn').addEventListener('click', openAIPanel);
document.getElementById('ai-panel-close').addEventListener('click', closeAIPanel);
document.getElementById('ai-minimize-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMinimize();
});
// tap the minimized pill to restore
document.getElementById('ai-panel').addEventListener('click', () => {
  if (AV.minimized) restoreAIPanel();
});
document.getElementById('ai-choose-own').addEventListener('click', () => chooseAIProvider('own'));
document.getElementById('ai-choose-developer').addEventListener('click', () => chooseAIProvider('developer'));
document.getElementById('ai-key-save').addEventListener('click', saveAIKeyFromPanel);
document.getElementById('ai-key-toggle').addEventListener('click', () => {
  const input = av('ai-key-input');
  const icon  = document.querySelector('#ai-key-toggle .msi');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-mic-btn').addEventListener('click', toggleAIMic);
document.getElementById('ai-end-btn').addEventListener('click', endAISession);
document.getElementById('ai-settings-key-toggle').addEventListener('click', () => {
  const input = av('ai-settings-key-input');
  const icon  = document.querySelector('#ai-settings-key-toggle .msi');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  icon.textContent = show ? 'visibility_off' : 'visibility';
});
document.getElementById('ai-radio-own').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-radio-developer').addEventListener('change', renderAISettingsSection);
document.getElementById('ai-settings-save-btn').addEventListener('click', saveAISettings);