// =========================================
// MotoTracker — Main App Logic
// =========================================

// ---- STATE ----
const State = {
  profile: {
    name: '', class: 'Amateur',
    make: '', model: '', year: '', engine: '',
    tireFront: '', tireRear: '', psiFront: '', psiRear: '',
    setupNotes: '',
    injuries: [], // [{id, desc, date, status, notes}]
  },
  sessions: [], // [{id, track, date, hours, conditions, type, notes, feeling}]
  suspension: {
    activePreset: 'Default',
    presets: {
      Default: {
        forkComp: 12, forkReb: 12, forkSpring: '', forkOil: '', forkSag: 100,
        shockHiComp: 2, shockLoComp: 12, shockReb: 12, shockSpring: '', shockSag: 100,
        notes: ''
      }
    }
  }
};

let calendarDate = new Date();
let isSyncing = false;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  const hasConfig = GitHub.loadConfig();
  if (hasConfig && GitHub.isConfigured()) {
    await loadAllData();
    showMain();
  } else {
    showSetup();
  }
  bindEvents();
  setTodayDates();
});

function setTodayDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('injury-date').value = today;
  document.getElementById('session-date').value = today;
}

// ---- SCREENS ----
function showSetup() {
  document.getElementById('screen-setup').classList.add('active');
  document.getElementById('screen-main').classList.remove('active');
}
function showMain() {
  document.getElementById('screen-setup').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  renderAll();
}

// ---- DATA LOAD / SAVE ----
async function loadAllData() {
  try {
    const [profile, sessions, suspension] = await Promise.all([
      GitHub.loadData('profile'),
      GitHub.loadData('sessions'),
      GitHub.loadData('suspension'),
    ]);
    if (profile) State.profile = profile;
    if (sessions) State.sessions = sessions;
    if (suspension) State.suspension = suspension;
  } catch (e) {
    console.warn('Load error:', e.message);
    // Use defaults
  }
}

async function syncAll() {
  if (isSyncing || GitHub.isDemoMode()) {
    if (GitHub.isDemoMode()) toast('Demo mode — data saved locally', 'success');
    return;
  }
  isSyncing = true;
  const btn = document.getElementById('btn-sync');
  btn.classList.add('syncing');
  try {
    await Promise.all([
      GitHub.saveData('profile', State.profile),
      GitHub.saveData('sessions', State.sessions),
      GitHub.saveData('suspension', State.suspension),
    ]);
    toast('Synced to GitHub ✓', 'success');
  } catch (e) {
    toast('Sync failed: ' + e.message, 'error');
    console.error(e);
  } finally {
    isSyncing = false;
    btn.classList.remove('syncing');
  }
}

function saveLocal() {
  if (GitHub.isDemoMode()) {
    GitHub.saveData('profile', State.profile);
    GitHub.saveData('sessions', State.sessions);
    GitHub.saveData('suspension', State.suspension);
  }
}

// ---- EVENTS ----
function bindEvents() {
  // Setup screen
  document.getElementById('btn-connect').addEventListener('click', handleConnect);
  document.getElementById('btn-demo').addEventListener('click', handleDemo);

  // Nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sync button
  document.getElementById('btn-sync').addEventListener('click', syncAll);

  // Profile
  document.getElementById('btn-edit-profile').addEventListener('click', () => openModal('modal-profile', populateProfileModal));
  document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
  document.getElementById('btn-add-injury').addEventListener('click', () => openModal('modal-injury'));
  document.getElementById('btn-save-injury').addEventListener('click', saveInjury);

  // Sessions
  document.getElementById('btn-add-session').addEventListener('click', () => openModal('modal-session'));
  document.getElementById('btn-save-session').addEventListener('click', saveSession);

  // Feeling slider
  const feelSlider = document.getElementById('session-feeling');
  feelSlider.addEventListener('input', () => {
    document.getElementById('feeling-display').textContent = feelSlider.value;
  });

  // Suspension
  document.getElementById('btn-save-suspension').addEventListener('click', saveSuspension);
  document.getElementById('btn-new-preset').addEventListener('click', () => openModal('modal-preset'));
  document.getElementById('btn-confirm-preset').addEventListener('click', createPreset);
  document.getElementById('btn-delete-preset').addEventListener('click', deletePreset);
  document.getElementById('susp-preset-select').addEventListener('change', loadPreset);

  // Click controls (suspension +/-)
  document.querySelectorAll('.click-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fieldId = btn.dataset.field;
      const dir = parseInt(btn.dataset.dir);
      const input = document.getElementById(fieldId);
      const val = parseInt(input.value) || 0;
      const min = parseInt(input.min) || 0;
      const max = parseInt(input.max) || 999;
      input.value = Math.min(max, Math.max(min, val + dir));
    });
  });

  // Modal closes
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
}

// ---- CONNECT ----
async function handleConnect() {
  const username = document.getElementById('gh-username').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  if (!username || !repo || !token) { toast('Please fill in all fields', 'error'); return; }

  const btn = document.getElementById('btn-connect');
  btn.textContent = 'CONNECTING...'; btn.disabled = true;
  try {
    GitHub.setConfig(username, repo, token);
    await GitHub.testConnection();
    await loadAllData();
    showMain();
    toast('Connected to GitHub ✓', 'success');
  } catch (e) {
    toast('Connection failed: ' + e.message, 'error');
    btn.textContent = 'CONNECT & START'; btn.disabled = false;
  }
}

function handleDemo() {
  GitHub.setConfig('demo', 'demo', '__DEMO__');
  loadAllData().then(() => {
    showMain();
    toast('Demo mode — data saved locally', 'success');
  });
}

// ---- TAB SWITCHING ----
function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tabId}`));
  if (tabId === 'hours') renderHours();
  if (tabId === 'suspension') renderSuspension();
  if (tabId === 'tracks') renderCalendar();
}

// ---- MODALS ----
function openModal(id, populate) {
  if (populate) populate();
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ---- RENDER ALL ----
function renderAll() {
  renderProfile();
  renderSessions();
  renderCalendar();
}

// ---- PROFILE ----
function renderProfile() {
  const p = State.profile;
  setText('display-name', p.name || 'YOUR NAME');
  setText('display-class', p.class || '—');
  setText('display-make', p.make || '—');
  setText('display-model', p.model || '—');
  setText('display-year', p.year || '—');
  setText('display-engine', p.engine || '—');
  setText('display-tire-front', p.tireFront || '—');
  setText('display-tire-rear', p.tireRear || '—');
  setText('display-psi-front', p.psiFront ? `${p.psiFront} psi` : '—');
  setText('display-psi-rear', p.psiRear ? `${p.psiRear} psi` : '—');
  setText('display-setup-notes', p.setupNotes || 'No notes added yet.');
  renderInjuries();
}

function renderInjuries() {
  const list = document.getElementById('injuries-list');
  const injuries = State.profile.injuries || [];
  if (injuries.length === 0) {
    list.innerHTML = '<div class="empty-state-small">No injuries logged.</div>';
    return;
  }
  list.innerHTML = injuries.map((inj, i) => `
    <div class="injury-item ${inj.status}">
      <div class="injury-info">
        <div class="injury-desc">${esc(inj.desc)}</div>
        <div class="injury-meta">${formatDate(inj.date)}${inj.notes ? ' · ' + esc(inj.notes) : ''}</div>
      </div>
      <div class="injury-badge ${inj.status}">${inj.status}</div>
    </div>
  `).join('');
}

function populateProfileModal() {
  const p = State.profile;
  setVal('edit-name', p.name);
  setVal('edit-class', p.class);
  setVal('edit-make', p.make);
  setVal('edit-model', p.model);
  setVal('edit-year', p.year);
  setVal('edit-engine', p.engine);
  setVal('edit-tire-front', p.tireFront);
  setVal('edit-tire-rear', p.tireRear);
  setVal('edit-psi-front', p.psiFront);
  setVal('edit-psi-rear', p.psiRear);
  setVal('edit-setup-notes', p.setupNotes);
}

function saveProfile() {
  State.profile.name = getVal('edit-name');
  State.profile.class = getVal('edit-class');
  State.profile.make = getVal('edit-make');
  State.profile.model = getVal('edit-model');
  State.profile.year = getVal('edit-year');
  State.profile.engine = getVal('edit-engine');
  State.profile.tireFront = getVal('edit-tire-front');
  State.profile.tireRear = getVal('edit-tire-rear');
  State.profile.psiFront = getVal('edit-psi-front');
  State.profile.psiRear = getVal('edit-psi-rear');
  State.profile.setupNotes = getVal('edit-setup-notes');
  closeModal('modal-profile');
  renderProfile();
  saveLocal();
  toast('Profile saved', 'success');
}

function saveInjury() {
  const desc = getVal('injury-desc');
  if (!desc) { toast('Please enter an injury description', 'error'); return; }
  if (!State.profile.injuries) State.profile.injuries = [];
  State.profile.injuries.unshift({
    id: Date.now(),
    desc,
    date: getVal('injury-date'),
    status: getVal('injury-status'),
    notes: getVal('injury-notes'),
  });
  closeModal('modal-injury');
  // Reset form
  setVal('injury-desc', ''); setVal('injury-notes', '');
  renderInjuries();
  saveLocal();
  toast('Injury logged', 'success');
}

// ---- SESSIONS / TRACKS ----
function saveSession() {
  const track = getVal('session-track');
  if (!track) { toast('Please enter a track name', 'error'); return; }
  const hours = parseFloat(getVal('session-hours'));
  if (!hours || hours <= 0) { toast('Please enter valid hours', 'error'); return; }

  State.sessions.unshift({
    id: Date.now(),
    track,
    date: getVal('session-date'),
    hours,
    conditions: getVal('session-conditions'),
    type: getVal('session-type'),
    notes: getVal('session-notes'),
    feeling: parseInt(document.getElementById('session-feeling').value),
  });

  closeModal('modal-session');
  setVal('session-track', ''); setVal('session-hours', ''); setVal('session-notes', '');
  document.getElementById('session-feeling').value = 7;
  document.getElementById('feeling-display').textContent = '7';

  renderSessions();
  renderCalendar();
  if (document.getElementById('tab-hours').classList.contains('active')) renderHours();
  saveLocal();
  toast('Session logged!', 'success');
}

function renderSessions() {
  const list = document.getElementById('sessions-list');
  if (State.sessions.length === 0) {
    list.innerHTML = '<div class="empty-state">No sessions logged yet.<br>Tap <strong>+ SESSION</strong> to add your first ride.</div>';
    return;
  }
  list.innerHTML = State.sessions.map(s => {
    const d = new Date(s.date + 'T12:00:00');
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
    const dots = Array.from({length: 10}, (_, i) =>
      `<div class="feeling-dot ${i < s.feeling ? 'filled' : ''}"></div>`
    ).join('');
    return `
      <div class="session-card">
        <div class="session-date-block">
          <div class="session-day">${day}</div>
          <div class="session-month">${month}</div>
        </div>
        <div class="session-main">
          <div class="session-track">${esc(s.track)}</div>
          <div class="session-tags">
            <span class="tag hours">${s.hours}h</span>
            <span class="tag">${esc(s.conditions)}</span>
            <span class="tag">${esc(s.type)}</span>
          </div>
          ${s.notes ? `<div class="session-notes-text">${esc(s.notes)}</div>` : ''}
          <div class="session-feeling">
            <div class="feeling-dots">${dots}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- CALENDAR ----
function renderCalendar() {
  const container = document.getElementById('calendar');
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long' }).toUpperCase();

  // Sessions this month keyed by day
  const sessionDays = new Set(
    State.sessions
      .filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(s => new Date(s.date + 'T12:00:00').getDate())
  );

  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const dayLabels = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  let html = `
    <div class="cal-header">
      <button class="cal-nav" id="cal-prev">‹</button>
      <div class="cal-title">${monthName} ${year}</div>
      <button class="cal-nav" id="cal-next">›</button>
    </div>
    <div class="cal-grid">
      ${dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('')}
  `;

  // Prev month overflow
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + i + 1}</div>`;
  }
  // This month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const hasSession = sessionDays.has(d);
    html += `<div class="cal-day${isToday ? ' today' : ''}${hasSession ? ' has-session' : ''}">${d}</div>`;
  }
  // Next month fill
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate = new Date(year, month - 1, 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate = new Date(year, month + 1, 1);
    renderCalendar();
  });
}

// ---- HOURS ----
function renderHours() {
  const sessions = State.sessions;
  const total = sessions.reduce((s, x) => s + x.hours, 0);
  const now = new Date();

  // This week (Mon-Sun)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  weekStart.setHours(0,0,0,0);
  const weekHours = sessions.filter(s => new Date(s.date + 'T12:00:00') >= weekStart).reduce((s,x) => s + x.hours, 0);

  // This month
  const monthHours = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s,x) => s + x.hours, 0);

  setText('stat-total-hours', total % 1 === 0 ? total : total.toFixed(1));
  setText('stat-week-hours', weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1));
  setText('stat-month-hours', monthHours % 1 === 0 ? monthHours : monthHours.toFixed(1));
  setText('stat-sessions', sessions.length);

  // Monthly bar chart (last 6 months)
  const chart = document.getElementById('hours-chart');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hrs = sessions.filter(s => {
      const sd = new Date(s.date + 'T12:00:00');
      return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
    }).reduce((s,x) => s + x.hours, 0);
    months.push({ label: d.toLocaleString('default', { month: 'short' }).toUpperCase(), hrs });
  }
  const maxHrs = Math.max(...months.map(m => m.hrs), 1);
  chart.innerHTML = months.map(m => {
    const pct = (m.hrs / maxHrs) * 100;
    return `<div class="bar-item">
      <div class="bar-fill" style="height:${Math.max(pct, m.hrs > 0 ? 4 : 0)}%"></div>
      <div class="bar-label">${m.label}</div>
    </div>`;
  }).join('');

  // Recent sessions
  const recent = document.getElementById('recent-sessions-list');
  const last5 = sessions.slice(0, 5);
  if (last5.length === 0) {
    recent.innerHTML = '<div class="empty-state-small">No sessions yet.</div>';
  } else {
    recent.innerHTML = last5.map(s => `
      <div class="recent-item">
        <div class="recent-item-left">
          <div class="recent-track">${esc(s.track)}</div>
          <div class="recent-date">${formatDate(s.date)} · ${esc(s.conditions)}</div>
        </div>
        <div class="recent-hours">${s.hours}h</div>
      </div>
    `).join('');
  }
}

// ---- SUSPENSION ----
function renderSuspension() {
  const susp = State.suspension;
  // Populate preset dropdown
  const sel = document.getElementById('susp-preset-select');
  const current = sel.value || susp.activePreset || 'Default';
  sel.innerHTML = Object.keys(susp.presets).map(name =>
    `<option value="${esc(name)}" ${name === current ? 'selected' : ''}>${esc(name)}</option>`
  ).join('');
  loadPreset();
}

function loadPreset() {
  const sel = document.getElementById('susp-preset-select');
  const name = sel.value;
  const preset = State.suspension.presets[name];
  if (!preset) return;
  State.suspension.activePreset = name;
  setVal('fork-comp', preset.forkComp ?? 12);
  setVal('fork-reb', preset.forkReb ?? 12);
  setVal('fork-spring', preset.forkSpring ?? '');
  setVal('fork-oil', preset.forkOil ?? '');
  setVal('fork-sag', preset.forkSag ?? 100);
  setVal('shock-hicomp', preset.shockHiComp ?? 2);
  setVal('shock-locomp', preset.shockLoComp ?? 12);
  setVal('shock-reb', preset.shockReb ?? 12);
  setVal('shock-spring', preset.shockSpring ?? '');
  setVal('shock-sag', preset.shockSag ?? 100);
  setVal('susp-notes', preset.notes ?? '');
}

function saveSuspension() {
  const sel = document.getElementById('susp-preset-select');
  const name = sel.value;
  if (!name) return;
  State.suspension.presets[name] = {
    forkComp: parseInt(getVal('fork-comp')),
    forkReb: parseInt(getVal('fork-reb')),
    forkSpring: getVal('fork-spring'),
    forkOil: getVal('fork-oil'),
    forkSag: parseInt(getVal('fork-sag')),
    shockHiComp: parseInt(getVal('shock-hicomp')),
    shockLoComp: parseInt(getVal('shock-locomp')),
    shockReb: parseInt(getVal('shock-reb')),
    shockSpring: getVal('shock-spring'),
    shockSag: parseInt(getVal('shock-sag')),
    notes: getVal('susp-notes'),
  };
  saveLocal();
  toast(`"${name}" setup saved`, 'success');
}

function createPreset() {
  const name = getVal('preset-name').trim();
  if (!name) { toast('Enter a preset name', 'error'); return; }
  if (State.suspension.presets[name]) { toast('Preset already exists', 'error'); return; }
  // Copy current values as starting point
  saveSuspension();
  State.suspension.presets[name] = { ...State.suspension.presets[document.getElementById('susp-preset-select').value] };
  closeModal('modal-preset');
  setVal('preset-name', '');
  State.suspension.activePreset = name;
  renderSuspension();
  // Select new preset
  document.getElementById('susp-preset-select').value = name;
  toast(`Preset "${name}" created`, 'success');
}

function deletePreset() {
  const sel = document.getElementById('susp-preset-select');
  const name = sel.value;
  if (name === 'Default') { toast("Can't delete Default preset", 'error'); return; }
  if (!confirm(`Delete preset "${name}"?`)) return;
  delete State.suspension.presets[name];
  State.suspension.activePreset = 'Default';
  renderSuspension();
  toast(`Preset "${name}" deleted`, 'success');
}

// ---- TOAST ----
let toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---- UTILS ----
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- SERVICE WORKER REGISTRATION ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
  });
}
