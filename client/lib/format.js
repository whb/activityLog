export const SPORTS = {
  running: { label: '跑步', color: '#ff5722', icon: '🏃' },
  trail: { label: '越野跑', color: '#ff7043', icon: '⛰️' },
  cycling: { label: '骑行', color: '#2196f3', icon: '🚴' },
  biking: { label: '骑行', color: '#2196f3', icon: '🚴' },
  triathlon: { label: '铁人三项', color: '#7c4dff', icon: '🏆' },
  swimming: { label: '游泳', color: '#00bcd4', icon: '🏊' },
  swim: { label: '游泳', color: '#00bcd4', icon: '🏊' },
  walking: { label: '步行', color: '#4caf50', icon: '🚶' },
  hiking: { label: '徒步', color: '#8bc34a', icon: '🥾' },
  strength: { label: '力量', color: '#9c27b0', icon: '🏋️' },
  yoga: { label: '瑜伽', color: '#e91e63', icon: '🧘' },
  fitness: { label: '健身', color: '#795548', icon: '💪' },
  unknown: { label: '未知', color: '#9e9e9e', icon: '⚪' },
};

export function sportMeta(sport) {
  return SPORTS[sport] || { label: sport || '未知', color: '#9e9e9e', icon: '⚪' };
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDuration(s) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h}小时${m}分`;
  if (m) return `${m}分${sec}秒`;
  return `${sec}秒`;
}

export function tLabel(sec) {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function num(v, digits = 1, unit = '') {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: digits }) + unit;
}
