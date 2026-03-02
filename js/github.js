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
    if (stored) {
      try {
        config = JSON.parse(stored);
        return !!(config.username && config.repo && config.token);
      } catch(e) { return false; }
    }
    return false;
  }

  function isConfigured() {
    return !!(config.username && config.repo && config.token);
  }

  function isDemoMode() {
    return config.token === '__DEMO__';
  }

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

  async function readFile(filePath) {
    try {
      const { ok, status, data } = await ghFetch('GET', filePath);
      // 404 means file doesn't exist yet — that's fine, return null
      if (status === 404) return { content: null, sha: null };
      if (!ok) throw new Error(data.message || `Read error ${status}`);
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      return { content: JSON.parse(decoded), sha: data.sha };
    } catch(e) {
      if (e.message && (e.message.includes('404') || e.message.includes('Not Found'))) {
        return { content: null, sha: null };
      }
      throw e;
    }
  }

  async function writeFile(filePath, content, sha = null) {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
    const body = {
      message: `MotoTracker: update ${filePath.split('/').pop()} [${new Date().toISOString().slice(0, 10)}]`,
      content: encoded,
    };
    if (sha) body.sha = sha;
    const { ok, status, data } = await ghFetch('PUT', filePath, body);
    if (!ok) throw new Error(data.message || `Write error ${status}`);
    return data;
  }

  async function saveData(type, data) {
    if (isDemoMode()) {
      localStorage.setItem(`moto_demo_${type}`, JSON.stringify(data));
      return;
    }
    const filePath = FILES[type];
    const { sha } = await readFile(filePath);
    await writeFile(filePath, data, sha);
  }

  async function loadData(type) {
    if (isDemoMode()) {
      const stored = localStorage.getItem(`moto_demo_${type}`);
      return stored ? JSON.parse(stored) : null;
    }
    const filePath = FILES[type];
    const { content } = await readFile(filePath);
    return content;
  }

  async function testConnection() {
    const url = `https://api.github.com/repos/${config.username}/${config.repo}`;
    const res = await fetch(url, {
      headers: { Authorization: `token ${config.token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Cannot access repo (${res.status})`);
    }
    return true;
  }

  return { setConfig, loadConfig, isConfigured, isDemoMode, saveData, loadData, testConnection };
})();
