import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Dashboard from '../client/pages/Dashboard.jsx';
import Activities from '../client/pages/Activities.jsx';
import ActivityDetail from '../client/pages/ActivityDetail.jsx';
import Equipment from '../client/pages/Equipment.jsx';
import Import from '../client/pages/Import.jsx';

// ---- jsdom globals ----
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const _origErr = console.error;
console.error = (...a) => { if (String(a[0]).includes('wrapped in act')) return; _origErr(...a); };

// ---- demo data ----
function recs(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({
    t: i * 60, lat: 39.9 + i * 0.001, lon: 116.4 + i * 0.001, altitude: 50 + i * 2,
    speed: 10 + i, distance_m: i * 100, hr: 140 + i, cadence: 170, power: 200, temperature: 15,
  });
  return out;
}
const RE = {
  grand: { count: 3, distance_km: 30.6, hours: 6.2, first: '2026-03-08T07:00:00Z', last: '2026-04-12T17:20:00Z' },
  totals: [
    { sport: 'running', count: 2, distance_km: 28.6, hours: 2.5 },
    { sport: 'cycling', count: 1, distance_km: 62.5, hours: 3.7 },
  ],
  monthly: [
    { month: '2026-03', sport: 'running', distance_km: 10.2, hours: 0.9, count: 1 },
    { month: '2026-03', sport: 'cycling', distance_km: 62.5, hours: 2.2, count: 1 },
    { month: '2026-04', sport: 'running', distance_km: 18.4, hours: 1.6, count: 1 },
  ],
};
const LIST = [
  { id: 1, name: 'Morning Trail Run', sport: 'running', start_time: '2026-03-08T07:00:00Z', distance_km: 10.2, duration_s: 3120, avg_speed: 11.8, avg_hr: 150, elevation_gain: 86 },
  { id: 2, name: 'Weekend Ride', sport: 'cycling', start_time: '2026-03-15T06:30:00Z', distance_km: 62.5, duration_s: 7920, avg_speed: 28.4, avg_hr: 139, elevation_gain: 486 },
];
const DETAIL = { activity: LIST[0], records: recs(12) };
const EQUIP = [{ id: 1, serial_number: 'FR265-8842', product_name: 'Forerunner 265', manufacturer: 'Garmin', usage_hours: 3.02, first_seen: '2026-03-08', last_seen: '2026-04-05', activity_count: 2 }];

const fetchCalls = [];
global.fetch = async (url) => {
  const u = String(url);
  fetchCalls.push(u);
  let body;
  if (u.includes('/reports/summary')) body = RE;
  else if (u.includes('/activities/sports')) body = ['running', 'cycling'];
  else if (/\/activities\/\d+/.test(u)) body = DETAIL;
  else if (u.includes('/activities')) body = LIST;
  else if (u.includes('/equipment')) body = EQUIP;
  else body = {};
  return { ok: true, status: 200, headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null) }, json: async () => body };
};

const CASES = [
  ['/', <Dashboard />, '各运动类型累计'],
  ['/activities', <Activities />, 'Morning Trail Run'],
  ['/activities/1', <ActivityDetail />, '总里程'],
  ['/equipment', <Equipment />, 'Forerunner 265'],
  ['/import', <Import />, '拖到这里'],
];

async function main() {
  const r0 = await fetch('/api/reports/summary');
  const b0 = await r0.json();
  console.log('DBG chain ok:', !!b0 && b0.grand && b0.grand.count);
  for (const [path, el, expect] of CASES) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/activities/:id" element={<ActivityDetail />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/import" element={<Import />} />
          </Routes>
        </MemoryRouter>
      );
    });
    let text = '';
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 10));
      text = container.textContent || '';
      if (text.includes(expect)) break;
    }
    if (!text.includes(expect)) {
      throw new Error(`FAIL ${path}: expected "${expect}". fetchCalls=[${fetchCalls.join(', ')}]. Got: ${text.slice(0, 200)}`);
    }
    console.log('OK', path, '->', JSON.stringify(expect));
    root.unmount();
    container.remove();
  }
  // Static / no-backend mode: /api returns HTML -> app should fall back to demo data
  global.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new Error('not json'); } });
  {
    const c = document.createElement('div'); document.body.appendChild(c);
    const root = createRoot(c);
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Dashboard />} /></Routes></MemoryRouter>);
    });
    let t = '';
    for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 10)); t = c.textContent || ''; if (t.includes('各运动类型累计')) break; }
    if (!t.includes('各运动类型累计')) throw new Error('FAIL static no-backend fallback');
    console.log('OK static(no-backend) -> demo data fallback');
    root.unmount(); c.remove();
  }

  console.log('ALL 5 PAGES RENDER OK (no runtime errors)');
  process.exit(0);
}

main().catch((e) => { console.error('SMOKE FAIL:', e && e.stack || e); process.exit(1); });
