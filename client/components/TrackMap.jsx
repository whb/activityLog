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

// ---- 坐标换算：WGS-84(GPS 原始) -> GCJ-02(高德) ----
// 高德瓦片与 JS API 均使用 GCJ-02，直接绘制 WGS-84 会整体偏移数百米。
const PI = Math.PI;
const SEMI_MAJOR = 6378245.0;
const EE = 0.00669342162296594323;
function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}
function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}
function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((SEMI_MAJOR * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((SEMI_MAJOR / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}
// coords: [lat, lon] (WGS-84) -> [lat, lon] (GCJ-02)
function toGcj02(coords) {
  return coords.map(([lat, lon]) => {
    const [glng, glat] = wgs84ToGcj02(lon, lat);
    return [glat, glng];
  });
}

const dot = (color) => `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;

function initAMap(el, AMap, coords, wgs) {
  // coords: GCJ-02（高德绘制用）；wgs: WGS-84（失败回退到 ArcGIS 时用，避免国内轨迹偏移）
  const path = coords.map(([lat, lon]) => [lon, lat]); // 高德使用 [lng, lat]
  const map = new AMap.Map(el, { viewMode: '2D', zoom: 13, center: path[0] });
  const polyline = new AMap.Polyline({ path, strokeColor: '#2196f3', strokeWeight: 5, lineJoin: 'round', lineCap: 'round' });
  map.add(polyline);
  const startM = new AMap.Marker({ position: path[0], content: dot('#16a34a'), offset: new AMap.Pixel(-8, -8), title: '起点' });
  const endM = new AMap.Marker({ position: path[path.length - 1], content: dot('#ef4444'), offset: new AMap.Pixel(-8, -8), title: '终点' });
  map.add(startM);
  map.add(endM);
  map.setFitView([polyline, startM, endM]);

  // 高德 JS API 的 key 失效/域名白名单不符/安全密钥错误时，脚本仍能下载(200)，
  // 但地图会灰屏、不 onerror。此处监听 maperror 并回退到 Leaflet，保证总能显示地图。
  let leafletCleanup = null;
  let disposed = false;
  const fallback = () => {
    if (disposed || leafletCleanup) return;
    try { map.destroy(); } catch { /* ignore */ }
    if (el) el.innerHTML = '';
    leafletCleanup = initLeaflet(el, wgs);
  };
  try { map.on('maperror', fallback); } catch { /* ignore */ }
  const prevOnError = window.onMapError;
  window.onMapError = (e) => { fallback(); if (typeof prevOnError === 'function') prevOnError(e); };

  return () => {
    disposed = true;
    if (window.onMapError) window.onMapError = prevOnError;
    if (leafletCleanup) leafletCleanup();
    else { try { map.destroy(); } catch { /* ignore */ } }
  };
}

// 回退方案：Leaflet + ArcGIS 世界街道图瓦片。
// 选它的原因：无需 key、国内可访问、全球有覆盖（高德栅格瓦片对境外/澳洲是空白瓦片）。
// coords 需为 WGS-84（原始 GPS，未偏移）。
function initLeaflet(el, coords) {
  const m = L.map(el);
  m.setView([coords[0][0], coords[0][1]], 13);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; ArcGIS / OpenStreetMap contributors',
  }).addTo(m);
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
    const wgs = points.filter((p) => p && p[0] != null && p[1] != null);
    if (!wgs.length) return;
    const gcj = toGcj02(wgs); // WGS-84 -> GCJ-02，仅高德 JS API 使用
    // 高德对境外(如澳洲)无底图数据且不发 maperror → 境外轨迹直接走全球瓦片，不碰 AMap
    const inChina = wgs.filter((p) => !outOfChina(p[1], p[0])).length;
    const isDomestic = inChina / wgs.length > 0.5;
    let cancelled = false;

    api.config()
      .then((cfg) => {
        if (cancelled) return;
        if (isDomestic && cfg && cfg.amapKey) {
          loadAMap(cfg.amapKey, cfg.amapSecurityCode)
            .then((AMap) => { if (!cancelled) cleanup.current = initAMap(ref.current, AMap, gcj, wgs); })
            .catch(() => { if (!cancelled) cleanup.current = initLeaflet(ref.current, wgs); });
        } else {
          cleanup.current = initLeaflet(ref.current, wgs);
        }
      })
      .catch(() => { if (!cancelled) cleanup.current = initLeaflet(ref.current, wgs); });

    return () => { cancelled = true; if (cleanup.current) cleanup.current(); cleanup.current = null; };
  }, [points]);

  if (!points || !points.length) {
    return <div className="map" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7688' }}>无轨迹坐标数据</div>;
  }
  return <div ref={ref} className="map" style={{ height }} />;
}
