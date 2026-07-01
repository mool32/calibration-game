// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
const STATE = {
  lang: 'ru',
  answers: [],
  playerId: null,
  sessionId: null,
  lastResult: null,
};

// ════════════════════════════════════════
// COLOR HELPERS (red → gray → green, matches slider gradient)
// ════════════════════════════════════════
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, r) { return Math.round(a + (b - a) * r); }
function colorForRatio(ratio) {
  const red = hexToRgb('#e5484d');
  const gray = hexToRgb('#b0b3b8');
  const green = hexToRgb('#30a46c');
  const from = ratio <= 0.5 ? red : gray;
  const to = ratio <= 0.5 ? gray : green;
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

function emojiForScore(score) {
  if (score >= 90) return '🛡️';
  if (score >= 75) return '🎯';
  if (score >= 60) return '🧭';
  if (score >= 40) return '🌀';
  return '🎲';
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

function updateProgress() {
  const n = STATE.answers.length;
  document.getElementById('topProgress').textContent = `${n} / ${QUESTIONS.length}`;
  document.getElementById('topProgressFill').style.width = (n / QUESTIONS.length) * 100 + '%';
}

// ════════════════════════════════════════
// GAME FLOW
// ════════════════════════════════════════
function startGame() {
  STATE.answers = [];
  STATE.sessionId = makeSessionId();
  document.getElementById('feedContainer').innerHTML = '';
  document.getElementById('topBarTitle').textContent = t(STATE.lang, 'brand');
  show('feedScreen');
  updateProgress();
  renderCard(0);
  logEvent('start', { sessionId: STATE.sessionId, playerId: STATE.playerId, lang: STATE.lang });
}

function cardTemplate(q, index, lang) {
  const catName = CATEGORY_NAMES[q.category][lang];
  const isFirst = index === 0;
  return `
  <div class="q-card" id="card-${index}" data-index="${index}">
    <div class="q-body-wrap">
      <div class="q-header">
        <div class="q-avatar">${q.emoji}</div>
        <div class="q-meta">
          <div class="q-category">${catName}</div>
          <div class="q-index">${index + 1} / ${QUESTIONS.length}</div>
        </div>
      </div>
      <div class="q-statement">${q[lang].statement}</div>
      <div class="bet-section">
        <div class="confidence-badge-wrap">
          <div class="confidence-badge" id="badge-${index}" style="left:50%">${t(lang, 'notSure')}</div>
        </div>
        <div class="slider-track" id="track-${index}">
          <div class="slider-center-tick"></div>
          <div class="slider-thumb" id="thumb-${index}"></div>
        </div>
        <div class="slider-labels"><span>${t(lang, 'falseLabel')}</span><span>${t(lang, 'trueLabel')}</span></div>
        ${isFirst ? `<div class="drag-hint" id="dragHint">${t(lang, 'dragHint')}</div>` : ''}
        <button class="ready-btn pulse" id="ready-${index}">${t(lang, 'readyBtn')}</button>
      </div>
    </div>
    <div class="reveal-section" id="reveal-${index}" style="display:none;"></div>
  </div>`;
}

function renderCard(index) {
  const q = QUESTIONS[index];
  const container = document.getElementById('feedContainer');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardTemplate(q, index, STATE.lang);
  const cardEl = wrapper.firstElementChild;
  container.appendChild(cardEl);
  attachCardHandlers(index);
  cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function attachCardHandlers(index) {
  const track = document.getElementById(`track-${index}`);
  const thumb = document.getElementById(`thumb-${index}`);
  const badge = document.getElementById(`badge-${index}`);
  const readyBtn = document.getElementById(`ready-${index}`);
  let v = 0;
  let lastHapticLevel = 0;
  const HAPTIC_LEVELS = [60, 75, 90];

  function updateVisuals() {
    const pos = (v + 100) / 2;
    thumb.style.left = pos + '%';
    badge.style.left = Math.min(92, Math.max(8, pos)) + '%';
    thumb.style.borderColor = colorForRatio(pos / 100);
    if (v === 0) {
      badge.textContent = t(STATE.lang, 'notSure');
      badge.className = 'confidence-badge';
    } else {
      const confidence = Math.round(50 + Math.abs(v) / 2);
      badge.textContent = confidence + '%';
      badge.className = 'confidence-badge ' + (v > 0 ? 'side-true' : 'side-false');
    }
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

  track.addEventListener('pointerdown', (e) => {
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    const hint = document.getElementById('dragHint');
    if (hint) hint.style.display = 'none';
    setFromClientX(e.clientX);
  });
  track.addEventListener('pointermove', (e) => {
    if (!track.classList.contains('dragging')) return;
    setFromClientX(e.clientX);
  });
  const endDrag = () => track.classList.remove('dragging');
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  readyBtn.addEventListener('click', () => {
    readyBtn.classList.remove('pulse');
    track.style.pointerEvents = 'none';
    reveal(index, v);
  });

  updateVisuals();
}

function reveal(index, v) {
  const q = QUESTIONS[index];
  const lang = STATE.lang;
  const result = computeScore(v, q.answer);
  STATE.answers.push({ index, v, ...result });
  updateProgress();

  document.getElementById(`card-${index}`).classList.add('answered');

  const pos = (v + 100) / 2;
  const truthPos = q.answer ? 100 : 0;
  const icon = result.abstain ? '🤔' : result.correct ? '✅' : '❌';
  const verdictText = t(lang, 'verdicts')[getVerdictKey(result)];
  const pointsColor = colorForRatio(result.points / 100);
  const yourBetText = result.abstain
    ? `${t(lang, 'notSure')} (50%)`
    : `${Math.round(result.p * 100)}% ${result.guessTrue ? t(lang, 'trueLabel') : t(lang, 'falseLabel')}`;
  const truthText = q.answer ? t(lang, 'trueLabel') : t(lang, 'falseLabel');
  const explainIntro = q.answer ? t(lang, 'correctAnswerTrue') : t(lang, 'correctAnswerFalse');
  const isLast = index === QUESTIONS.length - 1;

  const revealEl = document.getElementById(`reveal-${index}`);
  revealEl.innerHTML = `
    <div class="reveal-top">
      <div class="reveal-icon">${icon}</div>
      <div>
        <div class="reveal-points" style="color:${pointsColor}">+${result.points} ${t(lang, 'pointsWord')}</div>
        <div class="reveal-verdict">${verdictText}</div>
      </div>
    </div>
    <div class="feedback-bar">
      <div class="feedback-bar-marker user-m" style="left:${pos}%"></div>
      <div class="feedback-bar-marker truth-m" style="left:${truthPos}%"></div>
    </div>
    <div class="feedback-bar-legend">
      <div class="legend-item"><span class="legend-dot" style="background:var(--accent-dark)"></span>${t(lang, 'yourBet')}: ${yourBetText}</div>
      <div class="legend-item"><span class="legend-dot" style="background:var(--text)"></span>${t(lang, 'truth')}: ${truthText}</div>
    </div>
    <div class="reveal-explain"><strong>${explainIntro}.</strong> ${q[lang].explain}</div>
    <button class="next-btn" id="next-${index}">${isLast ? t(lang, 'finishBtn') : t(lang, 'nextBtn')}</button>
  `;
  revealEl.style.display = 'block';
  document.getElementById(`next-${index}`).addEventListener('click', () => onNext(index));
  revealEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  logEvent('answer', {
    sessionId: STATE.sessionId,
    playerId: STATE.playerId,
    lang,
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
}

function onNext(index) {
  if (index + 1 < QUESTIONS.length) {
    renderCard(index + 1);
  } else {
    showResults();
  }
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
    rows.push(`<div class="calib-chart-row">${t(lang, 'chartRow')(lo, hi, real)}</div>`);
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
  document.getElementById('resultTitle').textContent = t(lang, 'resultTitle');
  document.getElementById('resultScoreValue').textContent = avgPoints + '%';
  document.getElementById('resultEmoji').textContent = emojiForScore(avgPoints);
  document.getElementById('accuracyLabel').textContent = t(lang, 'accuracyLabel');
  document.getElementById('accuracyValue').textContent = `${correctCount}/${total}`;
  document.getElementById('calibrationLabel').textContent = t(lang, 'calibrationLabel');
  const fill = document.getElementById('calibBarFill');
  fill.style.width = avgPoints + '%';
  fill.style.background = colorForRatio(avgPoints / 100);
  document.getElementById('profileLabel').textContent = t(lang, 'profileLabel');
  document.getElementById('archetypeTitle').textContent = archetype.title;
  document.getElementById('archetypeDesc').textContent = archetype.desc;
  renderCalibChart(lang, answers);
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
