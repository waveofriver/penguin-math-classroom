/* Reusable classic-script clock worksheet. No imports or network requests. */
(() => {
  'use strict';
  const MODES = { basic: '기본', count: '5분씩 세기', short: '짧은 설명', large: '큰 선택 버튼', steps: '한 단계씩' };
  const state = { question: null, mode: 'basic', locked: false, network: false, enabled: true, hour: '', minute: '', step: 1, count: 0, phase: 'editing', feedback: '', result: '', revision: 0 };
  let root = null;
  const $ = id => root.querySelector('#cw-' + id);
  const validNumber = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isInteger(Number(value));
  function normalizeAnswer(hour, minute) {
    if (!validNumber(hour) || !validNumber(minute)) throw new TypeError('시와 분을 모두 선택해 주세요.');
    const h = Number(hour), m = Number(minute);
    if (h < 1 || h > 12 || m < 0 || m > 55 || m % 5 !== 0) throw new RangeError('시는 1~12, 분은 0~55 사이의 5분 단위여야 해요.');
    return h * 60 + m;
  }
  function angles(hour, minute) {
    normalizeAnswer(hour, minute);
    return { hour: (Number(hour) % 12) * 30 + Number(minute) * 0.5, minute: Number(minute) * 6 };
  }
  const fullTime = (h, m) => h + '시 ' + String(m).padStart(2, '0') + '분';
  function reset() {
    state.hour = ''; state.minute = ''; state.step = 1; state.count = 0;
    state.phase = 'editing'; state.feedback = ''; state.result = ''; state.revision++;
  }
  window.clockTest = Object.freeze({ angles, normalizeAnswer });
  window.clockBridge = Object.freeze({
    applyQuestion(question) {
      if (!question || question.activity !== 'clock' || !Number.isInteger(question.hour) || !Number.isInteger(question.minute)) throw new TypeError('올바른 시계 문제를 보내 주세요.');
      normalizeAnswer(question.hour, question.minute);
      state.question = { activity: 'clock', hour: question.hour, minute: question.minute };
      reset(); render();
    },
    getMode() { return state.mode; },
    setMode(mode) {
      if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw new RangeError('지원하지 않는 도움 화면이에요.');
      if (state.mode !== mode) { state.mode = mode; reset(); render(); }
    },
    setNetworkStudent(on) {
      const next = Boolean(on);
      if (next && !state.network) state.enabled = false;
      state.network = next; sync();
    },
    setSubmissionEnabled(on) { state.enabled = Boolean(on); sync(); },
    setLocked(on) { state.locked = Boolean(on); sync(); }
  });
  function mount() {
    root = document.getElementById('clockWorksheet');
    if (!root) return;
    root.setAttribute('aria-labelledby', 'cw-title');
    root.innerHTML = '<div class="cw-card"><header class="cw-heading"><p class="cw-eyebrow">차근차근 시계 읽기</p><h2 id="cw-title">몇 시 몇 분일까요?</h2><p id="cw-choice-note">나에게 편한 도움 화면을 골라요. 문제의 시각은 같아요.</p><p id="cw-assigned" hidden></p></header><div id="cw-tabs" role="tablist" aria-label="도움 화면 선택"></div><div id="cw-panel" role="tabpanel" tabindex="0"><p id="cw-instruction"></p><div class="cw-layout"><div class="cw-visual"><div id="cw-face"></div><ul class="cw-legends" aria-label="바늘 구별"><li><span class="cw-sample cw-sample-hour" aria-hidden="true"></span>짧은 바늘 · 시</li><li><span class="cw-sample cw-sample-minute" aria-hidden="true"></span>긴 바늘 · 분</li></ul><div id="cw-count-box" hidden><button type="button" id="cw-count">5분씩 세어 보기</button><p id="cw-count-text" role="status" aria-live="polite"></p></div></div><div class="cw-work"><form id="cw-form" novalidate><p id="cw-step-note" class="cw-step" hidden></p><fieldset id="cw-fields"><legend>내가 읽은 시각</legend><div id="cw-hour-group" class="cw-answer-group"><label for="cw-hour">시 선택</label><select id="cw-hour" name="hour"><option value="">시를 골라요</option></select><div id="cw-hour-buttons" class="cw-number-grid" role="group" aria-label="시 선택" hidden></div></div><div id="cw-minute-group" class="cw-answer-group"><label for="cw-minute">분 선택</label><select id="cw-minute" name="minute"><option value="">분을 골라요</option></select><div id="cw-minute-buttons" class="cw-number-grid" role="group" aria-label="분 선택" hidden></div></div></fieldset><p id="cw-selection" class="cw-selection" aria-live="polite"></p><div class="cw-actions"><button type="button" id="cw-back" hidden>시 선택으로 돌아가기</button><button type="submit" id="cw-submit" class="cw-primary">답 확인</button><button type="button" id="cw-retry" hidden>같은 문제 다시 풀기</button></div></form><p id="cw-gate" class="cw-gate" role="status" aria-live="polite"></p><div id="cw-feedback" class="cw-feedback" role="status" aria-live="polite" aria-atomic="true"></div></div></div></div></div>';
    Object.entries(MODES).forEach(([mode, label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.id = 'cw-tab-' + mode;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'cw-panel'); button.dataset.mode = mode; button.textContent = label;
      $('tabs').append(button);
    });
    for (let h = 1; h <= 12; h++) addChoice('hour', h, h + '시');
    for (let m = 0; m <= 55; m += 5) addChoice('minute', m, String(m).padStart(2, '0') + '분');
    root.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button || !root.contains(button)) return;
      if (button.dataset.mode && !state.locked) { const mode = button.dataset.mode; const changed = state.mode !== mode; window.clockBridge.setMode(mode); $('tab-' + mode).focus(); if (changed && typeof window.onClassroomModeChange === 'function') window.onClassroomModeChange(mode); }
      if (button.dataset.unit) choose(button.dataset.unit, button.dataset.value);
    });
    $('tabs').addEventListener('keydown', event => {
      if (state.locked || !event.target.dataset.mode) return;
      const keys = Object.keys(MODES), index = keys.indexOf(event.target.dataset.mode);
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % keys.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + keys.length - 1) % keys.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = keys.length - 1;
      else return;
      event.preventDefault(); $('tab-' + keys[next]).focus();
    });
    $('hour').addEventListener('change', () => choose('hour', $('hour').value));
    $('minute').addEventListener('change', () => choose('minute', $('minute').value));
    $('form').addEventListener('submit', submit);
    $('back').addEventListener('click', () => { state.step = 1; state.feedback = ''; sync(); $('hour').focus(); });
    $('retry').addEventListener('click', () => { state.phase = 'editing'; state.feedback = ''; state.result = ''; sync(); (state.mode === 'large' ? $('hour-buttons').querySelector('button') : $(state.mode === 'steps' && state.step === 2 ? 'minute' : 'hour')).focus(); });
    $('count').addEventListener('click', () => {
      state.count = state.count >= 12 ? 0 : state.count + 1;
      drawClock();
      $('count-text').textContent = state.count === 0 ? '처음부터 다시 세어요.' : state.count === 12 ? '한 바퀴는 60분이에요. 12 자리에서 분은 00으로 읽어요.' : '12 자리에서 ' + state.count + '칸: ' + state.count * 5 + '분까지 세었어요.';
      $('count').textContent = state.count === 12 ? '처음부터 세기' : '5분 더 세기';
    });
    render();
  }
  function addChoice(unit, value, label) {
    const option = document.createElement('option'); option.value = String(value); option.textContent = label; $(unit).append(option);
    const button = document.createElement('button'); button.type = 'button'; button.dataset.unit = unit; button.dataset.value = String(value);
    button.textContent = label; button.setAttribute('aria-pressed', 'false'); $(unit + '-buttons').append(button);
  }
  function choose(unit, value) {
    if (!state.question || state.phase !== 'editing') return;
    state[unit] = value; state.feedback = ''; sync();
  }
  function point(angle, radius) {
    const radians = angle * Math.PI / 180;
    return { x: +(180 + Math.sin(radians) * radius).toFixed(3), y: +(180 - Math.cos(radians) * radius).toFixed(3) };
  }
  function handDescription(q) {
    const hourPosition = q.minute === 0 ? q.hour + ' 숫자 방향' : q.hour + '번 숫자와 ' + (q.hour === 12 ? 1 : q.hour + 1) + '번 숫자 사이';
    const minutePosition = q.minute === 0 ? 12 : q.minute / 5;
    return '둥근 시계. 짧고 굵은 바늘은 ' + hourPosition + ', 길고 가는 바늘은 ' + minutePosition + ' 숫자 방향을 가리켜요. 바늘을 보고 시와 분을 골라요.';
  }
  function drawClock() {
    if (!root) return;
    if (!state.question) { $('face').innerHTML = '<p class="cw-waiting">시계 문제가 오면 여기에 나타나요.</p>'; return; }
    const a = angles(state.question.hour, state.question.minute), countMode = state.mode === 'count';
    let svg = '<svg viewBox="0 0 360 360" width="360" height="360" role="img" aria-labelledby="cw-svg-title cw-svg-desc"><title id="cw-svg-title">읽어 볼 아날로그 시계</title><desc id="cw-svg-desc">' + handDescription(state.question) + '</desc><circle class="cw-clock-rim" cx="180" cy="180" r="174"/><circle class="cw-clock-paper" cx="180" cy="180" r="144"/>';
    if (countMode && state.count > 0) {
      const end = point(state.count * 30, 158);
      svg += state.count === 12 ? '<circle class="cw-count-arc" cx="180" cy="180" r="158"/>' : '<path class="cw-count-arc" d="M 180 22 A 158 158 0 ' + (state.count > 6 ? 1 : 0) + ' 1 ' + end.x + ' ' + end.y + '"/>';
    }
    for (let i = 0; i < 60; i++) {
      const p = point(i * 6, i % 5 === 0 ? 128 : 135), end = point(i * 6, 142);
      svg += '<line class="' + (i % 5 === 0 ? 'cw-major-tick' : 'cw-minor-tick') + '" x1="' + p.x + '" y1="' + p.y + '" x2="' + end.x + '" y2="' + end.y + '"/>';
    }
    for (let n = 1; n <= 12; n++) {
      const p = point(n * 30, 109);
      svg += '<text class="cw-hour-number" x="' + p.x + '" y="' + p.y + '">' + n + '</text>';
      if (countMode) { const m = n === 12 ? 0 : n * 5, outer = point(n * 30, 157); svg += '<text class="cw-minute-number" x="' + outer.x + '" y="' + outer.y + '">' + m + '</text>'; }
    }
    svg += '<g transform="rotate(' + a.hour + ' 180 180)"><line class="cw-hour-hand" x1="180" y1="190" x2="180" y2="112"/></g><g transform="rotate(' + a.minute + ' 180 180)"><line class="cw-minute-hand" x1="180" y1="193" x2="180" y2="65"/></g><circle class="cw-center" cx="180" cy="180" r="7"/></svg>';
    $('face').innerHTML = svg;
  }
  function render() {
    if (!root) return;
    root.dataset.mode = state.mode;
    $('instruction').textContent = ({ basic: '짧은 바늘로 시를, 긴 바늘로 분을 읽고 답을 골라요.', count: '긴 바늘이 가리키는 곳까지 12 자리에서 5분씩 세어 보세요. 바늘은 움직이지 않아요.', short: '시와 분을 골라요.', large: '큰 버튼으로 시와 분을 하나씩 골라요.', steps: '먼저 시를 고르고, 다음으로 분을 골라요. 두 가지를 모두 고른 뒤에만 확인해요.' })[state.mode];
    $('count-text').textContent = ''; $('count').textContent = '5분씩 세어 보기'; drawClock(); sync();
  }
  function sync() {
    if (!root) return;
    const editing = state.phase === 'editing', steps = state.mode === 'steps', large = state.mode === 'large';
    $('tabs').hidden = state.locked; $('choice-note').hidden = state.locked; $('assigned').hidden = !state.locked;
    $('assigned').textContent = '선생님이 정한 도움 화면: ' + MODES[state.mode];
    $('panel').setAttribute('aria-labelledby', state.locked ? 'cw-assigned' : 'cw-tab-' + state.mode);
    for (const button of $('tabs').querySelectorAll('button')) { const selected = button.dataset.mode === state.mode; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
    $('count-box').hidden = state.mode !== 'count';
    $('fields').disabled = !state.question || !editing;
    for (const unit of ['hour', 'minute']) {
      $(unit).value = state[unit]; $(unit).hidden = large; $(unit + '-buttons').hidden = !large;
      $('' + unit + '-group').hidden = steps && ((unit === 'hour' && state.step === 2) || (unit === 'minute' && state.step === 1));
      root.querySelector('label[for="cw-' + unit + '"]').hidden = large;
      for (const button of $(unit + '-buttons').querySelectorAll('button')) button.setAttribute('aria-pressed', String(state[unit] === button.dataset.value));
    }
    $('step-note').hidden = !steps; $('step-note').textContent = state.step === 1 ? '1단계 · 시를 골라요' : '2단계 · 분을 골라요';
    $('selection').textContent = '내 선택: ' + (state.hour === '' ? '시 미선택' : state.hour + '시') + ' · ' + (state.minute === '' ? '분 미선택' : String(state.minute).padStart(2, '0') + '분');
    $('back').hidden = !steps || state.step !== 2 || !editing;
    $('submit').hidden = !editing; $('retry').hidden = editing;
    const nextStep = steps && state.step === 1;
    $('submit').textContent = nextStep ? '다음: 분 고르기' : '답 확인';
    $('submit').disabled = !state.question || (!nextStep && !state.enabled);
    $('retry').disabled = !state.question;
    $('gate').textContent = !state.question ? '선생님이 시계 문제를 준비하고 있어요.' : !state.enabled ? '지금은 답을 보낼 수 없어요. 연결 또는 선생님의 안내를 기다려 주세요. 선택한 답은 유지돼요.' : state.network ? '답 확인을 누르면 교실로 답을 보내요. 전송 결과는 교실 안내에서 확인해요.' : '답 확인을 누르면 이 화면에서 답을 살펴봐요.';
    $('feedback').textContent = state.feedback;
    $('feedback').dataset.result = state.result;
  }
  function submit(event) {
    event.preventDefault();
    if (!state.question || state.phase !== 'editing') return;
    if (state.mode === 'steps' && state.step === 1) {
      if (state.hour === '') { state.feedback = '먼저 시를 골라 주세요.'; sync(); $('hour').focus(); return; }
      state.step = 2; state.feedback = ''; sync(); $('minute').focus(); return;
    }
    if (!state.enabled) return;
    let answer;
    try { answer = normalizeAnswer(state.hour, state.minute); }
    catch (_) { state.feedback = '시와 분을 모두 골라 주세요.'; sync(); (state.mode === 'large' ? $(state.hour === '' ? 'hour-buttons' : 'minute-buttons').querySelector('button') : $(state.hour === '' ? 'hour' : 'minute')).focus(); return; }
    const payload = { hour: Number(state.hour), minute: Number(state.minute), mode: state.mode }, revision = state.revision;
    state.phase = 'submitting'; sync();
    let accepted;
    try {
      if (typeof window.onClockAnswer === 'function') accepted = window.onClockAnswer(payload);
      else if (state.network) accepted = false;
    } catch (_) { accepted = false; }
    if (revision !== state.revision) return;
    if (accepted === false || (accepted && typeof accepted.then === 'function')) {
      state.phase = 'blocked'; state.result = '';
      state.feedback = '내가 고른 답: ' + fullTime(payload.hour, payload.minute) + '. 답을 받았는지 확인하지 못해서 채점하지 않았어요. 교실 안내를 확인하고 다시 시도해 주세요.'; sync(); return;
    }
    const correct = answer === normalizeAnswer(state.question.hour, state.question.minute);
    state.phase = 'graded'; state.result = correct ? 'correct' : 'wrong';
    state.feedback = '내가 고른 답: ' + fullTime(payload.hour, payload.minute) + '. ' + (correct ? '맞았어요! 바늘을 잘 읽었어요.' : '다시 살펴봐요. 짧은 바늘은 시, 긴 바늘은 분이에요. 같은 문제를 다시 풀 수 있어요.') + (state.network ? ' 이 표시는 화면의 채점 결과예요. 전송 완료 여부는 교실 안내에서 확인해요.' : '');
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
