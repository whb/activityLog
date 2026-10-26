import React, { useState, useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

// ---- jsdom globals (must exist before leaflet is loaded) ----
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator; global.self = w;
global.HTMLElement = w.HTMLElement; global.Element = w.Element; global.Node = w.Node;
global.Image = w.Image; global.getComputedStyle = w.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const prop of ['clientWidth', 'clientHeight']) {
  Object.defineProperty(w.HTMLElement.prototype, prop, { get: () => 800, configurable: true });
}
const errors = [];
const _err = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); _err(...a); };
const _warn = console.warn;
console.warn = (...a) => { const s = a.map(String).join(' '); if (!s.includes('act')) errors.push('warn: ' + s); };

(async () => {
  // import AFTER globals are set, so leaflet sees window
  const { default: InteractiveMap } = await import('../client/components/InteractiveMap.jsx');

  const PT = [[-33.64, 115.37], [-33.63, 115.39], [-33.62, 115.41], [-33.61, 115.43], [-33.60, 115.45], [-33.59, 115.47]];
  let clicks = 0;
  function App() {
    const [idx, setIdx] = useState(0);
    const [focus, setFocus] = useState(null);
    const [seg, setSeg] = useState(null);
    const [dots, setDots] = useState(true);
    const [fit, setFit] = useState(0);
    useEffect(() => {
      const ts = [
        setTimeout(() => setIdx(2), 50),
        setTimeout(() => { setIdx(4); setDots(false); }, 100),
        setTimeout(() => setFocus([PT[0], PT[1], PT[2]]), 150),
        setTimeout(() => setSeg([PT[2], PT[3], PT[4]]), 200),
        setTimeout(() => setFit(1), 250),
      ];
      return () => ts.forEach(clearTimeout);
    }, []);
    return <InteractiveMap points={PT} marker={{ lat: PT[idx][0], lon: PT[idx][1] }} focus={focus} segment={seg} showDots={dots} fitToken={fit} onMapClick={() => { clicks++; }} height={300} />;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<App />); });
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 20)); }
  await act(async () => { root.unmount(); });

  const realErrs = errors.filter((e) => !/ResizeObserver|not wrapped in act/i.test(e));
  if (realErrs.length) {
    console.log('REAL-MAP ERRORS:'); realErrs.forEach((e) => console.log('  -', e.slice(0, 200)));
    process.exit(1);
  }
  console.log('REAL-MAP OK: InteractiveMap rendered + marker/focus/segment/dots/fitToken driven without runtime errors. mapClicks=' + clicks);
  process.exit(0);
})().catch((e) => { console.error('REAL-MAP CRASH:', e && e.stack || e); process.exit(1); });
