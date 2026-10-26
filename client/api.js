const base = '/api';
import * as demo from './lib/demoData.js';

const NO_BACKEND = Symbol('no-backend');

// Parse a response. Throws NO_BACKEND when the response is not JSON (i.e. no real
// backend — e.g. a static preview server returning index.html for /api/*).
async function parse(res) {
  res = await res; // fetch() 返回 Promise；解包后再读 headers/ok
  const ct = (res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
  if (!ct.includes('application/json')) throw NO_BACKEND;
  if (!res.ok) {
    let m = res.statusText;
    try { m = (await res.json()).error || m; } catch { /* ignore */ }
    throw new Error(m);
  }
  return res.json();
}

function isNoBackend(e) {
  if (e === NO_BACKEND) return true;
  if (e && e.name === 'TypeError') return true; // fetch network failure
  return false;
}

function withDemo(real, fallback) {
  return real().catch((e) => {
    if (isNoBackend(e)) return fallback();
    throw e;
  });
}

function qs(params = {}) {
  const p = Object.entries(params).filter(([, v]) => v && v !== 'all');
  if (!p.length) return '';
  return '?' + new URLSearchParams(p).toString();
}

export const api = {
  config: () => withDemo(() => parse(fetch(base + '/config')), () => ({})),
  activities: (p) => withDemo(() => parse(fetch(base + '/activities' + qs(p))), () => demo.filteredActivities(p)),
  sports: () => withDemo(() => parse(fetch(base + '/activities/sports')), () => demo.sports),
  activity: (id) => withDemo(() => parse(fetch(base + '/activities/' + id)), () => demo.detail(id)),
  remove: (id) => withDemo(() => parse(fetch(base + '/activities/' + id, { method: 'DELETE' })), () => demo.removeActivity(id)),
  reports: () => withDemo(() => parse(fetch(base + '/reports/summary')), () => demo.reports),
  equipment: () => withDemo(() => parse(fetch(base + '/equipment')), () => demo.equipment),
  async importFit(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(base + '/import', { method: 'POST', body: fd });
    const ct = (res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
    if (!ct.includes('application/json')) {
      throw new Error('当前为离线/静态模式，无法导入。请启动后端（npm start）后再试。');
    }
    return parse(res);
  },
};
