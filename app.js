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
// COLOR HELPERS — false-ink → brass → true-ink
// ════════════════════════════════════════
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, r) { return Math.round(a + (b - a) * r); }
function colorForRatio(ratio) {
  const falseInk = hexToRgb('#7a3b34');
  const brass = hexToRgb('#8c6a2f');
  const trueInk = hexToRgb('#35604e');
  const from = ratio <= 0.5 ? falseInk : brass;
  const to = ratio <= 0.5 ? brass : trueInk;
  const t = ratio <= 0.5 ? ratio / 0.5 : (ratio - 0.5) / 0.5;
  const rgb = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// ════════════════════════════════════════
// SCORING (Brier-style proper scoring rule)
// p = 0.5..1.0 confidence in the chosen direction, safe "no idea" floor is 75
// ════════════════════════════════════════
function computeScore(v, actualTrue) {
  const p = 0.5 + Math.abs(v) / 200;
  const abstain = v === 0;
  const guessTrue = abstain ? null : v > 0;
  const correct = abstain ? null : guessTrue === actualTrue;
  const o = abstain ? 1 : (correct ? 1 : 0);
  const points = Math.round((1 - Math.pow(p - o, 2)) * 100);
  return { p, points, correct, abstain, guessTrue };
}

function getVerdictKey(result) {
  if (result.abstain) return 'abstain';
  if (result.correct) {
    if (result.p >= 0.85) return 'confidentCorrect';
    if (result.p < 0.65) return 'cautiousCorrect';
    return 'correct';
  }
  if (result.p >= 0.85) return 'confidentWrong';
  if (result.p < 0.65) return 'cautiousWrong';
  return 'wrong';
}

// Overconfident/underconfident bands are a pilot heuristic, not a statistical threshold —
// tuned so a single lucky/unlucky answer out of 15 doesn't flip the archetype.
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
  const body = JSON.stringify({ type, ts: Date.now(), ...payload });
  fetch(CONFIG.SHEETS_WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
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
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

function setLang(lang) {
  STATE.lang = lang;
  localStorage.setItem('calib_lang', lang);
  document.documentElement.lang = lang;
  document.getElementById('langBtnRu').classList.toggle('active', lang === 'ru');
  document.getElementById('langBtnEn').classList.toggle('active', lang === 'en');
  applyStartI18n();
}

function applyStartI18n() {
  const lang = STATE.lang;
  document.getElementById('startTitle').textContent = t(lang, 'brand');
  document.getElementById('startTagline').textContent = t(lang, 'startTagline');
  document.getElementById('startDesc').textContent = t(lang, 'startDesc');
  document.getElementById('howTitle').textContent = t(lang, 'howTitle');
  document.getElementById('how1').textContent = t(lang, 'how1');
  document.getElementById('how2').textContent = t(lang, 'how2');
  document.getElementById('how3').textContent = t(lang, 'how3');
  document.getElementById('startBtn').textContent = t(lang, 'startBtn');
}

// ════════════════════════════════════════
// GAME FLOW
// ════════════════════════════════════════
function startGame() {
  STATE.answers = [];
  STATE.current = 0;
  STATE.sessionId = makeSessionId();
  document.getElementById('topWordmark').textContent = t(STATE.lang, 'brand');
  show('feedScreen');
  renderReading(0);
  logEvent('start', { sessionId: STATE.sessionId, playerId: STATE.playerId, lang: STATE.lang });
}

function updateHeader(index) {
  document.getElementById('topProgress').textContent = `${String(index + 1).padStart(2, '0')} / ${QUESTIONS.length}`;
  document.getElementById('topProgressFill').style.width = (index / QUESTIONS.length) * 100 + '%';
}

const TICK_COUNT = 20; // 21 ticks, every 5%

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

function readingTemplate(q, index, lang) {
  const catName = CATEGORY_NAMES[q.category][lang];
  const isFirst = index === 0;
  return `
  <div class="reading-inner" id="readingInner">
    <div class="reading-tag">${catName}</div>
    <blockquote class="reading-statement">${q[lang].statement}</blockquote>
    <div class="gauge">
      <div class="gauge-readout-wrap"><div class="gauge-readout" id="gaugeReadout" style="left:50%">${t(lang, 'notSure')}</div></div>
      <div class="gauge-track" id="gaugeTrack">
        <div class="gauge-baseline"></div>
        <div class="gauge-ticks">${ticksHTML()}</div>
        <div class="gauge-needle" id="gaugeNeedle" style="left:50%"></div>
      </div>
      <div class="gauge-labels"><span>${t(lang, 'falseLabel')}</span><span>${t(lang, 'trueLabel')}</span></div>
      ${isFirst ? `<div class="drag-hint" id="dragHint">${t(lang, 'dragHint')}</div>` : ''}
    </div>
    <button class="lock-btn" id="lockBtn">${t(lang, 'lockInBtn')}</button>
  </div>`;
}

function renderReading(index) {
  const q = QUESTIONS[index];
  const panel = document.getElementById('readingPanel');
  panel.innerHTML = readingTemplate(q, index, STATE.lang);
  updateHeader(index);
  attachGaugeHandlers(index);
}

function attachGaugeHandlers(index) {
  const q = QUESTIONS[index];
  const track = document.getElementById('gaugeTrack');
  const needle = document.getElementById('gaugeNeedle');
  const readout = document.getElementById('gaugeReadout');
  const lockBtn = document.getElementById('lockBtn');
  let v = 0;
  let locked = false;
  let lastHapticLevel = 0;
  const HAPTIC_LEVELS = [60, 75, 90];

  function updateVisuals() {
    const pos = (v + 100) / 2;
    needle.style.left = pos + '%';
    readout.style.left = Math.min(94, Math.max(6, pos)) + '%';
    const color = colorForRatio(pos / 100);
    needle.style.background = color;
    readout.style.color = color;
    readout.textContent = v === 0 ? t(STATE.lang, 'notSure') : `${Math.round(50 + Math.abs(v) / 2)}% ${v > 0 ? t(STATE.lang, 'trueLabel') : t(STATE.lang, 'falseLabel')}`;
  }

  function maybeVibrate() {
    if (!navigator.vibrate) return;
    const confidence = 50 + Math.abs(v) / 2;
    let level = 0;
    for (const l of HAPTIC_LEVELS) if (confidence >= l) level = l;
    if (level !== lastHapticLevel) navigator.vibrate(10);
    lastHapticLevel = level;
  }

  function setFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v = Math.round(ratio * 200 - 100);
    updateVisuals();
    maybeVibrate();
  }

  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    if (locked) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    const hint = document.getElementById('dragHint');
    if (hint) hint.style.display = 'none';
    setFromClientX(e.clientX);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setFromClientX(e.clientX);
  });
  const endDrag = () => { dragging = false; };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  lockBtn.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    track.style.pointerEvents = 'none';
    lockBtn.classList.add('is-captured');
    lockBtn.textContent = t(STATE.lang, 'capturedLabel');
    commitAnswer(index, v);
  });

  updateVisuals();
}

function commitAnswer(index, v) {
  const q = QUESTIONS[index];
  const result = computeScore(v, q.answer);
  STATE.answers.push({ index, v, ...result });

  logEvent('answer', {
    sessionId: STATE.sessionId,
    playerId: STATE.playerId,
    lang: STATE.lang,
    questionId: q.id,
    category: q.category,
    sliderValue: v,
    confidence: result.p,
    guessTrue: result.guessTrue,
    actualTrue: q.answer,
    correct: result.correct,
    abstain: result.abstain,
    points: result.points,
  });

  const inner = document.getElementById('readingInner');
  const isLast = index + 1 >= QUESTIONS.length;
  setTimeout(() => {
    inner.classList.add('leaving');
    setTimeout(() => {
      if (isLast) {
        showResults();
      } else {
        STATE.current = index + 1;
        renderReading(STATE.current);
      }
    }, 150);
  }, 450);
}

function renderCalibChart(lang, answers) {
  const buckets = [
    [50, 65],
    [65, 80],
    [80, 90],
    [90, 100],
  ];
  const rows = [];
  buckets.forEach(([lo, hi]) => {
    const inBucket = answers.filter((a) => {
      if (a.abstain) return false;
      const pct = Math.round(a.p * 100);
      return hi === 100 ? pct >= lo && pct <= hi : pct >= lo && pct < hi;
    });
    if (!inBucket.length) return;
    const real = Math.round((inBucket.filter((a) => a.correct).length / inBucket.length) * 100);
    rows.push(`
      <div class="cert-chart-row">
        <div class="cert-chart-row-text">${t(lang, 'chartRow')(lo, hi, real)}</div>
        <div class="cert-chart-bar-track"><div class="cert-chart-bar-fill" style="width:${real}%"></div></div>
      </div>`);
  });
  const chart = document.getElementById('calibChart');
  if (rows.length) {
    document.getElementById('chartTitle').textContent = t(lang, 'chartTitle');
    document.getElementById('calibChartRows').innerHTML = rows.join('');
    chart.style.display = 'block';
  } else {
    chart.style.display = 'none';
  }
}

function certRowHTML(a, lang) {
  const q = QUESTIONS[a.index];
  const catName = CATEGORY_NAMES[q.category][lang];
  const betText = a.abstain
    ? t(lang, 'notSure')
    : `${Math.round(a.p * 100)}% ${a.guessTrue ? t(lang, 'trueLabel') : t(lang, 'falseLabel')}`;
  const truthText = q.answer ? t(lang, 'trueLabel') : t(lang, 'falseLabel');
  const stampClass = a.abstain ? 'honest' : a.correct ? 'hit' : 'miss';
  const stampWord = t(lang, 'stamps')[a.abstain ? 'honest' : a.correct ? 'hit' : 'miss'];
  const explainIntro = q.answer ? t(lang, 'correctAnswerTrue') : t(lang, 'correctAnswerFalse');
  const remark = t(lang, 'verdicts')[getVerdictKey(a)];

  return `
  <div class="cert-row">
    <div class="cert-row-head">
      <span class="cert-row-index">${String(a.index + 1).padStart(2, '0')}</span>
      <span class="cert-row-tag">${catName}</span>
    </div>
    <div class="cert-row-statement">${q[lang].statement}</div>
    <div class="cert-row-data">
      <span>${t(lang, 'colBet')}: <b>${betText}</b></span>
      <span>${t(lang, 'colTruth')}: <b>${truthText}</b></span>
      <span>${t(lang, 'colScore')}: <b>${a.points}</b></span>
      <span class="stamp ${stampClass}">${stampWord}</span>
    </div>
    <div class="cert-row-remark">${remark}.</div>
    <div class="cert-row-explain">${explainIntro} ${q[lang].explain}</div>
  </div>`;
}

function showResults() {
  const lang = STATE.lang;
  const answers = STATE.answers;
  const total = answers.length;
  const correctCount = answers.filter((a) => a.correct === true).length;
  const avgPoints = Math.round(answers.reduce((s, a) => s + a.points, 0) / total);
  const meanConfidence = answers.reduce((s, a) => s + a.p, 0) / total;
  const accuracyFrac = correctCount / total;
  const archetypeKey = computeArchetype(meanConfidence, accuracyFrac);
  const archetype = t(lang, 'archetypes')[archetypeKey];

  show('resultScreen');
  document.getElementById('certSerial').textContent = `${t(lang, 'certSerialLabel')} ${STATE.sessionId.slice(2, 8).toUpperCase()}`;
  document.getElementById('certTitleText').textContent = t(lang, 'certTitle');
  document.getElementById('resultTitleLabel').textContent = t(lang, 'resultTitle');
  document.getElementById('resultScoreValue').textContent = avgPoints + '%';
  document.getElementById('archetypeStamp').textContent = archetype.title;
  document.getElementById('accuracyLabel').textContent = t(lang, 'accuracyLabel');
  document.getElementById('accuracyValue').textContent = `${correctCount}/${total}`;
  document.getElementById('calibrationLabel').textContent = t(lang, 'calibrationLabel');
  document.getElementById('calibValue').textContent = avgPoints + '%';
  document.getElementById('archetypeDesc').textContent = archetype.desc;
  renderCalibChart(lang, answers);
  document.getElementById('logLabel').textContent = t(lang, 'logLabel');
  document.getElementById('certTable').innerHTML = answers.map((a) => certRowHTML(a, lang)).join('');
  document.getElementById('shareBtn').textContent = t(lang, 'shareBtn');
  document.getElementById('restartBtn').textContent = t(lang, 'restartBtn');

  STATE.lastResult = { avgPoints, archetypeTitle: archetype.title };

  logEvent('summary', {
    sessionId: STATE.sessionId,
    playerId: STATE.playerId,
    lang,
    accuracy: accuracyFrac,
    calibrationScore: avgPoints,
    archetype: archetypeKey,
    meanConfidence,
  });
}

async function handleShare() {
  const lang = STATE.lang;
  const text = t(lang, 'shareText')(STATE.lastResult.avgPoints, STATE.lastResult.archetypeTitle);
  if (navigator.share) {
    try {
      await navigator.share({ text, title: t(lang, 'brand') });
    } catch (e) {
      /* user cancelled share sheet — no-op */
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    toast(t(lang, 'shareCopied'));
  }
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  STATE.playerId = getPlayerId();
  setLang(localStorage.getItem('calib_lang') || 'ru');
  document.getElementById('langBtnRu').addEventListener('click', () => setLang('ru'));
  document.getElementById('langBtnEn').addEventListener('click', () => setLang('en'));
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('shareBtn').addEventListener('click', handleShare);
});
