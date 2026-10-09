// The control panel. Every change is written to localStorage, which the
// display window (and the preview) pick up.

const $ = (id) => document.getElementById(id);

let state = loadState();
let lastEndTimeShown;

// Merge with the latest stored state, so two open control panels don't fight.
function update(changes) {
  state = { ...loadState(), ...changes };
  saveState(state);
  render();
}

// Asks for a second click within a few seconds before a destructive action.
// (No confirm() dialog: it's easy to dismiss by accident, and some embeds block it.)
function confirmedClick(button, question) {
  if (button.confirmRestore) {
    button.confirmRestore();
    return true;
  }
  const label = button.textContent;
  button.textContent = question;
  button.classList.add('confirming');
  const timer = setTimeout(() => button.confirmRestore(), 4000);
  button.confirmRestore = () => {
    clearTimeout(timer);
    button.textContent = label;
    button.classList.remove('confirming');
    button.confirmRestore = null;
  };
  return false;
}

// ---- Timer -------------------------------------------------------------------

$('durationForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const minutes = (Number($('durH').value) || 0) * 60 + (Number($('durM').value) || 0);
  if (minutes <= 0) return;
  const running = state.endTime != null && remainingMs(state, Date.now()) > 0;
  if (running && !confirmedClick(e.submitter || $('durationForm').querySelector('button'),
      'Restart? Click again')) return;
  update({ endTime: roundToSecond(Date.now()) + minutes * MINUTE, pausedAt: null });
});

$('endForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const [h, m] = $('endInput').value.split(':').map(Number);
  const end = new Date();
  end.setHours(h, m, 0, 0);
  // A time far in the past most likely means tomorrow (e.g. setting 00:30 at 23:00).
  if (end.getTime() < Date.now() - 12 * 60 * MINUTE) end.setDate(end.getDate() + 1);
  update({ endTime: end.getTime(), pausedAt: null });
});

$('adjust').addEventListener('click', (e) => {
  const minutes = Number(e.target.dataset.adjust);
  if (!minutes || state.endTime == null) return;
  update({ endTime: state.endTime + minutes * MINUTE });
});

$('pause').addEventListener('click', () => {
  if (state.endTime == null) return;
  const now = roundToSecond(Date.now());
  if (state.pausedAt != null) {
    update({ endTime: state.endTime + (now - state.pausedAt), pausedAt: null });
  } else {
    update({ pausedAt: now });
  }
});

$('reset').addEventListener('click', (e) => {
  if (confirmedClick(e.currentTarget, 'Clear? Click again')) {
    update({ endTime: null, pausedAt: null });
  }
});

// ---- Clarifications ------------------------------------------------------

const notesInput = $('notes');
notesInput.value = readJSON(DRAFT_KEY) ?? state.notes;

notesInput.addEventListener('input', () => {
  writeJSON(DRAFT_KEY, notesInput.value);
  renderNotesStatus();
});
notesInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    publishNotes();
  }
});

function publishNotes() {
  update({ notes: notesInput.value });
}
$('publish').addEventListener('click', publishNotes);
$('unpublish').addEventListener('click', () => update({ notes: '' }));

function renderNotesStatus() {
  const draft = notesInput.value;
  const shown = state.notes;
  let text = '';
  if (draft === shown) text = shown.trim() ? 'On screen.' : '';
  else if (!shown.trim()) text = draft.trim() ? 'Not on screen.' : '';
  else text = 'Edited – changes not on screen yet.';
  $('notesStatus').textContent = text;
  $('publish').disabled = draft === shown;
  $('unpublish').disabled = !shown;
}

// ---- Display settings ------------------------------------------------------

const settingInputs = document.querySelectorAll('[data-setting]');

for (const input of settingInputs) {
  input.addEventListener('input', () => {
    const key = input.dataset.setting;
    if (input.type === 'checkbox') {
      update({ [key]: input.checked });
    } else if (input.type === 'number') {
      const value = Number(input.value);
      if (input.value !== '' && Number.isFinite(value) && input.checkValidity()) {
        update({ [key]: value });
      }
    } else {
      update({ [key]: input.value });
    }
  });
}

$('title').addEventListener('input', (e) => update({ title: e.target.value }));

$('resetSettings').addEventListener('click', () => {
  const { title, ...defaults } = DEFAULT_SETTINGS;
  update(defaults);
});

function renderSettings() {
  for (const input of settingInputs) {
    if (input === document.activeElement) continue;
    const value = state[input.dataset.setting];
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
  }
  if ($('title') !== document.activeElement) $('title').value = state.title;
}

// ---- Status --------------------------------------------------------------------

function renderTimer() {
  const now = Date.now();
  const ms = remainingMs(state, now);
  const status = $('status');
  const hasTimer = ms != null;
  const paused = state.pausedAt != null;

  for (const button of document.querySelectorAll('#adjust button, #pause')) {
    button.disabled = !hasTimer;
  }
  $('reset').disabled = !hasTimer;
  $('pause').textContent = paused ? 'Resume' : 'Pause';

  if (!hasTimer) {
    status.className = 'status';
    status.textContent = 'No timer set – the screen shows only the clock.';
    return;
  }

  const end = paused ? now + ms : state.endTime;
  const phase = countdownPhase(ms, state);
  const left = `<strong>${formatPrecise(ms)}</strong>`;
  const onScreen = `screen shows “${formatCountdown(ms, state)}”`;
  status.className = `status ${phase}`;
  if (paused) {
    status.innerHTML = `Paused – ${left} left · ${onScreen}`;
  } else if (phase === 'over') {
    status.innerHTML = `Time is up – ${left} · ended at ${formatTime(end, state, true)}`;
  } else {
    status.innerHTML = `${left} left · ends at ${formatTime(end, state, true)} · ${onScreen}`;
  }

  // Keep the end time field in sync, but don't overwrite what's being typed.
  if (state.endTime !== lastEndTimeShown && document.activeElement !== $('endInput')) {
    lastEndTimeShown = state.endTime;
    const d = new Date(end);
    $('endInput').value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}

function render() {
  renderTimer();
  renderNotesStatus();
  renderSettings();
}

// ---- Display window and preview ---------------------------------------------

$('openDisplay').addEventListener('click', () => {
  const win = window.open('display.html', 'examClockDisplay', 'popup,width=1280,height=720');
  $('popupBlocked').hidden = !!win;
  $('openHint').hidden = !win;
  if (win) win.focus();
});

// Show the preview itself full screen, for when the projector mirrors this screen.
$('previewFullscreen').addEventListener('click', () => {
  $('previewFrame').requestFullscreen?.().catch(() => {});
});
$('previewFrame').addEventListener('dblclick', () => {
  if (document.fullscreenElement) document.exitFullscreen();
});

const previewFrame = $('previewFrame');
const preview = $('preview');

function layoutPreview() {
  const size = readJSON(SIZE_KEY) || { w: 1920, h: 1080 };
  const scale = previewFrame.clientWidth / size.w;
  preview.style.width = size.w + 'px';
  preview.style.height = size.h + 'px';
  preview.style.transform = `scale(${scale})`;
  previewFrame.style.height = size.h * scale + 'px';
}
new ResizeObserver(layoutPreview).observe(previewFrame);

// ---- Sync -------------------------------------------------------------------------

window.addEventListener('storage', (e) => {
  if (e.key === SIZE_KEY) layoutPreview();
  if (e.key === DRAFT_KEY && document.activeElement !== notesInput) {
    notesInput.value = readJSON(DRAFT_KEY) ?? '';
  }
  if (e.key === STATE_KEY || e.key === null) {
    state = loadState();
    render();
  }
});

startTicking(() => {
  state = loadState();
  render();
});
