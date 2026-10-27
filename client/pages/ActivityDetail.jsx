import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import LinkedCharts from '../components/LinkedCharts.jsx';
import { sportMeta, fmtDateTime, fmtDuration, num, tLabel } from '../lib/format.js';
import {
  powerAnalysis, powerSpikes, climbAnalysis,
  scatter, histogram, swimStats,
} from '../lib/analysis.js';

const ZONE_COLORS = ['#16a34a', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];

// Time-series metrics. Each drives both a selectable card below AND (when selected)
// the switchable profile chart up top (which keeps its distance x-axis for map linkage).
const METRIC_DEFS = [
  { key: 'alt',  name: '海拔', icon: '⛰️', unit: 'm',    color: '#16a34a', area: true,  getVal: (r) => r.altitude },
  { key: 'dist', name: '距离', icon: '📏', unit: 'km',   color: '#4f46e5', area: true,  getVal: (r) => (r.distance_m != null ? r.distance_m / 1000 : null) },
  { key: 'spd',  name: '速度', icon: '⚡', unit: 'km/h', color: '#f59e0b', area: false, getVal: (r) => r.speed },
  { key: 'hr',   name: '心率', icon: '❤️', unit: 'bpm',  color: '#ef4444', area: false, getVal: (r) => r.hr },
  { key: 'pwr',  name: '功率', icon: '⚙️', unit: 'W',    color: '#7c3aed', area: true,  getVal: (r) => r.power },
  { key: 'cad',  name: '踏频', icon: '🚴', unit: 'spm',  color: '#06b6d4', area: false, getVal: (r) => r.cadence },
  { key: 'tmp',  name: '温度', icon: '🌡️', unit: '°C',  color: '#0ea5e9', area: false, getVal: (r) => r.temperature },
];

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
  const [selectedKey, setSelectedKey] = useState('alt');

  useEffect(() => {
    setData(null); setErr('');
    api.activity(id).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  const charts = useMemo(() => {
    if (!data) return [];
    const recs = data.records;
    const xaxis = {
      type: 'value', min: 'dataMin', max: 'dataMax',
      axisLabel: { formatter: (v) => tLabel(v), color: '#6b7688' },
      splitLine: { show: false }, axisLine: { lineStyle: { color: '#e6eaf2' } },
    };
    const build = (def) => ({
      tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '' : v + ' ' + def.unit), formatter: (ps) => `${def.name}\n${tLabel(ps[0]?.value[0])} · ${ps[0]?.value[1]} ${def.unit}` },
      grid: { left: 48, right: 16, top: 30, bottom: 40 },
      xAxis: xaxis,
      yAxis: { type: 'value', name: def.unit, nameTextStyle: { color: '#6b7688', align: 'left' }, scale: true, splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' } },
      series: [{
        type: 'line', smooth: false, showSymbol: false, sampling: 'lttb', data: [],
        lineStyle: { width: 2, color: def.color }, itemStyle: { color: def.color },
        areaStyle: def.area ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: def.color + '44' }, { offset: 1, color: def.color + '05' }] } } : undefined,
      }],
    });
    const out = [];
    for (const def of METRIC_DEFS) {
      const opt = build(def);
      opt.series[0].data = buildSeries(recs, def.getVal);
      const count = opt.series[0].data.length;
      if (count) out.push({ ...def, opt, count });
    }
    return out;
  }, [data]);

  // The selected metric drives the switchable profile chart up top. Falls back to
  // the first available metric if the current selection is not present for this activity.
  const selectedDef = charts.find((c) => c.key === selectedKey) || charts[0] || null;

  // ---- 深度分析（功率/爬升/散点/直方图/游泳） ----
  const an = useMemo(() => {
    if (!data) return {};
    const recs = data.records;
    const a = data.activity;
    const hasPower = recs.some((r) => r.power != null && r.power > 0);
    const pwr = hasPower ? powerAnalysis(recs, null) : null;
    const spikes = hasPower ? powerSpikes(recs) : [];
    const climbs = climbAnalysis(recs);
    const hrSpeed = scatter(recs, 'hr', 'speed');
    const powerSpeed = hasPower ? scatter(recs, 'power', 'speed') : [];
    const speedHist = histogram(recs.map((r) => r.speed));
    const hrHist = histogram(recs.map((r) => r.hr));
    const isSwim = ['swimming', 'swim'].includes(a.sport);
    const swim = isSwim ? swimStats(a, recs) : null;

    const axis = (name, unit) => ({
      name, axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } },
      nameTextStyle: { color: '#6b7688' },
    });
    const scatterOpt = (d, xName, yName, color) => ({
      tooltip: { trigger: 'item', formatter: (p) => `${xName}: ${p.value[0]}<br/>${yName}: ${p.value[1]}` },
      grid: { left: 50, right: 16, top: 20, bottom: 44 },
      xAxis: { type: 'value', ...axis(xName, ''), scale: true },
      yAxis: { type: 'value', ...axis(yName, ''), scale: true },
      series: [{ type: 'scatter', data: d, symbolSize: 6, itemStyle: { color, opacity: 0.55 } }],
    });
    const histOpt = (h, unit, color) => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name} – ${h.bins[p[0].dataIndex].x1} ${unit}<br/>${p[0].value} 样本` },
      grid: { left: 44, right: 16, top: 20, bottom: 52 },
      xAxis: { type: 'category', data: h.bins.map((b) => b.x0), axisLabel: { color: '#6b7688', interval: 2, rotate: 45 }, name: unit, nameTextStyle: { color: '#6b7688' } },
      yAxis: { type: 'value', name: '样本数', axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
      series: [{ type: 'bar', data: h.bins.map((b) => b.count), itemStyle: { color }, barMaxWidth: 24 }],
    });

    return {
      pwr, spikes, climbs, hrSpeed, powerSpeed, speedHist, hrHist, swim,
      curveOpt: pwr ? {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 48, right: 16, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: pwr.curve.map((c) => c.label), axisLabel: { color: '#6b7688' }, axisLine: { lineStyle: { color: '#e6eaf2' } } },
        yAxis: { type: 'value', name: 'W', nameTextStyle: { color: '#6b7688' }, axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
        series: [{ type: 'bar', data: pwr.curve.map((c) => c.w), itemStyle: { color: '#7c3aed' }, barMaxWidth: 44, label: { show: true, position: 'top', color: '#6b7688' } }],
      } : null,
      zoneOpt: pwr ? {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>${p[0].value}%` },
        grid: { left: 44, right: 16, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: pwr.zones.map((z) => z.name), axisLabel: { color: '#6b7688', interval: 0, fontSize: 11 }, axisLine: { lineStyle: { color: '#e6eaf2' } } },
        yAxis: { type: 'value', name: '%', max: 100, nameTextStyle: { color: '#6b7688' }, axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
        series: [{ type: 'bar', data: pwr.zones.map((z, i) => ({ value: z.pct, itemStyle: { color: ZONE_COLORS[i] } })), barMaxWidth: 40, label: { show: true, position: 'top', formatter: '{c}%', color: '#6b7688' } }],
      } : null,
      hrSpeedOpt: hrSpeed.length > 5 ? scatterOpt(hrSpeed, '心率 (bpm)', '速度 (km/h)', '#ef4444') : null,
      powerSpeedOpt: powerSpeed.length > 5 ? scatterOpt(powerSpeed, '功率 (W)', '速度 (km/h)', '#7c3aed') : null,
      speedHistOpt: speedHist ? histOpt(speedHist, 'km/h', '#f59e0b') : null,
      hrHistOpt: hrHist ? histOpt(hrHist, 'bpm', '#ef4444') : null,
    };
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
    { lab: '平均功率', val: a.avg_power != null ? num(a.avg_power) : '—', unit: 'W' },
    { lab: '最高功率', val: a.max_power != null ? num(a.max_power) : '—', unit: 'W' },
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

      <div style={{ marginBottom: 16 }}>
        <LinkedCharts key={id} activity={a} records={data.records} laps={data.laps} metric={selectedDef || METRIC_DEFS[0]} />
      </div>

      {charts.length ? (
        <div className="grid charts-3" style={{ marginBottom: 16 }}>
          {charts.map((c) => (
            <div
              key={c.key}
              className={'card pad metric-card' + (selectedDef && c.key === selectedDef.key ? ' selected' : '')}
              onClick={() => setSelectedKey(c.key)}
              title="点击：在上方剖面图中查看该指标"
            >
              <h3 className="section-title">{c.icon} {c.name} <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>· {c.count} 点</span></h3>
              <Chart option={c.opt} height={240} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card pad empty">该活动没有可绘制的时序指标数据</div>
      )}

      {/* ===== 深度分析（复刻 ActivityLog2） ===== */}
      {an.swim && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 className="section-title">🏊 游泳指标</h3>
          <div className="tiles">
            {an.swim.pace != null && (
              <div className="tile"><div className="lab">配速</div><div className="val">{Math.floor(an.swim.pace / 60)}:{String(Math.round(an.swim.pace % 60)).padStart(2, '0')}<span className="unit">/100m</span></div></div>
            )}
            <div className="tile"><div className="lab">距离</div><div className="val">{num(a.distance_km, 2)}<span className="unit">km</span></div></div>
            <div className="tile"><div className="lab">平均心率</div><div className="val">{a.avg_hr || '—'}<span className="unit">bpm</span></div></div>
            {an.swim.swolf != null && <div className="tile"><div className="lab">SWOLF</div><div className="val">{an.swim.swolf}</div></div>}
          </div>
        </div>
      )}

      {an.pwr && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 className="section-title">⚙️ 功率分析（Aerolab 风格）</h3>
          <div className="tiles" style={{ marginBottom: 14 }}>
            <div className="tile"><div className="lab">平均功率</div><div className="val">{an.pwr.avg}<span className="unit">W</span></div></div>
            <div className="tile"><div className="lab">归一化功率 NP</div><div className="val">{an.pwr.np}<span className="unit">W</span></div></div>
            <div className="tile"><div className="lab">强度因子 IF</div><div className="val">{an.pwr.ifac}</div></div>
            <div className="tile"><div className="lab">TSS</div><div className="val">{an.pwr.tss}</div></div>
          </div>
          <div className="grid charts-2">
            <div><h4 className="sub-title">功率曲线（最佳平均功率）</h4><Chart option={an.curveOpt} height={230} /></div>
            <div><h4 className="sub-title">分区时间分布（Z1–Z5）</h4><Chart option={an.zoneOpt} height={230} /></div>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>注：未配置 FTP 时，IF 以该次平均功率为基准估算。</p>
        </div>
      )}

      {an.spikes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="pad" style={{ paddingBottom: 6 }}><h3 className="section-title" style={{ margin: 0 }}>⚡ 功率尖峰（&gt;1.5× 平均、持续 ≥3s，Top {an.spikes.length}）</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>开始</th><th>持续</th><th>峰值 (W)</th><th>均值 (W)</th></tr></thead>
              <tbody>
                {an.spikes.map((s, i) => (<tr key={i}><td>{tLabel(s.start)}</td><td>{s.dur}s</td><td><b>{s.peak}</b></td><td>{s.avg}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {an.climbs.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="pad" style={{ paddingBottom: 6 }}><h3 className="section-title" style={{ margin: 0 }}>⛰️ 爬升分析（{an.climbs.length} 处）</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>长度 (m)</th><th>爬升 (m)</th><th>平均坡度</th><th>最大坡度</th><th>累积坡度</th><th>起点海拔</th></tr></thead>
              <tbody>
                {an.climbs.map((c, i) => (
                  <tr key={i}>
                    <td>{c.length}</td><td><b>{c.gain}</b></td>
                    <td>{c.avgGrade}%</td><td className="climb-grade">{c.maxGrade}%</td>
                    <td>{c.sumGrade}%</td><td>{c.alt} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(an.hrSpeedOpt || an.powerSpeedOpt) && (
        <div className="grid charts-2" style={{ marginBottom: 16 }}>
          {an.hrSpeedOpt && <div className="card pad"><h3 className="section-title">❤️ 心率 × 速度 散点</h3><Chart option={an.hrSpeedOpt} height={280} /></div>}
          {an.powerSpeedOpt && <div className="card pad"><h3 className="section-title">⚙️ 功率 × 速度 散点</h3><Chart option={an.powerSpeedOpt} height={280} /></div>}
        </div>
      )}

      {(an.speedHistOpt || an.hrHistOpt) && (
        <div className="grid charts-2" style={{ marginBottom: 16 }}>
          {an.speedHistOpt && <div className="card pad"><h3 className="section-title">⚡ 速度分布直方图</h3><Chart option={an.speedHistOpt} height={280} /></div>}
          {an.hrHistOpt && <div className="card pad"><h3 className="section-title">❤️ 心率分布直方图</h3><Chart option={an.hrHistOpt} height={280} /></div>}
        </div>
      )}
    </div>
  );
}
