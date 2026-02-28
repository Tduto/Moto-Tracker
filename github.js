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

  // Raw fetch — returns { ok, status, data }
  async function ghFetch(method, path, body = null) {
    if (isDemoMode()) throw new Error('Demo mode');
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
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // Read a file — returns { content, sha } or { content: null, sha: null } if not found
  async function readFile(filePath) {
    const { ok, status, data } = await ghFetch('GET', filePath);
    if (status === 404 || status === 403) {
      return { content: null, sha: null };
    }
    if (!ok) {
      throw new Error(data.message || `GitHub read error ${status}`);
    }
    try {
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      return { content: JSON.parse(decoded), sha: data.sha };
    } catch (e) {
      return { content: null, sha: null };
    }
  }

  // Write a file — creates or updates
  async function writeFile(filePath, content, sha = null) {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
    const body = {
      message: `MotoTracker: update ${filePath.split('/').pop()} [${new Date().toISOString().slice(0, 10)}]`,
      content: encoded,
    };
    if (sha) body.sha = sha;

    const { ok, status, data } = await ghFetch('PUT', filePath, body);
    if (!ok) {
      throw new Error(data.message || `GitHub write error ${status}`);
    }
    return data;
  }

  // Save data — reads SHA first (needed for updates), then writes
  async function saveData(type, data) {
    if (isDemoMode()) {
      localStorage.setItem(`moto_demo_${type}`, JSON.stringify(data));
      return;
    }
    const filePath = FILES[type];
    const { sha } = await readFile(filePath); // sha is null for new files — that's fine
    await writeFile(filePath, data, sha);
  }

  // Load data — returns null if file doesn't exist yet
  async function loadData(type) {
    if (isDemoMode()) {
      const stored = localStorage.getItem(`moto_demo_${type}`);
      return stored ? JSON.parse(stored) : null;
    }
    const filePath = FILES[type];
    const { content } = await readFile(filePath);
    return content;
  }

  // Test connection to the repo
  async function testConnection() {
    const url = `https://api.github.com/repos/${config.username}/${config.repo}`;
    const res = await fetch(url, {
      headers: { Authorization: `token ${config.token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Cannot access repo (${res.status}). Check your token has 'repo' scope.`);
    }
    return true;
  }

  return { setConfig, loadConfig, isConfigured, isDemoMode, saveData, loadData, testConnection };
})();
