// =========================================
// GitHub Backend Module
// =========================================

const GitHub = (() => {
  let config = { username: '', repo: '', token: '' };
  const FILES = {
    profile: 'data/profile.json',
    sessions: 'data/sessions.json',
    suspension: 'data/suspension.json',
  };

  function setConfig(username, repo, token) {
    config = { username, repo, token };
    localStorage.setItem('moto_gh_config', JSON.stringify(config));
  }

  function loadConfig() {
    const stored = localStorage.getItem('moto_gh_config');
    if (stored) { config = JSON.parse(stored); return true; }
    return false;
  }

  function isConfigured() {
    return !!(config.username && config.repo && config.token);
  }

  function isDemoMode() {
    return config.token === '__DEMO__';
  }

  async function apiRequest(method, path, body = null) {
    if (isDemoMode()) throw new Error('Demo mode: GitHub sync disabled');
    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${path}`;
    const opts = {
      method,
      headers: {
        Authorization: `token ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error ${res.status}`);
    }
    return res.json();
  }

  async function readFile(filePath) {
    try {
      const data = await apiRequest('GET', filePath);
      const content = atob(data.content.replace(/\n/g, ''));
      return { data: JSON.parse(content), sha: data.sha };
    } catch (e) {
      if (e.message && e.message.includes('404')) return { data: null, sha: null };
      throw e;
    }
  }

  async function writeFile(filePath, content, sha = null) {
    const body = {
      message: `MotoTracker: update ${filePath.split('/').pop()} [${new Date().toISOString().slice(0,10)}]`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
    };
    if (sha) body.sha = sha;
    return apiRequest('PUT', filePath, body);
  }

  // Initialize repo with placeholder files if needed
  async function initRepo() {
    if (isDemoMode()) return;
    const readme = await apiRequest('GET', 'README.md').catch(() => null);
    if (!readme) {
      // Repo might be empty or files don't exist — that's fine, writeFile handles creation
    }
  }

  // High-level helpers
  async function saveData(type, data) {
    if (isDemoMode()) {
      localStorage.setItem(`moto_demo_${type}`, JSON.stringify(data));
      return;
    }
    const filePath = FILES[type];
    const existing = await readFile(filePath);
    await writeFile(filePath, data, existing.sha);
  }

  async function loadData(type) {
    if (isDemoMode()) {
      const stored = localStorage.getItem(`moto_demo_${type}`);
      return stored ? JSON.parse(stored) : null;
    }
    const filePath = FILES[type];
    const { data } = await readFile(filePath);
    return data;
  }

  async function testConnection() {
    const url = `https://api.github.com/repos/${config.username}/${config.repo}`;
    const res = await fetch(url, {
      headers: { Authorization: `token ${config.token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Cannot access repo (${res.status})`);
    }
    return true;
  }

  return { setConfig, loadConfig, isConfigured, isDemoMode, saveData, loadData, testConnection, initRepo };
})();
