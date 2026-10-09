// State and formatting shared by the control panel and the display window.
// Both windows talk to each other only through localStorage: the control panel
// writes, the display listens for the `storage` event (fired in every other
// window of the same origin). Everything time-related is derived from the
// absolute end time and Date.now(), so a throttled or hidden window is always
// correct as soon as it renders again.

const STATE_KEY = 'examClock.state.v1';
const DRAFT_KEY = 'examClock.draft.v1';
const SIZE_KEY = 'examClock.displaySize.v1';

const MINUTE = 60 * 1000;

const DEFAULT_SETTINGS = {
  showClock: true,
  clockSeconds: false,
  showEnd: true,
  showCountdown: true,
  hourCycle: 'auto',     // 'auto' | 'h23' | 'h12'
  orangeMin: 5,          // countdown turns orange (and shows seconds) at or below this many minutes
  roundCountdown: false, // round the countdown to coarseStepMin, shown with a ~ prefix
  coarseAboveMin: 30,    // when rounding: above this, round to coarseStepMin
  coarseStepMin: 5,
  notesMaxPct: 8,        // largest clarification font, % of screen height
  timingPct: 40,         // timer strip height, % of screen height
  timingMinPct: 25,      // ...which shrinks to this when the clarifications need the room
};

const DEFAULT_STATE = {
  endTime: null,   // epoch ms when the exam ends, null = no timer
  pausedAt: null,  // epoch ms when the timer was paused, null = running
  notes: '',       // clarifications currently on screen (Markdown)
  ...DEFAULT_SETTINGS,
};

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (e.g. blocked): the window still works on its own.
  }
}

function loadState() {
  return { ...DEFAULT_STATE, ...(readJSON(STATE_KEY) || {}) };
}

function saveState(state) {
  writeJSON(STATE_KEY, state);
}

// Milliseconds left (negative once time is up), or null when no timer is set.
function remainingMs(state, now) {
  if (state.endTime == null) return null;
  return state.endTime - (state.pausedAt ?? now);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatHM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

// The countdown shown on the projector. Precise by default; with
// `roundCountdown` the minutes are rounded *up* and prefixed with "~", so
// "~5 min" means "at most 5 minutes left". Seconds appear from orange onwards.
function formatCountdown(ms, s) {
  if (ms <= 0) {
    const over = Math.floor(-ms / 1000);
    return over === 0 ? '0:00' : '−' + formatHMS(over);
  }
  if (!s.roundCountdown || ms <= s.orangeMin * MINUTE) return formatHMS(Math.ceil(ms / 1000));
  const step = ms > s.coarseAboveMin * MINUTE ? Math.max(1, s.coarseStepMin) : 1;
  return '~' + formatHM(Math.ceil(ms / (step * MINUTE)) * step);
}

// Precise countdown for the control panel.
function formatPrecise(ms) {
  const sign = ms < 0 ? '−' : '';
  return sign + formatHMS(Math.ceil(Math.abs(ms) / 1000));
}

function countdownPhase(ms, s) {
  if (ms <= 0) return 'over';
  if (ms <= s.orangeMin * MINUTE) return 'orange';
  return 'normal';
}

const timeFormatters = new Map();

function formatTime(epochMs, s, withSeconds = false) {
  const key = s.hourCycle + withSeconds;
  if (!timeFormatters.has(key)) {
    const opts = { hour: 'numeric', minute: '2-digit' };
    if (withSeconds) opts.second = '2-digit';
    if (s.hourCycle !== 'auto') opts.hourCycle = s.hourCycle;
    timeFormatters.set(key, new Intl.DateTimeFormat(undefined, opts));
  }
  return timeFormatters.get(key).format(new Date(epochMs));
}

// Timer changes snap to whole seconds so every window ticks in step.
function roundToSecond(t) {
  return Math.round(t / 1000) * 1000;
}

// Calls `fn` right after every wall-clock second, and immediately whenever the
// window becomes visible or focused again (timers may have been throttled).
function startTicking(fn) {
  let timer;
  const tick = () => {
    clearTimeout(timer);
    fn();
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);
  window.addEventListener('pageshow', tick);
  tick();
}
