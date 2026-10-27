import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Chart from './Chart.jsx';
import InteractiveMap from './InteractiveMap.jsx';
import { tLabel, num } from '../lib/format.js';

const LAP_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const CUR_COLOR = '#e11d48';
// Fallback for the switchable profile chart (used when no metric is passed / no data).
const DEFAULT_METRIC = { key: 'alt', name: '海拔', icon: '⛰️', unit: 'm', color: '#16a34a', getVal: (r) => r.altitude };

// Small inline SVG speed sparkline (no extra chart instance) for the map info panel.
function SpeedSpark({ records, idx }) {
  const W = 150, H = 34, span = 45;
  const s = Math.max(0, idx - span), e = Math.min(records.length, idx + span + 1);
  const seg = [];
  for (let i = s; i < e; i++) { const v = records[i] && records[i].speed; if (v != null && isFinite(v)) seg.push(v); }
  if (seg.length < 2) return null;
  const max = Math.max(...seg, 1), min = Math.min(...seg, 0), rng = (max - min) || 1;
  const step = W / (seg.length - 1);
  const pts = seg.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / rng) * H).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} className="spark" aria-hidden>
      <polyline points={pts} fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
    </svg>
  );
}

export default function LinkedCharts({ activity, records, laps, metric = DEFAULT_METRIC }) {
  const N = records.length;
  const [selIdx, setSelIdx] = useState(0);
  const [selLap, setSelLap] = useState(null);
  const [showDots, setShowDots] = useState(true);
  const [zoomToLap, setZoomToLap] = useState(false);
  const [onlyLap, setOnlyLap] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const elevRef = useRef(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // time -> index lookup (records are ordered by t ASC) — used to map the profile
  // chart's time x-value back to a record, which drives the map marker.
  const timeIndex = useMemo(() => {
    const arr = [];
    for (let i = 0; i < records.length; i++) {
      const t = records[i].t;
      if (t != null && isFinite(t)) arr.push([t, i]);
    }
    return arr;
  }, [records]);

  const idxAtTime = useCallback((t) => {
    const arr = timeIndex;
    if (!arr.length || t == null || !isFinite(t)) return 0;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid][0] < t) lo = mid + 1; else hi = mid; }
    if (lo > 0) { const a = arr[lo - 1][0], b = arr[lo][0]; return Math.abs(a - t) <= Math.abs(b - t) ? arr[lo - 1][1] : arr[lo][1]; }
    return arr[lo][1];
  }, [timeIndex]);

  const points = useMemo(() => records.filter((r) => r.lat != null && r.lon != null).map((r) => [r.lat, r.lon]), [records]);
  const hasGps = points.length > 0;

  // Profile series: [time, <selected metric value>] — SAME x/y axes as the selectable
  // metric cards below. The metric is swappable via the `metric` prop.
  const series = useMemo(() => {
    const out = [];
    for (const r of records) {
      const v = metric.getVal(r);
      if (v != null && isFinite(v)) out.push([r.t != null ? r.t : out.length, +v]);
    }
    return out;
  }, [records, metric]);
  const hasSeries = series.length > 0;

  const cur = records[selIdx] || null;

  // Selected-lap helpers (by time window on records)
  const lapRange = useCallback((l) => {
    if (!l) return null;
    const t0 = l.start_t || 0, t1 = (l.start_t || 0) + (l.duration_s || 0);
    return { t0, t1 };
  }, []);

  const focus = useMemo(() => {
    if (!zoomToLap || selLap == null || !laps) return null;
    const rg = lapRange(laps[selLap]); if (!rg) return null;
    const pts = records.filter((r) => r.lat != null && r.lon != null && r.t != null && r.t >= rg.t0 && r.t <= rg.t1).map((r) => [r.lat, r.lon]);
    return pts.length ? pts : null;
  }, [zoomToLap, selLap, laps, records, lapRange]);

  const segment = useMemo(() => {
    if (!onlyLap || selLap == null || !laps) return null;
    const rg = lapRange(laps[selLap]); if (!rg) return null;
    const pts = records.filter((r) => r.lat != null && r.lon != null && r.t != null && r.t >= rg.t0 && r.t <= rg.t1).map((r) => [r.lat, r.lon]);
    return pts.length ? pts : null;
  }, [onlyLap, selLap, laps, records, lapRange]);

  const marker = (cur && cur.lat != null && cur.lon != null) ? { lat: cur.lat, lon: cur.lon } : null;

  // Lap bands drawn on the (time) x-axis, highlighting the selected lap.
  const lapBands = useMemo(() => {
    if (!laps || !laps.length) return [];
    return laps.map((l, i) => {
      const c = LAP_COLORS[i % LAP_COLORS.length];
      const on = i === selLap;
      const col = on ? c + '66' : c + '1f';
      const t0 = l.start_t || 0;
      const t1 = t0 + (l.duration_s || 0);
      return [
        { xAxis: t0, itemStyle: { color: col } },
        { xAxis: t1, itemStyle: { color: col } },
      ];
    });
  }, [laps, selLap]);

  // Profile option — STABLE across selIdx (only recomputed on data / metric / selected-lap change).
  // Axes match the selectable metric cards: x = time, y = the metric (auto-scaled).
  const profileOption = useMemo(() => {
    if (!hasSeries) return null;
    return {
      grid: { left: 48, right: 20, top: 26, bottom: 42 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps) => { const p = ps[0]; return `${tLabel(p.value[0])}<br/>${metric.name} ${p.value[1] == null ? '—' : p.value[1]} ${metric.unit}`; },
      },
      xAxis: {
        type: 'value', min: 'dataMin', max: 'dataMax',
        splitLine: { show: false }, axisLine: { lineStyle: { color: '#e6eaf2' } },
        axisLabel: { formatter: (v) => tLabel(v), color: '#6b7688' },
      },
      yAxis: {
        type: 'value', name: metric.unit, scale: true,
        nameTextStyle: { color: '#6b7688', align: 'left' }, splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' },
      },
      series: [{
        type: 'line', data: series, showSymbol: false, smooth: false, sampling: 'lttb',
        lineStyle: { width: 2.5, color: metric.color }, itemStyle: { color: metric.color },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: metric.color + '33' }, { offset: 1, color: metric.color + '05' }] } },
        markArea: lapBands.length ? { silent: true, data: lapBands } : undefined,
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: CUR_COLOR, width: 2 }, data: [] },
      }],
    };
  }, [hasSeries, series, lapBands, metric]);

  // Move the current-position line WITHOUT resetting the whole option (keeps the
  // hover axis-pointer smooth). Re-applies after any base-option rebuild too.
  useEffect(() => {
    const c = elevRef.current;
    if (!c || c.isDisposed || c.isDisposed()) return;
    if (!hasSeries || !cur || cur.t == null) return;
    c.setOption({
      series: [{
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: CUR_COLOR, width: 2 },
          data: [{ xAxis: cur.t }],
        },
      }],
    });
  }, [selIdx, profileOption, hasSeries, cur]);

  // Bind profile-chart interactions once (drives the map marker). The x value is a
  // time (seconds); map it to a record index, which positions the marker.
  const onElevInit = useCallback((c) => {
    elevRef.current = c;
    c.on('updateAxisPointer', (e) => {
      const ai = (e && e.axesInfo || []).find((a) => typeof a.value === 'number');
      if (!ai) return;
      setSelIdx(idxAtTime(ai.value));
    });
    c.on('click', (e) => {
      const v = e && e.value;
      const t = Array.isArray(v) ? v[0] : null;
      if (typeof t === 'number') setSelIdx(idxAtTime(t));
    });
  }, [idxAtTime]);

  const onMapClick = useCallback(({ lat, lon }) => {
    const recs = recordsRef.current;
    let best = 0, bd = Infinity;
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i]; if (r.lat == null) continue;
      const d = (r.lat - lat) ** 2 + (r.lon - lon) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    setSelIdx(best);
  }, []);

  function selectLap(i) {
    if (!laps || !laps[i]) return;
    setSelLap(i);
    setSelIdx(idxAtTime(laps[i].start_t || 0));
  }

  function fitWindow() {
    setZoomToLap(false);
    setOnlyLap(false);
    setFitToken((x) => x + 1);
  }

  const timeOfDay = useMemo(() => {
    if (!activity || !activity.start_time || !cur || cur.t == null) return '—';
    const d = new Date(new Date(activity.start_time).getTime() + cur.t * 1000);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [activity, cur]);

  return (
    <div className="lc-wrap">
      <div className="linked">
        {/* ---- Left: Laps ---- */}
        <div className="linked-left">
          <div className="card pad">
            <div className="lc-head">
              <h3 className="section-title" style={{ margin: 0 }}>🔁 圈速</h3>
              <span className="lc-sub">已记录 · {(laps || []).length} 圈</span>
            </div>
            {(laps && laps.length) ? (
              <div className="table-wrap laps-wrap">
                <table>
                  <thead><tr><th>圈</th><th>时长</th><th>距离</th><th>均速</th><th>爬升</th><th>心率</th><th>功率</th></tr></thead>
                  <tbody>
                    {laps.map((l, i) => (
                      <tr key={i} className={i === selLap ? 'sel' : ''} onClick={() => selectLap(i)}>
                        <td><b>{i + 1}</b></td>
                        <td>{tLabel(l.duration_s)}</td>
                        <td>{num(l.distance_m / 1000, 1)}</td>
                        <td>{l.avg_speed != null ? num(l.avg_speed) : '—'}</td>
                        <td>{l.elevation_gain != null ? Math.round(l.elevation_gain) + ' m' : '—'}</td>
                        <td>{l.avg_hr != null ? l.avg_hr : '—'}</td>
                        <td>{l.avg_power != null ? l.avg_power : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty small">该活动无圈速数据</div>
            )}
          </div>
        </div>

        {/* ---- Right: Map + info panel ---- */}
        <div className="linked-right">
          <div className="card pad">
            <div className="map-controls">
              <h3 className="section-title" style={{ margin: '0 12px 0 0' }}>🗺️ 地图</h3>
              <label className="chk"><input type="checkbox" checked={showDots} onChange={(e) => setShowDots(e.target.checked)} /> 轨迹定位点</label>
              <label className="chk" title="需先在左侧选中一个圈"><input type="checkbox" checked={zoomToLap} onChange={(e) => setZoomToLap(e.target.checked)} /> 缩放至圈</label>
              <label className="chk" title="需先在左侧选中一个圈"><input type="checkbox" checked={onlyLap} onChange={(e) => setOnlyLap(e.target.checked)} /> 仅显示所选圈</label>
              <button className="btn btn-ghost btn-sm" onClick={fitWindow}>适应窗口</button>
            </div>
            <div className="map-wrap">
              {hasGps ? (
                <InteractiveMap
                  points={points}
                  marker={marker}
                  focus={focus}
                  segment={segment}
                  showDots={showDots}
                  fitToken={fitToken}
                  onMapClick={onMapClick}
                  height={440}
                />
              ) : (
                <div className="map" style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7688' }}>该活动无 GPS 轨迹</div>
              )}
              {/* current-position info panel (overlay) */}
              <div className="map-panel">
                <div className="mp-title">当前位置 <span className="mp-idx">#{selIdx + 1}/{N}</span></div>
                <div className="mp-row"><span>时刻</span><b>{timeOfDay}</b></div>
                <div className="mp-row"><span>速度</span><b>{cur && cur.speed != null ? num(cur.speed) : '—'}<i> km/h</i></b></div>
                <div className="mp-row"><span>海拔</span><b>{cur && cur.altitude != null ? Math.round(cur.altitude) : '—'}<i> m</i></b></div>
                <div className="mp-row"><span>距离</span><b>{cur && cur.distance_m != null ? num(cur.distance_m / 1000, 2) : '—'}<i> km</i></b></div>
                <div className="mp-row"><span>心率</span><b>{cur && cur.hr != null ? cur.hr : '—'}<i> bpm</i></b></div>
                <div className="mp-row"><span>功率</span><b>{cur && cur.power != null ? num(cur.power) : '—'}<i> W</i></b></div>
                {records.some((r) => r.speed != null) && <SpeedSpark records={records} idx={selIdx} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Bottom: switchable profile (linked), axes match the selected metric card ---- */}
      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 className="section-title">{metric.icon} {metric.name}剖面 <span className="muted lc-hint">· 点击下方任一指标图表可切换本图（横轴=时间、纵轴=该指标，与所选图表一致）· 与地图 / 圈速联动：在曲线上悬停或点击、点击地图任意处、或选中左侧某圈，即可联动查看该点指标</span></h3>
        {hasSeries ? (
          <Chart option={profileOption} onInit={onElevInit} height={300} />
        ) : (
          <div className="empty small">该活动无{metric.name}数据</div>
        )}
      </div>
    </div>
  );
}
