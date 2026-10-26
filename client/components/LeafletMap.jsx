import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function LeafletMap({ points, height = 440 }) {
  const ref = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!ref.current || !points || !points.length) return;
    const c0 = points[0];
    const m = L.map(ref.current, { zoomControl: true, attributionControl: true });
    m.setView([c0[0], c0[1]], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m);
    map.current = m;

    const coords = points.filter((p) => p && p[0] && p[1]);
    if (coords.length > 1) {
      L.polyline(coords, { color: '#2196f3', weight: 4, opacity: 0.85 }).addTo(m);
      L.circleMarker(coords[0], { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 }).addTo(m).bindTooltip('起点');
      L.circleMarker(coords[coords.length - 1], { radius: 7, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }).addTo(m).bindTooltip('终点');
      m.fitBounds(coords, { padding: [45, 45] });
    } else if (coords.length === 1) {
      L.circleMarker(coords[0], { radius: 8, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 1 }).addTo(m);
    }
    return () => { m.remove(); map.current = null; };
  }, [points]);

  if (!points || !points.length) {
    return <div className="map" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7688' }}>无轨迹坐标数据</div>;
  }
  return <div ref={ref} className="map" style={{ height }} />;
}
