const base = '/api';

async function j(r) {
  r = await r;
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).error || m; } catch { /* ignore */ }
    throw new Error(m);
  }
  return r.json();
}

function qs(params = {}) {
  const p = Object.entries(params).filter(([, v]) => v && v !== 'all');
  if (!p.length) return '';
  return '?' + new URLSearchParams(p).toString();
}

export const api = {
  activities: (params) => j(fetch(base + '/activities' + qs(params))),
  sports: () => j(fetch(base + '/activities/sports')),
  activity: (id) => j(fetch(base + '/activities/' + id)),
  remove: (id) => j(fetch(base + '/activities/' + id, { method: 'DELETE' })),
  reports: () => j(fetch(base + '/reports/summary')),
  equipment: () => j(fetch(base + '/equipment')),
  async importFit(file) {
    const fd = new FormData();
    fd.append('file', file);
    return j(await fetch(base + '/import', { method: 'POST', body: fd }));
  },
};
