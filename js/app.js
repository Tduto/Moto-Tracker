// =========================================
// MotoTracker — Main App Logic + AI Coach
// =========================================

const State = {
  profile: {
    name: '', class: 'Amateur',
    make: '', model: '', year: '', engine: '',
    tireFront: '', tireRear: '', psiFront: '', psiRear: '',
    setupNotes: '', injuries: [],
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
let coachHistory = [];

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  const hasConfig = GitHub.loadConfig();
  if (hasConfig && GitHub.isConfigured()) {
    loadFromLocalCache();
    renderAll();
    showMain();
    loadFromGitHub();
  } else {
    showSetup();
  }
  bindEvents();
  setTodayDates();
});

function setTodayDates() {
  const today = new Date().toISOString().slice(0, 10);
  const i = document.getElementById('injury-date');
  const s = document.getElementById('session-date');
  if (i) i.value = today;
  if (s) s.value = today;
}

// ---- SCREENS ----
function showSetup() {
  document.getElementById('screen-setup').classList.add('active');
  document.getElementById('screen-main').classList.remove('active');
}
function showMain() {
  document.getElementById('screen-setup').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
}

// ---- LOCAL CACHE ----
function loadFromLocalCache() {
  try {
    const p = localStorage.getItem('moto_local_profile');
    const s = localStorage.getItem('moto_local_sessions');
    const su = localStorage.getItem('moto_local_suspension');
    if (p) State.profile = JSON.parse(p);
    if (s) State.sessions = JSON.parse(s);
    if (su) State.suspension = JSON.parse(su);
  } catch(e) { console.warn('Cache load error:', e); }
}

function persistLocalCache() {
  try {
    localStorage.setItem('moto_local_profile', JSON.stringify(State.profile));
    localStorage.setItem('moto_local_sessions', JSON.stringify(State.sessions));
    localStorage.setItem('moto_local_suspension', JSON.stringify(State.suspension));
  } catch(e) { console.warn('Cache save error:', e); }
}

// ---- GITHUB LOAD (background) ----
async function loadFromGitHub() {
  try {
    const [profile, sessions, suspension] = await Promise.all([
      GitHub.loadData('profile'),
      GitHub.loadData('sessions'),
      GitHub.loadData('suspension'),
    ]);
    if (profile) State.profile = profile;
    if (sessions) State.sessions = sessions;
    if (suspension) State.suspension = suspension;
    persistLocalCache();
    renderAll();
  } catch(e) {
    console.warn('GitHub load (using local cache):', e.message);
  }
}

// ---- SYNC TO GITHUB ----
async function syncAll() {
  if (isSyncing) return;
  if (GitHub.isDemoMode()) { toast('Demo mode — saved locally', 'success'); return; }
  isSyncing = true;
  const btn = document.getElementById('btn-sync');
  btn.classList.add('syncing');
  try {
    // Save profile from inline fields first
    readProfileFromFields();
    await Promise.all([
      GitHub.saveData('profile', State.profile),
      GitHub.saveData('sessions', State.sessions),
      GitHub.saveData('suspension', State.suspension),
    ]);
    persistLocalCache();
    toast('Synced to GitHub ✓', 'success');
  } catch(e) {
    let msg = e.message || 'Unknown error';
    if (msg.includes('Not Found') || msg.includes('404')) msg = 'Repo not found — check repo name';
    else if (msg.includes('Bad credentials') || msg.includes('401')) msg = 'Bad token — reconnect in settings';
    else if (msg.includes('403')) msg = 'Token needs repo scope';
    toast('Sync failed: ' + msg, 'error');
  } finally {
    isSyncing = false;
    btn.classList.remove('syncing');
  }
}

function saveLocal() {
  readProfileFromFields();
  persistLocalCache();
}

// ---- EVENTS ----
function bindEvents() {
  document.getElementById('btn-connect').addEventListener('click', handleConnect);
  document.getElementById('btn-demo').addEventListener('click', handleDemo);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-sync').addEventListener('click', syncAll);

  // Sign out
  document.getElementById('btn-signout').addEventListener('click', handleSignOut);

  // Profile inline — auto-save on blur
  document.getElementById('btn-save-profile-inline').addEventListener('click', () => {
    saveLocal();
    toast('Profile saved ✓', 'success');
  });
  ['edit-name','edit-class','edit-make','edit-model','edit-year','edit-engine',
   'edit-tire-front','edit-tire-rear','edit-psi-front','edit-psi-rear','edit-setup-notes'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', saveLocal);
  });

  document.getElementById('btn-add-injury').addEventListener('click', () => openModal('modal-injury'));
  document.getElementById('btn-save-injury').addEventListener('click', saveInjury);

  document.getElementById('btn-add-session').addEventListener('click', () => openModal('modal-session'));
  document.getElementById('btn-save-session').addEventListener('click', saveSession);

  const feelSlider = document.getElementById('session-feeling');
  if (feelSlider) feelSlider.addEventListener('input', () => {
    document.getElementById('feeling-display').textContent = feelSlider.value;
  });

  document.getElementById('btn-save-suspension').addEventListener('click', saveSuspension);
  document.getElementById('btn-new-preset').addEventListener('click', () => openModal('modal-preset'));
  document.getElementById('btn-confirm-preset').addEventListener('click', createPreset);
  document.getElementById('btn-delete-preset').addEventListener('click', deletePreset);
  document.getElementById('susp-preset-select').addEventListener('change', loadPreset);

  document.querySelectorAll('.click-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.field);
      const val = parseInt(input.value) || 0;
      input.value = Math.min(parseInt(input.max)||999, Math.max(parseInt(input.min)||0, val + parseInt(btn.dataset.dir)));
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });

  // AI Coach
  document.getElementById('btn-susp-advice').addEventListener('click', () => { switchTab('coach'); triggerCoachTopic('suspension'); });
  document.getElementById('btn-injury-advice').addEventListener('click', () => { switchTab('coach'); triggerCoachTopic('injury'); });
  document.querySelectorAll('.coach-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => triggerCoachTopic(btn.dataset.type));
  });
  document.getElementById('btn-coach-send').addEventListener('click', sendCoachMessage);
  document.getElementById('coach-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCoachMessage(); }
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
    loadFromLocalCache();
    renderAll();
    showMain();
    loadFromGitHub();
    toast('Connected to GitHub ✓', 'success');
  } catch(e) {
    toast('Connection failed: ' + e.message, 'error');
    btn.textContent = 'CONNECT & START'; btn.disabled = false;
  }
}

function handleDemo() {
  GitHub.setConfig('demo', 'demo', '__DEMO__');
  showMain();
  renderAll();
  toast('Demo mode — data saved locally', 'success');
}

function handleSignOut() {
  if (!confirm('Sign out and disconnect from GitHub?\n\nYour locally cached data will be kept.')) return;
  localStorage.removeItem('moto_gh_config');
  // Pre-fill setup form with last used values so easy to reconnect
  const username = document.getElementById('gh-username');
  const repo = document.getElementById('gh-repo');
  if (username) username.value = 'Tduto';
  if (repo) repo.value = 'moto-data';
  document.getElementById('gh-token').value = '';
  showSetup();
  toast('Signed out', 'success');
}

// ---- TABS ----
function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tabId}`));
  if (tabId === 'hours') renderHours();
  if (tabId === 'suspension') renderSuspension();
  if (tabId === 'tracks') renderCalendar();
}

function openModal(id, fn) { if (fn) fn(); document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ---- RENDER ----
function renderAll() {
  renderProfile();
  renderSessions();
  renderCalendar();
}

// ---- PROFILE ----
function readProfileFromFields() {
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
}

function renderProfile() {
  const p = State.profile;
  setVal('edit-name', p.name);
  setVal('edit-class', p.class || 'Amateur');
  setVal('edit-make', p.make);
  setVal('edit-model', p.model);
  setVal('edit-year', p.year);
  setVal('edit-engine', p.engine);
  setVal('edit-tire-front', p.tireFront);
  setVal('edit-tire-rear', p.tireRear);
  setVal('edit-psi-front', p.psiFront);
  setVal('edit-psi-rear', p.psiRear);
  setVal('edit-setup-notes', p.setupNotes);
  renderInjuries();
}

function renderInjuries() {
  const list = document.getElementById('injuries-list');
  const injuries = State.profile.injuries || [];
  if (!injuries.length) { list.innerHTML = '<div class="empty-state-small">No injuries logged.</div>'; return; }
  list.innerHTML = injuries.map(inj => `
    <div class="injury-item ${inj.status}">
      <div class="injury-info">
        <div class="injury-desc">${esc(inj.desc)}</div>
        <div class="injury-meta">${formatDate(inj.date)}${inj.notes ? ' · ' + esc(inj.notes) : ''}</div>
      </div>
      <div class="injury-badge ${inj.status}">${inj.status}</div>
    </div>`).join('');
}

function saveInjury() {
  const desc = getVal('injury-desc');
  if (!desc) { toast('Please enter an injury description', 'error'); return; }
  if (!State.profile.injuries) State.profile.injuries = [];
  State.profile.injuries.unshift({ id: Date.now(), desc, date: getVal('injury-date'), status: getVal('injury-status'), notes: getVal('injury-notes') });
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
    id: Date.now(), track, date: getVal('session-date'), hours,
    conditions: getVal('session-conditions'), type: getVal('session-type'),
    notes: getVal('session-notes'), feeling: parseInt(document.getElementById('session-feeling').value),
  });
  closeModal('modal-session');
  setVal('session-track', ''); setVal('session-hours', ''); setVal('session-notes', '');
  document.getElementById('session-feeling').value = 7;
  document.getElementById('feeling-display').textContent = '7';
  renderSessions(); renderCalendar();
  if (document.getElementById('tab-hours').classList.contains('active')) renderHours();
  saveLocal();
  toast('Session logged!', 'success');
}

function renderSessions() {
  const list = document.getElementById('sessions-list');
  if (!State.sessions.length) {
    list.innerHTML = '<div class="empty-state">No sessions logged yet.<br>Tap <strong>+ SESSION</strong> to add your first ride.</div>';
    return;
  }
  list.innerHTML = State.sessions.map((s, idx) => {
    const d = new Date(s.date + 'T12:00:00');
    const dots = Array.from({length:10},(_,i) => `<div class="feeling-dot ${i<s.feeling?'filled':''}"></div>`).join('');
    return `<div class="session-card">
      <div class="session-date-block">
        <div class="session-day">${d.getDate()}</div>
        <div class="session-month">${d.toLocaleString('default',{month:'short'}).toUpperCase()}</div>
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
    </div>`;
  }).join('');
  document.querySelectorAll('.session-ai-btn').forEach(btn => {
    btn.addEventListener('click', () => { switchTab('coach'); triggerSessionAnalysis(State.sessions[parseInt(btn.dataset.idx)]); });
  });
}

// ---- CALENDAR ----
function renderCalendar() {
  const container = document.getElementById('calendar');
  const year = calendarDate.getFullYear(), month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', {month:'long'}).toUpperCase();
  const sessionDays = new Set(State.sessions.filter(s => {
    const d = new Date(s.date+'T12:00:00');
    return d.getFullYear()===year && d.getMonth()===month;
  }).map(s => new Date(s.date+'T12:00:00').getDate()));
  const today = new Date();
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const daysInPrev = new Date(year,month,0).getDate();
  let html = `<div class="cal-header"><button class="cal-nav" id="cal-prev">‹</button><div class="cal-title">${monthName} ${year}</div><button class="cal-nav" id="cal-next">›</button></div><div class="cal-grid">`;
  ['SUN','MON','TUE','WED','THU','FRI','SAT'].forEach(d => html += `<div class="cal-day-label">${d}</div>`);
  for (let i=0;i<firstDay;i++) html += `<div class="cal-day other-month">${daysInPrev-firstDay+i+1}</div>`;
  for (let d=1;d<=daysInMonth;d++) {
    const isToday = today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;
    html += `<div class="cal-day${isToday?' today':''}${sessionDays.has(d)?' has-session':''}">${d}</div>`;
  }
  const total = Math.ceil((firstDay+daysInMonth)/7)*7;
  for (let d=1;d<=total-firstDay-daysInMonth;d++) html += `<div class="cal-day other-month">${d}</div>`;
  html += '</div>';
  container.innerHTML = html;
  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate=new Date(year,month-1,1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate=new Date(year,month+1,1); renderCalendar(); });
}

// ---- HOURS ----
function renderHours() {
  const sessions = State.sessions;
  const total = sessions.reduce((s,x) => s+x.hours, 0);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));
  weekStart.setHours(0,0,0,0);
  const weekHours = sessions.filter(s => new Date(s.date+'T12:00:00')>=weekStart).reduce((s,x)=>s+x.hours,0);
  const monthHours = sessions.filter(s => { const d=new Date(s.date+'T12:00:00'); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }).reduce((s,x)=>s+x.hours,0);
  setText('stat-total-hours', total%1===0?total:total.toFixed(1));
  setText('stat-week-hours', weekHours%1===0?weekHours:weekHours.toFixed(1));
  setText('stat-month-hours', monthHours%1===0?monthHours:monthHours.toFixed(1));
  setText('stat-sessions', sessions.length);
  const months = [];
  for (let i=5;i>=0;i--) {
    const d = new Date(now.getFullYear(),now.getMonth()-i,1);
    const hrs = sessions.filter(s=>{const sd=new Date(s.date+'T12:00:00');return sd.getMonth()===d.getMonth()&&sd.getFullYear()===d.getFullYear();}).reduce((s,x)=>s+x.hours,0);
    months.push({label:d.toLocaleString('default',{month:'short'}).toUpperCase(),hrs});
  }
  const maxHrs = Math.max(...months.map(m=>m.hrs),1);
  document.getElementById('hours-chart').innerHTML = months.map(m =>
    `<div class="bar-item"><div class="bar-fill" style="height:${Math.max((m.hrs/maxHrs)*100,m.hrs>0?4:0)}%"></div><div class="bar-label">${m.label}</div></div>`
  ).join('');
  const last5 = sessions.slice(0,5);
  document.getElementById('recent-sessions-list').innerHTML = !last5.length
    ? '<div class="empty-state-small">No sessions yet.</div>'
    : last5.map(s=>`<div class="recent-item"><div class="recent-item-left"><div class="recent-track">${esc(s.track)}</div><div class="recent-date">${formatDate(s.date)} · ${esc(s.conditions)}</div></div><div class="recent-hours">${s.hours}h</div></div>`).join('');
}

// ---- SUSPENSION ----
function renderSuspension() {
  const sel = document.getElementById('susp-preset-select');
  const current = sel.value || State.suspension.activePreset || 'Default';
  sel.innerHTML = Object.keys(State.suspension.presets).map(n => `<option value="${esc(n)}"${n===current?' selected':''}>${esc(n)}</option>`).join('');
  loadPreset();
}

function loadPreset() {
  const name = document.getElementById('susp-preset-select').value;
  const p = State.suspension.presets[name];
  if (!p) return;
  State.suspension.activePreset = name;
  setVal('fork-comp',p.forkComp??12); setVal('fork-reb',p.forkReb??12);
  setVal('fork-spring',p.forkSpring??''); setVal('fork-oil',p.forkOil??''); setVal('fork-sag',p.forkSag??100);
  setVal('shock-hicomp',p.shockHiComp??2); setVal('shock-locomp',p.shockLoComp??12);
  setVal('shock-reb',p.shockReb??12); setVal('shock-spring',p.shockSpring??''); setVal('shock-sag',p.shockSag??100);
  setVal('susp-notes',p.notes??'');
}

function saveSuspension() {
  const name = document.getElementById('susp-preset-select').value;
  if (!name) return;
  State.suspension.presets[name] = {
    forkComp:parseInt(getVal('fork-comp')), forkReb:parseInt(getVal('fork-reb')),
    forkSpring:getVal('fork-spring'), forkOil:getVal('fork-oil'), forkSag:parseInt(getVal('fork-sag')),
    shockHiComp:parseInt(getVal('shock-hicomp')), shockLoComp:parseInt(getVal('shock-locomp')),
    shockReb:parseInt(getVal('shock-reb')), shockSpring:getVal('shock-spring'), shockSag:parseInt(getVal('shock-sag')),
    notes:getVal('susp-notes'),
  };
  saveLocal();
  toast(`"${name}" saved`, 'success');
}

function createPreset() {
  const name = getVal('preset-name').trim();
  if (!name) { toast('Enter a preset name','error'); return; }
  if (State.suspension.presets[name]) { toast('Preset already exists','error'); return; }
  saveSuspension();
  State.suspension.presets[name] = {...State.suspension.presets[document.getElementById('susp-preset-select').value]};
  closeModal('modal-preset'); setVal('preset-name','');
  State.suspension.activePreset = name;
  renderSuspension();
  document.getElementById('susp-preset-select').value = name;
  toast(`Preset "${name}" created`,'success');
}

function deletePreset() {
  const name = document.getElementById('susp-preset-select').value;
  if (name==='Default') { toast("Can't delete Default",'error'); return; }
  if (!confirm(`Delete preset "${name}"?`)) return;
  delete State.suspension.presets[name];
  State.suspension.activePreset = 'Default';
  renderSuspension();
  toast(`"${name}" deleted`,'success');
}

// =========================================
// AI COACH
// =========================================

function buildRiderContext() {
  const p = State.profile;
  const susp = State.suspension;
  const preset = susp.presets[susp.activePreset] || {};
  const recent = State.sessions.slice(0,5);
  const activeInjuries = (p.injuries||[]).filter(i=>i.status==='active'||i.status==='chronic');
  return `RIDER: ${p.name||'Unknown'}, Class: ${p.class||'Unknown'}
BIKE: ${p.year||'?'} ${p.make||'?'} ${p.model||'?'} (${p.engine||'?'})
TIRES: Front ${p.tireFront||'?'} @ ${p.psiFront||'?'}psi, Rear ${p.tireRear||'?'} @ ${p.psiRear||'?'}psi
SETUP NOTES: ${p.setupNotes||'None'}

SUSPENSION PRESET (${susp.activePreset}):
Forks: Comp ${preset.forkComp??'?'} clicks, Reb ${preset.forkReb??'?'} clicks, Spring ${preset.forkSpring||'?'} N/mm, Oil ${preset.forkOil||'?'}mm, Sag ${preset.forkSag??'?'}mm
Shock: Hi-Comp ${preset.shockHiComp??'?'}, Lo-Comp ${preset.shockLoComp??'?'}, Reb ${preset.shockReb??'?'}, Spring ${preset.shockSpring||'?'} N/mm, Sag ${preset.shockSag??'?'}mm
Notes: ${preset.notes||'None'}
All presets: ${Object.keys(susp.presets).join(', ')}

RECENT SESSIONS:
${!recent.length ? 'None yet.' : recent.map(s=>`- ${s.date}: ${s.track}, ${s.hours}h, ${s.conditions}, ${s.type}, Feel: ${s.feeling}/10${s.notes?', '+s.notes:''}`).join('\n')}

ACTIVE INJURIES:
${!activeInjuries.length ? 'None' : activeInjuries.map(i=>`- ${i.desc} (${i.status}) since ${i.date}${i.notes?': '+i.notes:''}`).join('\n')}

Total: ${State.sessions.length} sessions, ${State.sessions.reduce((s,x)=>s+x.hours,0).toFixed(1)}h`;
}

function getTopicPrompt(type) {
  const prompts = {
    suspension: 'Analyse my current suspension setup and give me specific tuning recommendations based on my click settings, sag, and recent session conditions and feel ratings.',
    session: 'Analyse my recent sessions. Look at my feel ratings, conditions, and notes. What patterns do you see and what should I focus on next?',
    injury: 'Based on my active injuries and riding history, give me training recommendations. What should I avoid and what can I do to stay fit?',
    compare: 'Compare my suspension presets and sessions across different conditions. Which setup is performing best and what tweaks do you suggest?',
  };
  return prompts[type] || 'Give me coaching advice based on my profile and sessions.';
}

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert motocross coach and suspension tuner with 20+ years experience. Be direct, specific and actionable. Use the rider's actual data in your advice. Here is their data:\n\n${buildRiderContext()}`,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'API error');
  return data.content[0].text;
}

function addMessage(role, text) {
  const chat = document.getElementById('coach-chat');
  const welcome = chat.querySelector('.coach-welcome');
  if (welcome) welcome.remove();
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = role === 'assistant' ? formatCoachResponse(text) : esc(text);
  msg.appendChild(bubble);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function formatCoachResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<div class="advice-heading">$1</div>')
    .replace(/^[-•]\s+(.+)$/gm, '<div class="advice-item"><span class="advice-bullet">›</span><span>$1</span></div>')
    .replace(/^\d+\.\s+(.+)$/gm, '<div class="advice-item"><span class="advice-bullet">›</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

function showTyping() {
  const chat = document.getElementById('coach-chat');
  const el = document.createElement('div');
  el.className = 'chat-msg assistant'; el.id = 'typing-indicator';
  el.innerHTML = '<div class="chat-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
  chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
}
function hideTyping() { const el = document.getElementById('typing-indicator'); if (el) el.remove(); }

async function triggerCoachTopic(type) {
  document.querySelectorAll('.coach-quick-btn').forEach(b => b.classList.toggle('active', b.dataset.type===type));
  const msg = getTopicPrompt(type);
  coachHistory.push({role:'user', content:msg});
  addMessage('user', msg);
  document.getElementById('btn-coach-send').disabled = true;
  showTyping();
  try {
    const reply = await callClaude(coachHistory);
    hideTyping();
    coachHistory.push({role:'assistant', content:reply});
    addMessage('assistant', reply);
  } catch(e) {
    hideTyping();
    addMessage('assistant', `⚠️ Coach unavailable: ${e.message}`);
  } finally {
    document.getElementById('btn-coach-send').disabled = false;
  }
}

async function triggerSessionAnalysis(session) {
  const msg = `Analyse this session: ${session.date} at ${session.track}. Conditions: ${session.conditions}, Type: ${session.type}, Hours: ${session.hours}h, Feel: ${session.feeling}/10.${session.notes?' Notes: '+session.notes:''} What does this tell you and what should I work on?`;
  coachHistory.push({role:'user', content:msg});
  addMessage('user', msg);
  document.getElementById('btn-coach-send').disabled = true;
  showTyping();
  try {
    const reply = await callClaude(coachHistory);
    hideTyping();
    coachHistory.push({role:'assistant', content:reply});
    addMessage('assistant', reply);
  } catch(e) {
    hideTyping();
    addMessage('assistant', `⚠️ Coach unavailable: ${e.message}`);
  } finally {
    document.getElementById('btn-coach-send').disabled = false;
  }
}

async function sendCoachMessage() {
  const input = document.getElementById('coach-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  coachHistory.push({role:'user', content:text});
  addMessage('user', text);
  document.getElementById('btn-coach-send').disabled = true;
  showTyping();
  try {
    const reply = await callClaude(coachHistory);
    hideTyping();
    coachHistory.push({role:'assistant', content:reply});
    addMessage('assistant', reply);
  } catch(e) {
    hideTyping();
    addMessage('assistant', `⚠️ Coach unavailable: ${e.message}`);
  } finally {
    document.getElementById('btn-coach-send').disabled = false;
  }
}

// ---- TOAST ----
let toastTimer = null;
function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---- UTILS ----
function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function getVal(id) { const el=document.getElementById(id); return el?el.value:''; }
function setVal(id, val) { const el=document.getElementById(id); if(el) el.value=val??''; }
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

// ---- SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e)));
}
