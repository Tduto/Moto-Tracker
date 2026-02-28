// =========================================
// MotoTracker — Main App Logic + AI Coach
// =========================================

// ---- STATE ----
const State = {
  profile: {
    name: '', class: 'Amateur',
    make: '', model: '', year: '', engine: '',
    tireFront: '', tireRear: '', psiFront: '', psiRear: '',
    setupNotes: '',
    injuries: [],
  },
  sessions: [],
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
let coachHistory = []; // conversation history for AI coach

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
  document.getElementById('btn-connect').addEventListener('click', handleConnect);
  document.getElementById('btn-demo').addEventListener('click', handleDemo);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-sync').addEventListener('click', syncAll);

  // Profile
  document.getElementById('btn-edit-profile').addEventListener('click', () => openModal('modal-profile', populateProfileModal));
  document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
  document.getElementById('btn-add-injury').addEventListener('click', () => openModal('modal-injury'));
  document.getElementById('btn-save-injury').addEventListener('click', saveInjury);

  // Sessions
  document.getElementById('btn-add-session').addEventListener('click', () => openModal('modal-session'));
  document.getElementById('btn-save-session').addEventListener('click', saveSession);
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

  // ---- AI COACH EVENTS ----
  document.getElementById('btn-susp-advice').addEventListener('click', () => {
    switchTab('coach');
    triggerCoachTopic('suspension');
  });

  document.getElementById('btn-injury-advice').addEventListener('click', () => {
    switchTab('coach');
    triggerCoachTopic('injury');
  });

  document.querySelectorAll('.coach-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => triggerCoachTopic(btn.dataset.type));
  });

  document.getElementById('btn-coach-send').addEventListener('click', sendCoachMessage);

  document.getElementById('coach-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCoachMessage();
    }
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
  list.innerHTML = injuries.map(inj => `
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
  setVal('edit-name', p.name); setVal('edit-class', p.class);
  setVal('edit-make', p.make); setVal('edit-model', p.model);
  setVal('edit-year', p.year); setVal('edit-engine', p.engine);
  setVal('edit-tire-front', p.tireFront); setVal('edit-tire-rear', p.tireRear);
  setVal('edit-psi-front', p.psiFront); setVal('edit-psi-rear', p.psiRear);
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
    id: Date.now(), desc,
    date: getVal('injury-date'),
    status: getVal('injury-status'),
    notes: getVal('injury-notes'),
  });
  closeModal('modal-injury');
  setVal('injury-desc', ''); setVal('injury-notes', '');
  renderInjuries();
  saveLocal();
  toast('Injury logged', 'success');
}

// ---- SESSIONS ----
function saveSession() {
  const track = getVal('session-track');
  if (!track) { toast('Please enter a track name', 'error'); return; }
  const hours = parseFloat(getVal('session-hours'));
  if (!hours || hours <= 0) { toast('Please enter valid hours', 'error'); return; }

  State.sessions.unshift({
    id: Date.now(), track,
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
  list.innerHTML = State.sessions.map((s, idx) => {
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
          <div class="session-feeling"><div class="feeling-dots">${dots}</div></div>
          <button class="session-ai-btn" data-idx="${idx}">⚡ AI ANALYSIS</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind session AI buttons
  document.querySelectorAll('.session-ai-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const session = State.sessions[parseInt(btn.dataset.idx)];
      switchTab('coach');
      triggerSessionAnalysis(session);
    });
  });
}

// ---- CALENDAR ----
function renderCalendar() {
  const container = document.getElementById('calendar');
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long' }).toUpperCase();

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
  for (let i = 0; i < firstDay; i++)
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + i + 1}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const hasSession = sessionDays.has(d);
    html += `<div class="cal-day${isToday ? ' today' : ''}${hasSession ? ' has-session' : ''}">${d}</div>`;
  }
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++)
    html += `<div class="cal-day other-month">${d}</div>`;
  html += '</div>';
  container.innerHTML = html;

  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate = new Date(year, month - 1, 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate = new Date(year, month + 1, 1); renderCalendar(); });
}

// ---- HOURS ----
function renderHours() {
  const sessions = State.sessions;
  const total = sessions.reduce((s, x) => s + x.hours, 0);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  weekStart.setHours(0,0,0,0);
  const weekHours = sessions.filter(s => new Date(s.date + 'T12:00:00') >= weekStart).reduce((s,x) => s + x.hours, 0);
  const monthHours = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s,x) => s + x.hours, 0);

  setText('stat-total-hours', total % 1 === 0 ? total : total.toFixed(1));
  setText('stat-week-hours', weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1));
  setText('stat-month-hours', monthHours % 1 === 0 ? monthHours : monthHours.toFixed(1));
  setText('stat-sessions', sessions.length);

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
    return `<div class="bar-item"><div class="bar-fill" style="height:${Math.max(pct, m.hrs > 0 ? 4 : 0)}%"></div><div class="bar-label">${m.label}</div></div>`;
  }).join('');

  const recent = document.getElementById('recent-sessions-list');
  const last5 = sessions.slice(0, 5);
  recent.innerHTML = last5.length === 0
    ? '<div class="empty-state-small">No sessions yet.</div>'
    : last5.map(s => `
        <div class="recent-item">
          <div class="recent-item-left">
            <div class="recent-track">${esc(s.track)}</div>
            <div class="recent-date">${formatDate(s.date)} · ${esc(s.conditions)}</div>
          </div>
          <div class="recent-hours">${s.hours}h</div>
        </div>
      `).join('');
}

// ---- SUSPENSION ----
function renderSuspension() {
  const susp = State.suspension;
  const sel = document.getElementById('susp-preset-select');
  const current = sel.value || susp.activePreset || 'Default';
  sel.innerHTML = Object.keys(susp.presets).map(name =>
    `<option value="${esc(name)}" ${name === current ? 'selected' : ''}>${esc(name)}</option>`
  ).join('');
  loadPreset();
}

function loadPreset() {
  const name = document.getElementById('susp-preset-select').value;
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
  const name = document.getElementById('susp-preset-select').value;
  if (!name) return;
  State.suspension.presets[name] = {
    forkComp: parseInt(getVal('fork-comp')), forkReb: parseInt(getVal('fork-reb')),
    forkSpring: getVal('fork-spring'), forkOil: getVal('fork-oil'),
    forkSag: parseInt(getVal('fork-sag')),
    shockHiComp: parseInt(getVal('shock-hicomp')), shockLoComp: parseInt(getVal('shock-locomp')),
    shockReb: parseInt(getVal('shock-reb')), shockSpring: getVal('shock-spring'),
    shockSag: parseInt(getVal('shock-sag')), notes: getVal('susp-notes'),
  };
  saveLocal();
  toast(`"${name}" setup saved`, 'success');
}

function createPreset() {
  const name = getVal('preset-name').trim();
  if (!name) { toast('Enter a preset name', 'error'); return; }
  if (State.suspension.presets[name]) { toast('Preset already exists', 'error'); return; }
  saveSuspension();
  State.suspension.presets[name] = { ...State.suspension.presets[document.getElementById('susp-preset-select').value] };
  closeModal('modal-preset');
  setVal('preset-name', '');
  State.suspension.activePreset = name;
  renderSuspension();
  document.getElementById('susp-preset-select').value = name;
  toast(`Preset "${name}" created`, 'success');
}

function deletePreset() {
  const name = document.getElementById('susp-preset-select').value;
  if (name === 'Default') { toast("Can't delete Default preset", 'error'); return; }
  if (!confirm(`Delete preset "${name}"?`)) return;
  delete State.suspension.presets[name];
  State.suspension.activePreset = 'Default';
  renderSuspension();
  toast(`Preset "${name}" deleted`, 'success');
}

// =========================================
// AI COACH
// =========================================

function buildRiderContext() {
  const p = State.profile;
  const susp = State.suspension;
  const activePreset = susp.presets[susp.activePreset] || {};
  const recentSessions = State.sessions.slice(0, 5);
  const activeInjuries = (p.injuries || []).filter(i => i.status === 'active' || i.status === 'chronic');

  return `
RIDER PROFILE:
- Name: ${p.name || 'Unknown'}, Class: ${p.class || 'Unknown'}
- Bike: ${p.year || '?'} ${p.make || '?'} ${p.model || '?'} (${p.engine || '?'})
- Tires: Front ${p.tireFront || 'unknown'} @ ${p.psiFront || '?'} psi, Rear ${p.tireRear || 'unknown'} @ ${p.psiRear || '?'} psi
- Setup notes: ${p.setupNotes || 'None'}

CURRENT SUSPENSION PRESET (${susp.activePreset}):
- Forks: Compression ${activePreset.forkComp ?? '?'} clicks, Rebound ${activePreset.forkReb ?? '?'} clicks, Spring ${activePreset.forkSpring || '?'} N/mm, Oil level ${activePreset.forkOil || '?'} mm, Sag ${activePreset.forkSag ?? '?'} mm
- Shock: Hi-comp ${activePreset.shockHiComp ?? '?'} clicks, Lo-comp ${activePreset.shockLoComp ?? '?'} clicks, Rebound ${activePreset.shockReb ?? '?'} clicks, Spring ${activePreset.shockSpring || '?'} N/mm, Race sag ${activePreset.shockSag ?? '?'} mm
- Notes: ${activePreset.notes || 'None'}
- All presets: ${Object.keys(susp.presets).join(', ')}

RECENT SESSIONS (last 5):
${recentSessions.length === 0 ? 'No sessions logged yet.' : recentSessions.map(s =>
  `- ${s.date}: ${s.track}, ${s.hours}h, ${s.conditions}, ${s.type}, Feel: ${s.feeling}/10${s.notes ? ', Notes: ' + s.notes : ''}`
).join('\n')}

ACTIVE/CHRONIC INJURIES:
${activeInjuries.length === 0 ? 'None' : activeInjuries.map(i =>
  `- ${i.desc} (${i.status}) since ${i.date}${i.notes ? ': ' + i.notes : ''}`
).join('\n')}

Total sessions: ${State.sessions.length}, Total hours: ${State.sessions.reduce((s,x) => s+x.hours, 0).toFixed(1)}h
`.trim();
}

function getSystemPrompt() {
  return `You are an expert motocross and dirt bike coach and suspension tuner with 20+ years of experience. You have deep knowledge of MX suspension setup, race craft, injury management, and training protocols.

You have access to this rider's complete profile and data:

${buildRiderContext()}

RESPONSE STYLE:
- Be direct, specific, and actionable — like a real coach talking to a rider
- Use the rider's actual data (specific click numbers, track names, conditions) in your advice
- Keep responses concise but thorough — no fluff
- Structure advice with clear sections when giving multiple recommendations
- If data is missing, say what info would help you give better advice
- Use motocross terminology naturally
- Always consider active injuries when giving training recommendations`;
}

function getTopicPrompt(type) {
  const prompts = {
    suspension: `Analyse my current suspension setup and give me specific tuning recommendations. Look at my click settings, sag measurements, and recent session conditions/feel ratings. Tell me exactly what to adjust and why.`,

    session: `Analyse my recent sessions. Look at my feel ratings, track conditions, hours ridden, and any notes. Identify patterns — what's working, what needs improvement, and what should I focus on next session?`,

    injury: `Based on my active injuries and riding history, give me training recommendations. What should I avoid, what can I do to stay fit while managing my injuries, and what should I prioritise when I'm back on the bike?`,

    compare: `Compare my suspension presets and session data across different track conditions. Which setup is performing best and what tweaks would you suggest for each condition type?`,
  };
  return prompts[type] || `Give me coaching advice based on my profile and recent sessions.`;
}

async function callClaudeAPI(messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: getSystemPrompt(),
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'API error');
  return data.content[0].text;
}

function addChatMessage(role, text) {
  const chat = document.getElementById('coach-chat');

  // Remove welcome message on first message
  const welcome = chat.querySelector('.coach-welcome');
  if (welcome) welcome.remove();

  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = formatCoachResponse(text);
  } else {
    bubble.textContent = text;
  }

  msg.appendChild(bubble);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

function formatCoachResponse(text) {
  // Convert markdown-style formatting to structured HTML
  let html = text
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Section headers (lines ending with : or starting with #)
    .replace(/^#{1,3}\s+(.+)$/gm, '<div class="advice-heading">$1</div>')
    // Bullet points
    .replace(/^[-•]\s+(.+)$/gm, '<div class="advice-item"><span class="advice-bullet">›</span><span>$1</span></div>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<div class="advice-item"><span class="advice-bullet">›</span><span>$1</span></div>')
    // Line breaks
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

function showTypingIndicator() {
  const chat = document.getElementById('coach-chat');
  const msg = document.createElement('div');
  msg.className = 'chat-msg assistant';
  msg.id = 'typing-indicator';
  msg.innerHTML = `<div class="chat-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function triggerCoachTopic(type) {
  // Highlight active button
  document.querySelectorAll('.coach-quick-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  const userMsg = getTopicPrompt(type);
  coachHistory.push({ role: 'user', content: userMsg });
  addChatMessage('user', userMsg);

  const sendBtn = document.getElementById('btn-coach-send');
  sendBtn.disabled = true;
  showTypingIndicator();

  try {
    const reply = await callClaudeAPI(coachHistory);
    removeTypingIndicator();
    coachHistory.push({ role: 'assistant', content: reply });
    addChatMessage('assistant', reply);
  } catch (e) {
    removeTypingIndicator();
    addChatMessage('assistant', `⚠️ Coach unavailable right now. Error: ${e.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

async function triggerSessionAnalysis(session) {
  const userMsg = `Analyse this specific session for me: ${session.date} at ${session.track}. Conditions: ${session.conditions}, Type: ${session.type}, Hours: ${session.hours}h, Feel: ${session.feeling}/10.${session.notes ? ' My notes: ' + session.notes : ''} What does this tell you and what should I work on?`;

  coachHistory.push({ role: 'user', content: userMsg });
  addChatMessage('user', userMsg);

  const sendBtn = document.getElementById('btn-coach-send');
  sendBtn.disabled = true;
  showTypingIndicator();

  try {
    const reply = await callClaudeAPI(coachHistory);
    removeTypingIndicator();
    coachHistory.push({ role: 'assistant', content: reply });
    addChatMessage('assistant', reply);
  } catch (e) {
    removeTypingIndicator();
    addChatMessage('assistant', `⚠️ Coach unavailable: ${e.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

async function sendCoachMessage() {
  const input = document.getElementById('coach-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  coachHistory.push({ role: 'user', content: text });
  addChatMessage('user', text);

  const sendBtn = document.getElementById('btn-coach-send');
  sendBtn.disabled = true;
  showTypingIndicator();

  try {
    const reply = await callClaudeAPI(coachHistory);
    removeTypingIndicator();
    coachHistory.push({ role: 'assistant', content: reply });
    addChatMessage('assistant', reply);
  } catch (e) {
    removeTypingIndicator();
    addChatMessage('assistant', `⚠️ Coach unavailable: ${e.message}`);
  } finally {
    sendBtn.disabled = false;
  }
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
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
  });
}
