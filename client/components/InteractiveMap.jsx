import { useEffect, useRef } from 'react';
import L from 'leaflet';

// A "controlled" Leaflet map for the linked Charts view.
// The map + base layers are created ONCE per `points`; subsequent prop changes
// (marker / focus / segment / showDots / fitToken) only tweak the relevant layer,
// so moving the current-position marker on every hover is cheap.
//
// props:
//   points     [[lat, lon], ...] full route (WGS-84)
//   marker     { lat, lon } | null   -> movable current-position indicator
//   focus      [[lat,lon],...] | null -> when set, fitBounds to it (e.g. selected lap)
//   segment    [[lat,lon],...] | null -> highlighted sub-route (e.g. only selected lap)
//   showDots   bool -> draw sampled track-location dots
//   fitToken   number -> bump to reset the view to the full route
//   onMapClick ({ lat, lon }) => void
const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

function drawBase(layer, pts, faint) {
  layer.clearLayers();
  if (pts.length > 1) {
    L.polyline(pts, { color: faint ? '#8ea3c9' : '#2196f3', weight: faint ? 4 : 5, opacity: faint ? 0.75 : 0.9 }).addTo(layer);
  }
  if (faint) {
    const step = Math.max(1, Math.floor(pts.length / 80));
    for (let i = 0; i < pts.length; i += step) {
      L.circleMarker(pts[i], { radius: 3.5, color: '#fff', weight: 1, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(layer);
    }
  }
  L.circleMarker(pts[0], { radius: 8, color: '#fff', weight: 2, fillColor: '#16a34a', fillOpacity: 1 }).addTo(layer).bindTooltip('起点');
  L.circleMarker(pts[pts.length - 1], { radius: 8, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(layer).bindTooltip('终点');
}

export default function InteractiveMap({ points, marker, focus, segment, showDots = true, fitToken = 0, onMapClick, height = 460 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const baseRef = useRef(null);
  const segRef = useRef(null);
  const markerRef = useRef(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // 1) create the map + base layers (once per `points`)
  useEffect(() => {
    if (!elRef.current || !points || !points.length) return undefined;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true });
    map.setView([points[0][0], points[0][1]], 13);
    L.tileLayer(TILE, { maxZoom: 19, attribution: '&copy; ArcGIS / OSM contributors' }).addTo(map);

    const base = L.layerGroup().addTo(map);
    drawBase(base, points, true);
    baseRef.current = base;
    mapRef.current = map;

    const mk = L.circleMarker([points[0][0], points[0][1]], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#e11d48', fillOpacity: 1, opacity: 1, zIndexOffset: 1000,
    }).addTo(map);
    mk.bindTooltip('当前位置');
    markerRef.current = mk;

    const onClick = (e) => { if (clickRef.current) clickRef.current({ lat: e.latlng.lat, lon: e.latlng.lng }); };
    map.on('click', onClick);
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
    const t = setTimeout(() => map.invalidateSize(), 80);
    // Leaflet does not auto-resize with its container: revalidate the map size
    // whenever the container changes (window resize / layout shift), otherwise
    // shrinking the browser leaves the map stuck at the old (larger) size.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.off('click', onClick);
      map.remove();
      mapRef.current = null; baseRef.current = null; segRef.current = null; markerRef.current = null;
    };
  }, [points]);

  // 2) sampled dots toggle / base emphasis
  useEffect(() => {
    const base = baseRef.current;
    if (!base || !pointsRef.current) return;
    drawBase(base, pointsRef.current, showDots);
  }, [showDots]);

  // 3) highlighted sub-route (only-selected-lap)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (segRef.current) { map.removeLayer(segRef.current); segRef.current = null; }
    if (segment && segment.length > 1) {
      segRef.current = L.polyline(segment, { color: '#f59e0b', weight: 6, opacity: 0.95 }).addTo(map);
    }
  }, [segment]);

  // 4) movable current-position marker
  useEffect(() => {
    const mk = markerRef.current;
    if (!mk || !mapRef.current) return;
    if (marker && marker.lat != null && marker.lon != null) mk.setLatLng([marker.lat, marker.lon]);
  }, [marker]);

  // 5) fit-to-window / reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitToken) return;
    const pts = pointsRef.current;
    if (pts && pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    else if (pts && pts.length === 1) map.setView(pts[0], 14);
  }, [fitToken]);

  // 6) focus bounds (zoom to selected lap)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (focus.length > 1) map.fitBounds(focus, { padding: [40, 40] });
    else if (focus.length === 1) map.setView(focus[0], 15);
  }, [focus]);

  return <div ref={elRef} className="map" style={{ height }} />;
}
