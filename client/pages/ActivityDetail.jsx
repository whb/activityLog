import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import LeafletMap from '../components/LeafletMap.jsx';
import { sportMeta, fmtDateTime, fmtDuration, num, tLabel } from '../lib/format.js';

function buildSeries(records, getVal) {
  const pts = [];
  for (const r of records) {
    const v = getVal(r);
    if (v != null && isFinite(v)) pts.push([r.t != null ? r.t : pts.length, +v]);
  }
  return pts;
}

export default function ActivityDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(null); setErr('');
    api.activity(id).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  const charts = useMemo(() => {
    if (!data) return [];
    const recs = data.records;
    const has = (f) => recs.some((r) => r[f] != null && isFinite(r[f]));
    const xaxis = {
      type: 'value', min: 'dataMin', max: 'dataMax',
      axisLabel: { formatter: (v) => tLabel(v), color: '#6b7688' },
      splitLine: { show: false }, axisLine: { lineStyle: { color: '#e6eaf2' } },
    };
    const base = (color, name, unit, area) => ({
      tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '' : v + ' ' + unit), formatter: (ps) => `${name}\n${tLabel(ps[0]?.value[0])} · ${ps[0]?.value[1]} ${unit}` },
      grid: { left: 48, right: 16, top: 30, bottom: 40 },
      xAxis: xaxis,
      yAxis: { type: 'value', name: unit, nameTextStyle: { color: '#6b7688', align: 'left' }, scale: true, splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' } },
      series: [{
        type: 'line', smooth: false, showSymbol: false, sampling: 'lttb', data: [],
        lineStyle: { width: 2, color }, itemStyle: { color },
        areaStyle: area ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '44' }, { offset: 1, color: color + '05' }] } } : undefined,
      }],
    });
    const make = (key, getVal, color, name, unit, area) => {
      const opt = base(color, name, unit, area);
      opt.series[0].data = buildSeries(recs, getVal);
      return { key, name, icon: { 海拔: '⛰️', 速度: '⚡', 心率: '❤️', 功率: '⚙️', 踏频: '🚴', 温度: '🌡️', 距离: '📏' }[name] || '📈', opt, count: opt.series[0].data.length };
    };
    const out = [];
    if (has('altitude')) out.push(make('alt', (r) => r.altitude, '#16a34a', '海拔', 'm', true));
    if (has('distance_m')) out.push(make('dist', (r) => r.distance_m / 1000, '#4f46e5', '距离', 'km', true));
    if (has('speed')) out.push(make('spd', (r) => r.speed, '#f59e0b', '速度', 'km/h', false));
    if (has('hr')) out.push(make('hr', (r) => r.hr, '#ef4444', '心率', 'bpm', false));
    if (has('power')) out.push(make('pwr', (r) => r.power, '#7c3aed', '功率', 'W', true));
    if (has('cadence')) out.push(make('cad', (r) => r.cadence, '#06b6d4', '踏频', 'spm', false));
    if (has('temperature')) out.push(make('tmp', (r) => r.temperature, '#0ea5e9', '温度', '°C', false));
    return out;
  }, [data]);

  const mapPoints = useMemo(() => {
    if (!data) return [];
    return data.records.filter((r) => r.lat != null && r.lon != null).map((r) => [r.lat, r.lon]);
  }, [data]);

  async function remove() {
    if (!confirm('确定删除这条活动记录？')) return;
    try { await api.remove(id); nav('/activities'); } catch (e) { alert('删除失败：' + e.message); }
  }

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!data) return <div className="loader"><span className="spin" /> 加载中…</div>;

  const a = data.activity;
  const m = sportMeta(a.sport);

  const tiles = [
    { lab: '总里程', val: a.distance_km != null ? num(a.distance_km) : '—', unit: 'km' },
    { lab: '总时长', val: fmtDuration(a.duration_s), unit: '' },
    { lab: '移动时间', val: a.moving_s != null ? fmtDuration(a.moving_s) : '—', unit: '' },
    { lab: '平均速度', val: a.avg_speed != null ? num(a.avg_speed) : '—', unit: 'km/h' },
    { lab: '最高速度', val: a.max_speed != null ? num(a.max_speed) : '—', unit: 'km/h' },
    { lab: '平均心率', val: a.avg_hr != null ? a.avg_hr : '—', unit: 'bpm' },
    { lab: '最高心率', val: a.max_hr != null ? a.max_hr : '—', unit: 'bpm' },
    { lab: '平均功率', val: a.avg_power != null ? a.avg_power : '—', unit: 'W' },
    { lab: '最高功率', val: a.max_power != null ? a.max_power : '—', unit: 'W' },
    { lab: '总爬升', val: a.elevation_gain != null ? Math.round(a.elevation_gain) : '—', unit: 'm' },
    { lab: '总下降', val: a.elevation_loss != null ? Math.round(a.elevation_loss) : '—', unit: 'm' },
    { lab: '平均踏频', val: a.avg_cadence != null ? a.avg_cadence : '—', unit: 'spm' },
    { lab: '最高温度', val: a.max_temp != null ? num(a.max_temp) : '—', unit: '°C' },
    { lab: '记录点', val: data.records.length, unit: '个' },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="breadcrumb-link" onClick={() => nav('/activities')}>← 活动记录</div>
          <h1 style={{ marginTop: 6 }}>
            <span className="tag" style={{ background: m.color + '22', color: m.color, marginRight: 10 }}>{m.icon} {m.label}</span>
            {a.name || '活动'}
          </h1>
          <div className="crumb">{fmtDateTime(a.start_time)}{a.device ? ' · ' + a.device : ''}</div>
        </div>
        <button className="btn btn-ghost" onClick={remove}>🗑 删除</button>
      </div>

      <div className="tiles" style={{ marginBottom: 16 }}>
        {tiles.map((t) => (
          <div className="tile" key={t.lab}>
            <div className="lab">{t.lab}</div>
            <div className="val">{t.val}{t.unit ? <span className="unit">{t.unit}</span> : null}</div>
          </div>
        ))}
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <h3 className="section-title">轨迹地图</h3>
        <LeafletMap points={mapPoints} height={440} />
      </div>

      {charts.length ? (
        <div className="grid charts-3">
          {charts.map((c) => (
            <div className="card pad" key={c.key}>
              <h3 className="section-title">{c.icon} {c.name} <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>· {c.count} 点</span></h3>
              <Chart option={c.opt} height={240} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card pad empty">该活动没有可绘制的时序指标数据</div>
      )}
    </div>
  );
}
