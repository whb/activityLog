import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { api } from '../api.js';

// 动态加载高德 JS API v2（带 Promise 缓存）。key 来自后端 /api/config（读自 .env）。
let amapPromise = null;
function loadAMap(key, securityCode) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (!amapPromise) {
    amapPromise = new Promise((resolve, reject) => {
      if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
      const s = document.createElement('script');
      s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload = () => (window.AMap ? resolve(window.AMap) : reject(new Error('AMap loaded but window.AMap missing')));
      s.onerror = () => reject(new Error('Failed to load AMap script'));
      document.head.appendChild(s);
    });
    amapPromise.catch(() => { amapPromise = null; }); // 允许失败后重试
  }
  return amapPromise;
}

const dot = (color) => `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;

function initAMap(el, AMap, coords) {
  const path = coords.map(([lat, lon]) => [lon, lat]); // 高德使用 [lng, lat]
  const map = new AMap.Map(el, { viewMode: '2D', zoom: 13, center: path[0] });
  const polyline = new AMap.Polyline({ path, strokeColor: '#2196f3', strokeWeight: 5, lineJoin: 'round', lineCap: 'round' });
  map.add(polyline);
  const startM = new AMap.Marker({ position: path[0], content: dot('#16a34a'), offset: new AMap.Pixel(-8, -8), title: '起点' });
  const endM = new AMap.Marker({ position: path[path.length - 1], content: dot('#ef4444'), offset: new AMap.Pixel(-8, -8), title: '终点' });
  map.add(startM);
  map.add(endM);
  map.setFitView([polyline, startM, endM]);
  return () => { try { map.destroy(); } catch { /* ignore */ } };
}

// 无高德 key 时的回退方案：Leaflet + OpenStreetMap
function initLeaflet(el, coords) {
  const m = L.map(el);
  m.setView([coords[0][0], coords[0][1]], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
  if (coords.length > 1) {
    L.polyline(coords, { color: '#2196f3', weight: 4, opacity: 0.85 }).addTo(m);
    L.circleMarker(coords[0], { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 }).addTo(m).bindTooltip('起点');
    L.circleMarker(coords[coords.length - 1], { radius: 7, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }).addTo(m).bindTooltip('终点');
    m.fitBounds(coords, { padding: [45, 45] });
  } else {
    L.circleMarker(coords[0], { radius: 8, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 1 }).addTo(m);
  }
  return () => { try { m.remove(); } catch { /* ignore */ } };
}

export default function TrackMap({ points, height = 440 }) {
  const ref = useRef(null);
  const cleanup = useRef(null);

  useEffect(() => {
    if (!ref.current || !points || !points.length) return;
    const coords = points.filter((p) => p && p[0] != null && p[1] != null);
    if (!coords.length) return;
    let cancelled = false;

    api.config()
      .then((cfg) => {
        if (cancelled) return;
        if (cfg && cfg.amapKey) {
          loadAMap(cfg.amapKey, cfg.amapSecurityCode)
            .then((AMap) => { if (!cancelled) cleanup.current = initAMap(ref.current, AMap, coords); })
            .catch(() => { if (!cancelled) cleanup.current = initLeaflet(ref.current, coords); });
        } else {
          cleanup.current = initLeaflet(ref.current, coords);
        }
      })
      .catch(() => { if (!cancelled) cleanup.current = initLeaflet(ref.current, coords); });

    return () => { cancelled = true; if (cleanup.current) cleanup.current(); cleanup.current = null; };
  }, [points]);

  if (!points || !points.length) {
    return <div className="map" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7688' }}>无轨迹坐标数据</div>;
  }
  return <div ref={ref} className="map" style={{ height }} />;
}
