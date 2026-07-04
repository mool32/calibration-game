// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
const STATE = {
  lang: 'ru',
  current: 0,
  answers: [],
  playerId: null,
  sessionId: null,
  lastResult: null,
};

// ════════════════════════════════════════
// COLOR — false-ink → brass → true-ink (matches the muted palette)
// ════════════════════════════════════════
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, r) { return Math.round(a + (b - a) * r); }
function colorForPos(pos /* 0..1 */) {
  const falseInk = hexToRgb('#a24a3c');
  const brass = hexToRgb('#9a6b2f');
  const trueInk = hexToRgb('#3a6b52');
  const from = pos <= 0.5 ? falseInk : brass;
  const to = pos <= 0.5 ? brass : trueInk;
  const k = pos <= 0.5 ? pos / 0.5 : (pos - 0.5) / 0.5;
  return `rgb(${lerp(from[0], to[0], k)},${lerp(from[1], to[1], k)},${lerp(from[2], to[2], k)})`;
}

// ════════════════════════════════════════
// SCORING
// v ∈ [-100,100]: sign = direction (right = true), magnitude = confidence.
// Brier is a strictly proper rule (honest confidence maximises expected score).
// We rescale per question to d = 2*brier - 100 so the run averages to an
// intuitive 0-100: all-abstain → 50, confident+right → 100, confident+wrong → 0.
// The rescale is affine, so properness is preserved.
// ════════════════════════════════════════
function computeAnswer(v, actualTrue) {
  const q = (v + 100) / 200;               // implied prob-true, 0..1
  const y = actualTrue ? 1 : 0;
  const brier = (1 - Math.pow(q - y, 2)) * 100;
  const d = 2 * brier - 100;               // -100..100
  const abstain = v === 0;
  const guessTrue = abstain ? null : v > 0;
  const correct = abstain ? null : guessTrue === actualTrue;
  const confidence = Math.round(50 + Math.abs(v) / 2); // 50..100
  return { v, d, abstain, guessTrue, correct, confidence, p: 0.5 + Math.abs(v) / 200 };
}

// Archetype: pilot heuristic tuned so one lucky/unlucky answer doesn't flip it.
function computeArchetype(meanConfidence, accuracyFrac) {
  const gap = meanConfidence - accuracyFrac;
  if (Math.abs(gap) < 0.08) return 'calibrated';
  if (gap >= 0.08) return 'overconfident';
  return meanConfidence < 0.65 ? 'underconfidentCautious' : 'underconfidentSharp';
}

// ════════════════════════════════════════
// DATA LOGGING (Google Apps Script webhook, see apps-script/Code.gs)
// ════════════════════════════════════════
function getPlayerId() {
  let id = localStorage.getItem('calib_player_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('calib_player_id', id);
  }
  return id;
}
function makeSessionId() {
  return 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}
function logEvent(type, payload) {
  if (!CONFIG.SHEETS_WEBAPP_URL) return;
  fetch(CONFIG.SHEETS_WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type, ts: Date.now(), ...payload }),
  }).catch(() => {});
}

// ════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}
function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1900);
}

// ════════════════════════════════════════
// GAUGE COMPONENT (shared: warm-up + readings)
// ════════════════════════════════════════
const TICK_COUNT = 20;
function ticksHTML() {
  let html = '';
  for (let i = 0; i <= TICK_COUNT; i++) {
    let cls = 'minor';
    if (i === 0 || i === TICK_COUNT / 2 || i === TICK_COUNT) cls = 'major';
    else if (i === TICK_COUNT / 4 || i === (TICK_COUNT * 3) / 4) cls = 'mid';
    html += `<div class="tick ${cls}"></div>`;
  }
  return html;
}

// Renders the gauge into `root` and wires dragging. Calls onSettle(v) the first
// time the user commits a value (pointer up after a real move). Returns { getValue, lock }.
function buildGauge(root, lang, onSettle) {
  const t = (k) => I18N[lang][k];
  root.innerHTML = `
    <div class="gauge-readout-wrap"><div class="gauge-readout">${t('notSure')}</div></div>
    <div class="gauge-track">
      <div class="gauge-baseline"></div>
      <div class="gauge-fill"></div>
      <div class="gauge-ticks">${ticksHTML()}</div>
      <div class="gauge-needle"></div>
    </div>
    <div class="gauge-labels"><span>${t('falseLabel')}</span><span>${t('trueLabel')}</span></div>`;

  const track = root.querySelector('.gauge-track');
  const needle = root.querySelector('.gauge-needle');
  const fill = root.querySelector('.gauge-fill');
  const readout = root.querySelector('.gauge-readout');
  let v = 0;
  let dragging = false;
  let moved = false;
  let locked = false;
  let lastHaptic = 0;

  function render() {
    const pos = (v + 100) / 2; // 0..100
    const color = colorForPos(pos / 100);
    needle.style.left = pos + '%';
    needle.style.background = color;
    readout.style.left = Math.min(94, Math.max(6, pos)) + '%';
    readout.style.color = v === 0 ? 'var(--ink-soft)' : color;
    readout.textContent = v === 0 ? t('notSure') : `${Math.round(50 + Math.abs(v) / 2)}% ${v > 0 ? t('trueLabel') : t('falseLabel')}`;
    // bet-fill from centre to needle
    if (v === 0) {
      fill.style.width = '0';
    } else if (v > 0) {
      fill.style.left = '50%';
      fill.style.width = (pos - 50) + '%';
      fill.style.background = color;
    } else {
      fill.style.left = pos + '%';
      fill.style.width = (50 - pos) + '%';
      fill.style.background = color;
    }
  }

  function haptic() {
    if (!navigator.vibrate) return;
    const conf = 50 + Math.abs(v) / 2;
    let level = 0;
    for (const l of [60, 75, 90]) if (conf >= l) level = l;
    if (level !== lastHaptic) navigator.vibrate(9);
    lastHaptic = level;
  }

  function setFromX(clientX) {
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v = Math.round(ratio * 200 - 100);
    render();
    haptic();
  }

  track.addEventListener('pointerdown', (e) => {
    if (locked) return;
    dragging = true;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    setFromX(e.clientX);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging || locked) return;
    moved = true;
    setFromX(e.clientX);
  });
  function end() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    if (moved && onSettle) onSettle(v);
  }
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  render();
  return {
    getValue: () => v,
    lock: () => { locked = true; track.style.pointerEvents = 'none'; track.style.cursor = 'default'; },
  };
}

// ════════════════════════════════════════
// PER-FACT REVEAL (warm-up + certificate share the same shape)
// ════════════════════════════════════════
function revealInnerHTML(item, ans, lang) {
  const t = (k) => I18N[lang][k];
  const truthBadge = item.answer
    ? `<span class="badge is-true">${t('badgeTrue')}</span>`
    : `<span class="badge is-false">${t('badgeFalse')}</span>`;
  let outcome, resultLine;
  if (ans.abstain) {
    outcome = `<span class="reveal-outcome">—</span>`;
    resultLine = t('youAbstained');
  } else {
    const dir = ans.guessTrue ? t('trueLabel') : t('falseLabel');
    outcome = ans.correct
      ? `<span class="reveal-outcome right">✓</span>`
      : `<span class="reveal-outcome wrong">✗</span>`;
    resultLine = t('youResult')(dir, ans.confidence, ans.correct);
  }
  return `
    <div class="reveal-badge-row">${truthBadge}${outcome}</div>
    <div class="reveal-result-line">${resultLine}</div>
    <div class="reveal-explain">${item[lang].explain}</div>`;
}

// ════════════════════════════════════════
// WARM-UP (on the cover)
// ════════════════════════════════════════
let warmupGauge = null;
function renderWarmup() {
  const lang = STATE.lang;
  const t = (k) => I18N[lang][k];
  document.querySelector('.cover-title').textContent = t('brand').toUpperCase();
  document.getElementById('coverSubtitle').textContent = t('coverSubtitle');
  document.getElementById('warmupLabel').textContent = t('warmupLabel');
  document.getElementById('warmupHint').textContent = t('warmupHint');
  document.getElementById('warmupStatement').textContent = WARMUP[lang].statement;
  document.getElementById('startBtn').textContent = t('startBtn');

  const reveal = document.getElementById('warmupReveal');
  const startBtn = document.getElementById('startBtn');
  const hint = document.getElementById('warmupHint');
  reveal.hidden = true;
  startBtn.hidden = true;
  hint.style.visibility = 'visible';

  warmupGauge = buildGauge(document.getElementById('warmupGauge'), lang, (v) => {
    warmupGauge.lock();
    const ans = computeAnswer(v, WARMUP.answer);
    reveal.innerHTML = revealInnerHTML(WARMUP, ans, lang);
    reveal.hidden = false;
    hint.style.visibility = 'hidden';
    startBtn.hidden = false;
    logEvent('warmup', { sessionId: STATE.sessionId, playerId: STATE.playerId, lang, sliderValue: v, correct: ans.correct });
    startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ════════════════════════════════════════
// GAME FLOW
// ════════════════════════════════════════
function startGame() {
  STATE.answers = [];
  STATE.current = 0;
  STATE.sessionId = makeSessionId();
  document.getElementById('topWordmark').textContent = I18N[STATE.lang].brand;
  show('feedScreen');
  renderReading(0);
  logEvent('start', { sessionId: STATE.sessionId, playerId: STATE.playerId, lang: STATE.lang });
}

function updateHeader(index) {
  document.getElementById('topProgress').textContent = `${String(index + 1).padStart(2, '0')} / ${QUESTIONS.length}`;
  document.getElementById('topProgressFill').style.width = (index / QUESTIONS.length) * 100 + '%';
}

function renderReading(index) {
  const q = QUESTIONS[index];
  const lang = STATE.lang;
  const t = (k) => I18N[lang][k];
  const isLast = index + 1 >= QUESTIONS.length;
  const panel = document.getElementById('readingPanel');
  panel.innerHTML = `
    <div class="reading-inner" id="readingInner">
      <div class="reading-tag">${CATEGORY_NAMES[q.category][lang]}</div>
      <blockquote class="statement">${q[lang].statement}</blockquote>
      <div class="gauge" id="readingGauge"></div>
      <button class="lock-btn" id="lockBtn">${isLast ? t('finishBtn') : t('lockBtn')}</button>
    </div>`;
  updateHeader(index);

  const gauge = buildGauge(document.getElementById('readingGauge'), lang, null);
  document.getElementById('lockBtn').addEventListener('click', () => {
    gauge.lock();
    commitAnswer(index, gauge.getValue());
  }, { once: true });
}

function commitAnswer(index, v) {
  const q = QUESTIONS[index];
  const ans = computeAnswer(v, q.answer);
  STATE.answers.push({ index, ...ans });

  logEvent('answer', {
    sessionId: STATE.sessionId, playerId: STATE.playerId, lang: STATE.lang,
    questionId: q.id, category: q.category, sliderValue: v,
    confidence: ans.p, guessTrue: ans.guessTrue, actualTrue: q.answer,
    correct: ans.correct, abstain: ans.abstain, points: Math.round(ans.d),
  });

  const inner = document.getElementById('readingInner');
  const isLast = index + 1 >= QUESTIONS.length;
  inner.classList.add('leaving');
  setTimeout(() => {
    if (isLast) showResults();
    else { STATE.current = index + 1; renderReading(STATE.current); }
  }, 160);
}

// ════════════════════════════════════════
// RESULT
// ════════════════════════════════════════
function renderReliability(lang, answers) {
  const t = (k) => I18N[lang][k];
  const buckets = [[50, 65], [65, 80], [80, 90], [90, 100]];
  const rows = [];
  buckets.forEach(([lo, hi]) => {
    const inB = answers.filter((a) => {
      if (a.abstain) return false;
      return hi === 100 ? a.confidence >= lo && a.confidence <= hi : a.confidence >= lo && a.confidence < hi;
    });
    if (!inB.length) return;
    const real = Math.round((inB.filter((a) => a.correct).length / inB.length) * 100);
    rows.push(`
      <div class="reliability-row">
        <div class="reliability-row-text">${t('reliabilityRow')(lo, hi, real)}</div>
        <div class="reliability-bar-track"><div class="reliability-bar-fill" style="width:${real}%"></div></div>
      </div>`);
  });
  const block = document.getElementById('reliabilityBlock');
  if (rows.length) {
    document.getElementById('reliabilityTitle').textContent = t('reliabilityTitle');
    document.getElementById('reliabilityRows').innerHTML = rows.join('');
    block.hidden = false;
  } else {
    block.hidden = true;
  }
}

function factHTML(a, lang) {
  const q = QUESTIONS[a.index];
  const t = (k) => I18N[lang][k];
  const truthBadge = q.answer
    ? `<span class="badge is-true">${t('badgeTrue')}</span>`
    : `<span class="badge is-false">${t('badgeFalse')}</span>`;
  let outcome, resultLine;
  if (a.abstain) {
    outcome = `<span class="fact-outcome skip">—</span>`;
    resultLine = t('youAbstained');
  } else {
    const dir = a.guessTrue ? t('trueLabel') : t('falseLabel');
    outcome = a.correct ? `<span class="fact-outcome right">✓</span>` : `<span class="fact-outcome wrong">✗</span>`;
    resultLine = t('youResult')(dir, a.confidence, a.correct);
  }
  return `
    <div class="fact">
      <div class="fact-badge-row">${truthBadge}${outcome}</div>
      <div class="fact-statement">${q[lang].statement}</div>
      <div class="fact-result-line">${resultLine}</div>
      <div class="fact-explain">${q[lang].explain}</div>
    </div>`;
}

function showResults() {
  const lang = STATE.lang;
  const t = (k) => I18N[lang][k];
  const answers = STATE.answers;
  const total = answers.length;
  const correctCount = answers.filter((a) => a.correct === true).length;
  const meanD = answers.reduce((s, a) => s + a.d, 0) / total;
  const score = Math.max(0, Math.min(100, Math.round(meanD)));
  const meanConfidence = answers.reduce((s, a) => s + a.p, 0) / total;
  const accuracyFrac = correctCount / total;
  const archetypeKey = computeArchetype(meanConfidence, accuracyFrac);
  const archetype = t('archetypes')[archetypeKey];

  show('resultScreen');
  document.getElementById('resultKicker').textContent = t('resultKicker');
  document.getElementById('resultScoreValue').textContent = score + '%';
  document.getElementById('calibrationWord').textContent = t('calibrationWord');
  document.getElementById('scoreExplain').textContent = t('scoreExplain');
  document.getElementById('accuracyLine').textContent = t('accuracyLine')(correctCount, total);
  document.getElementById('profileLabel').textContent = t('profileLabel');
  document.getElementById('archetypeTitle').textContent = archetype.title;
  document.getElementById('archetypeDesc').textContent = archetype.desc;
  renderReliability(lang, answers);
  document.getElementById('factsTitle').textContent = t('factsTitle');
  document.getElementById('factsList').innerHTML = answers.map((a) => factHTML(a, lang)).join('');
  document.getElementById('shareBtn').textContent = t('shareBtn');
  document.getElementById('restartBtn').textContent = t('restartBtn');

  STATE.lastResult = { score, archetypeTitle: archetype.title };
  logEvent('summary', {
    sessionId: STATE.sessionId, playerId: STATE.playerId, lang,
    accuracy: accuracyFrac, calibrationScore: score, archetype: archetypeKey, meanConfidence,
  });
}

async function handleShare() {
  const lang = STATE.lang;
  const text = I18N[lang].shareText(STATE.lastResult.score, STATE.lastResult.archetypeTitle);
  if (navigator.share) {
    try { await navigator.share({ text, title: I18N[lang].brand }); } catch (e) { /* cancelled */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    toast(I18N[lang].shareCopied);
  }
}

// ════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════
function setLang(lang) {
  STATE.lang = lang;
  localStorage.setItem('calib_lang', lang);
  document.documentElement.lang = lang;
  document.getElementById('langBtnRu').classList.toggle('active', lang === 'ru');
  document.getElementById('langBtnEn').classList.toggle('active', lang === 'en');
  renderWarmup();
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  STATE.playerId = getPlayerId();
  STATE.sessionId = makeSessionId();
  setLang(localStorage.getItem('calib_lang') || 'ru');
  document.getElementById('langBtnRu').addEventListener('click', () => setLang('ru'));
  document.getElementById('langBtnEn').addEventListener('click', () => setLang('en'));
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('shareBtn').addEventListener('click', handleShare);
});
