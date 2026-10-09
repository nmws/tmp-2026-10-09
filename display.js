// The projected window. It only reads state; all changes come from the
// control panel through localStorage.

const isPreview = window.self !== window.top; // embedded in the control panel

const $ = (id) => document.getElementById(id);
const els = {
  title: $('title'),
  timing: $('timing'),
  clockBox: $('clockBox'), clock: $('clock'),
  countBox: $('countBox'), count: $('count'), countLabel: $('countLabel'),
  endBox: $('endBox'), end: $('end'), endLabel: $('endLabel'),
  notesBody: $('notesBody'), notesInner: $('notesInner'),
  hint: $('hint'),
};
const boxes = { clock: els.clockBox, count: els.countBox, end: els.endBox };
const spans = { clock: els.clock, count: els.count, end: els.end };

let state = loadState();
let lastLayout = '';
let lastNotes = null;
let notesDirty = true;
const fitted = new Map(); // span -> { key, size }

marked.use({
  gfm: true,
  breaks: true, // a single newline in the text box is a line break on screen
  renderer: {
    // Show raw HTML as text instead of injecting it.
    html: ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  },
});

// ---- Fitting text into boxes -------------------------------------------

// Largest font size (px) in [lo, hi] for which fits() holds, by bisection.
function largestFitting(el, lo, hi, fits) {
  el.style.fontSize = hi + 'px';
  if (fits()) return hi;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = mid + 'px';
    if (fits()) lo = mid; else hi = mid;
  }
  return lo;
}

// The text a value is sized for: every digit replaced by "8", so the size
// doesn't jump around as the digits change. The countdown is sized for the
// widest text of its current format ("1 h 55 min" and "2 h" get the same size).
function sizingTemplate(span) {
  const template = span.textContent.replace(/\d+/g, (d) => '8'.repeat(d.length));
  if (span !== els.count) return template;
  if (template.includes('h')) return '8 h 88 min';
  if (template.includes('min')) return '88 min';
  return template;
}

// Font size for a single-line value.
function fittedSize(span) {
  const box = span.parentElement;
  const text = span.textContent;
  const template = sizingTemplate(span);
  const key = `${template}|${box.clientWidth}x${box.clientHeight}`;
  const cached = fitted.get(span);
  if (cached && cached.key === key) return cached.size;

  span.textContent = template;
  const size = largestFitting(span, 4, Math.max(4, box.clientHeight), () =>
    span.offsetWidth <= box.clientWidth && span.offsetHeight <= box.clientHeight);
  span.textContent = text;
  fitted.set(span, { key, size });
  return size;
}

function fitNotes() {
  const box = els.notesBody;
  const el = els.notesInner;
  const max = Math.max(6, (window.innerHeight * state.notesMaxPct) / 100);
  const size = largestFitting(el, 6, max, () =>
    el.offsetHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth);
  el.style.fontSize = size + 'px';
}

// ---- Layout --------------------------------------------------------------

function applyLayout(visible, hasNotes) {
  for (const [id, box] of Object.entries(boxes)) {
    box.hidden = !visible.includes(id);
    box.style.gridArea = id;
  }
  const row = (ids) => `"${ids.join(' ')}"`;
  let areas, cols, rows;
  if (!visible.length) {
    areas = 'none'; cols = 'none'; rows = 'none';
  } else if (hasNotes || !visible.includes('count')) {
    // One row: clock | countdown | end time.
    areas = row(visible);
    cols = visible.map((id) => (id === 'count' ? '1.6fr' : '1fr')).join(' ');
    rows = '1fr';
  } else {
    // Clock and end time on top, a big countdown underneath.
    const small = visible.filter((id) => id !== 'count');
    if (small.length) {
      areas = row(small) + ' ' + row(small.map(() => 'count'));
      cols = small.map(() => '1fr').join(' ');
      rows = '1fr 3fr';
    } else {
      areas = row(['count']); cols = '1fr'; rows = '1fr';
    }
  }
  Object.assign(els.timing.style, {
    gridTemplateAreas: areas,
    gridTemplateColumns: cols,
    gridTemplateRows: rows,
  });
}

// ---- Rendering -------------------------------------------------------------

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function render() {
  const now = Date.now();
  const s = state;
  const ms = remainingMs(s, now);
  const hasTimer = ms != null;
  const hasNotes = s.notes.trim() !== '';

  const visible = [];
  if (s.showClock) visible.push('clock');
  if (hasTimer && s.showCountdown) visible.push('count');
  if (hasTimer && s.showEnd) visible.push('end');

  if (s.notes !== lastNotes) {
    lastNotes = s.notes;
    els.notesInner.innerHTML = hasNotes ? marked.parse(s.notes) : '';
    notesDirty = true;
  }

  const layout = [visible, hasNotes, s.title, s.timingPct, s.notesMaxPct, s.notesColumns,
    window.innerWidth, window.innerHeight].join('|');
  if (layout !== lastLayout) {
    lastLayout = layout;
    setText(els.title, s.title.trim());
    document.body.classList.toggle('has-notes', hasNotes);
    document.documentElement.style.setProperty('--timing-h', s.timingPct + '%');
    els.notesInner.style.columnCount = Math.max(1, Math.round(s.notesColumns) || 1);
    applyLayout(visible, hasNotes);
    notesDirty = true;
  }

  setText(els.clock, formatTime(now, s, s.clockSeconds));

  if (hasTimer) {
    const paused = s.pausedAt != null;
    const phase = countdownPhase(ms, s);
    setText(els.count, formatCountdown(ms, s));
    els.countBox.className = `box ${phase}${paused ? ' paused' : ''}`;
    setText(els.countLabel,
      paused ? 'Paused' : phase === 'over' ? 'Time is up' : 'Time remaining');
    // While paused the end time keeps moving; show where it would be now.
    setText(els.end, formatTime(paused ? now + ms : s.endTime, s));
    setText(els.endLabel, phase === 'over' && !paused ? 'Exam ended at' : 'Exam ends at');
  }

  // Size the single-line values. Clock and end time share one size.
  const sizes = {};
  for (const id of visible) sizes[id] = fittedSize(spans[id]);
  if (sizes.clock && sizes.end) sizes.clock = sizes.end = Math.min(sizes.clock, sizes.end);
  for (const id of visible) spans[id].style.fontSize = sizes[id] + 'px';

  if (notesDirty && hasNotes) {
    notesDirty = false;
    fitNotes();
  }
}

function refit() {
  fitted.clear();
  notesDirty = true;
  render();
}

// ---- Events ------------------------------------------------------------------

window.addEventListener('storage', (e) => {
  if (e.key === STATE_KEY || e.key === null) {
    state = loadState();
    render();
  }
});
window.addEventListener('resize', render);
document.fonts.ready.then(refit);
document.fonts.addEventListener('loadingdone', refit);
// Images in clarifications change the height once they load.
els.notesInner.addEventListener('load', refit, true);

// Re-read state too when coming back, in case an event was missed.
startTicking(() => {
  if (!document.hidden) state = loadState();
  render();
});

if (!isPreview) {
  // Let the control panel's preview use this window's shape.
  const reportSize = () =>
    writeJSON(SIZE_KEY, { w: window.innerWidth, h: window.innerHeight });
  reportSize();
  window.addEventListener('resize', reportSize);

  // Full screen on double-click or F.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  document.addEventListener('dblclick', toggleFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });

  // Hide the cursor and hint when the mouse is still.
  let idleTimer;
  const wake = () => {
    document.body.classList.remove('idle');
    els.hint.classList.toggle('visible', !document.fullscreenElement);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add('idle');
      els.hint.classList.remove('visible');
    }, 3000);
  };
  document.addEventListener('mousemove', wake);
  document.addEventListener('fullscreenchange', wake);
  wake();

  // Keep the screen from going to sleep during the exam.
  const keepAwake = () => {
    if (document.visibilityState === 'visible') {
      navigator.wakeLock?.request('screen').catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', keepAwake);
  keepAwake();
}
