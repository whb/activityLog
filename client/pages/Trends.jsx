import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { sportMeta } from '../lib/format.js';
import { chartPNG } from '../lib/export.js';
import {
  trainingLoad, trainingVolumeTrend, timeInZoneTrend,
  aerobicEfficiencyTrend, injuryRiskTrend,
} from '../lib/analysis.js';

const GRID = { left: 48, right: 20, top: 30, bottom: 40 };
const AXIS = { color: '#6b7688' };
const ZONE_COLORS = ['#16a34a', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];

// 每个趋势图类型：title / 描述 / 由 acts 构建 ECharts option
const CHARTS = [
  {
    key: 'pmc', name: '性能（PMC）', icon: '📈',
    desc: 'ATL 急性负荷 / CTL 慢性体能 / TSB 状态（Banister TRIMP + 指数加权）。',
    build(acts) {
      const tl = trainingLoad(acts);
      if (!tl.series.length) return { empty: true };
      return {
        option: {
          tooltip: { trigger: 'axis' },
          legend: { data: ['ATL 急性负荷', 'CTL 慢性体能', 'TSB 状态'], bottom: 0, textStyle: AXIS },
          grid: GRID,
          xAxis: { type: 'category', data: tl.series.map((s) => s.date), boundaryGap: false, axisLabel: { color: AXIS.color, formatter: (v) => v.slice(5) } },
          yAxis: { type: 'value', axisLabel: { color: AXIS.color }, splitLine: { lineStyle: { color: '#eef1f7' } } },
          series: [
            { name: 'ATL 急性负荷', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' }, data: tl.series.map((s) => s.atl) },
            { name: 'CTL 慢性体能', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#4f46e5' }, itemStyle: { color: '#4f46e5' }, data: tl.series.map((s) => s.ctl) },
            { name: 'TSB 状态', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#16a34a' }, itemStyle: { color: '#16a34a' }, data: tl.series.map((s) => s.tsb) },
          ],
        },
      };
    },
  },
  {
    key: 'vol', name: '训练量（按运动）', icon: '🏃',
    desc: '每月按运动类型堆叠的里程，叠加总训练时长（双轴）。',
    build(acts) {
      const tv = trainingVolumeTrend(acts);
      if (!tv.months.length) return { empty: true };
      return {
        option: {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { bottom: 0, textStyle: AXIS, data: [...tv.sports.map((s) => sportMeta(s).label), '时长(h)'] },
          grid: GRID,
          xAxis: { type: 'category', data: tv.months, axisLabel: AXIS },
          yAxis: [
            { type: 'value', name: 'km', nameTextStyle: AXIS, axisLabel: { color: AXIS.color }, splitLine: { lineStyle: { color: '#eef1f7' } } },
            { type: 'value', name: '小时', nameTextStyle: AXIS, axisLabel: { color: AXIS.color }, splitLine: { show: false } },
          ],
          series: [
            ...tv.sports.map((sp) => ({
              name: sportMeta(sp).label, type: 'bar', stack: 'vol', barMaxWidth: 40,
              itemStyle: { color: sportMeta(sp).color }, data: tv.data.map((d) => d.bySport[sp] || 0),
            })),
            { name: '时长(h)', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6, lineStyle: { width: 2, color: '#334155' }, itemStyle: { color: '#334155' }, data: tv.data.map((d) => d.hours) },
          ],
        },
      };
    },
  },
  {
    key: 'tiz', name: '区间时间（Time in Zone）', icon: '🎯',
    desc: '每月在 Z1–Z5 各心率区间累计的时长（按平均心率归区）。',
    build(acts) {
      const tz = timeInZoneTrend(acts);
      if (!tz.months.length) return { empty: true };
      return {
        option: {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { bottom: 0, textStyle: AXIS },
          grid: GRID,
          xAxis: { type: 'category', data: tz.months, axisLabel: AXIS },
          yAxis: { type: 'value', name: '小时', nameTextStyle: AXIS, axisLabel: { color: AXIS.color }, splitLine: { lineStyle: { color: '#eef1f7' } } },
          series: tz.zones.map((z, i) => ({
            name: z, type: 'bar', stack: 'z', barMaxWidth: 40, itemStyle: { color: ZONE_COLORS[i] },
            data: tz.data.map((d) => d[z] || 0),
          })),
        },
      };
    },
  },
  {
    key: 'ae', name: '有氧效率', icon: '🫁',
    desc: '每单位心率产出（功率/心率 或 速度/心率），指数化（均值=100）观察训练适应趋势。',
    build(acts) {
      const ae = aerobicEfficiencyTrend(acts);
      if (!ae) return { empty: true };
      const bySport = {};
      for (const r of ae.rows) { (bySport[r.sport] = bySport[r.sport] || []).push(r); }
      return {
        option: {
          tooltip: { trigger: 'axis' },
          legend: { bottom: 0, textStyle: AXIS },
          grid: GRID,
          xAxis: { type: 'category', data: ae.rows.map((r) => r.date.slice(5)), axisLabel: { color: AXIS.color, interval: 'auto' } },
          yAxis: { type: 'value', name: '效率指数', nameTextStyle: AXIS, axisLabel: { color: AXIS.color }, splitLine: { lineStyle: { color: '#eef1f7' } } },
          series: Object.keys(bySport).map((sp) => ({
            name: sportMeta(sp).label, type: 'line', smooth: true, symbolSize: 5,
            lineStyle: { width: 2, color: sportMeta(sp).color }, itemStyle: { color: sportMeta(sp).color },
            data: ae.rows.map((r) => (r.sport === sp ? r.idx : null)), connectNulls: false,
          })),
        },
      };
    },
  },
  {
    key: 'irisk', name: '受伤风险（ACWR）', icon: '🩹',
    desc: '急性:慢性负荷比（7d/28d）。1.5–2.5 为「绿区」，>2 偏高，<0.8 负荷不足。',
    build(acts) {
      const ir = injuryRiskTrend(acts);
      if (!ir) return { empty: true };
      return {
        option: {
          tooltip: { trigger: 'axis' },
          legend: { data: ['ACWR 比', '急性(7d)', '慢性(28d)'], bottom: 0, textStyle: AXIS },
          grid: GRID,
          xAxis: { type: 'category', data: ir.series.map((s) => s.date.slice(5)), axisLabel: AXIS },
          yAxis: { type: 'value', axisLabel: { color: AXIS.color }, splitLine: { lineStyle: { color: '#eef1f7' } } },
          series: [
            {
              name: 'ACWR 比', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 3, color: '#ef4444' }, itemStyle: { color: '#ef4444' },
              markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed' }, data: [
                { yAxis: 0.8, label: { formatter: '不足', color: '#94a3b8' }, lineStyle: { color: '#cbd5e1' } },
                { yAxis: 1.5, label: { formatter: '绿区起', color: '#16a34a' }, lineStyle: { color: '#86efac' } },
                { yAxis: 2.5, label: { formatter: '高风险', color: '#ef4444' }, lineStyle: { color: '#fca5a5' } },
              ] },
              data: ir.series.map((s) => s.acwr),
            },
            { name: '急性(7d)', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' }, data: ir.series.map((s) => s.acute) },
            { name: '慢性(28d)', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#4f46e5' }, itemStyle: { color: '#4f46e5' }, data: ir.series.map((s) => s.chronic) },
          ],
        },
      };
    },
  },
];

export default function Trends() {
  const [acts, setActs] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState('pmc');
  const chartRef = useRef(null);

  useEffect(() => { api.activities().then(setActs).catch((e) => setErr(e.message)); }, []);
  const chart = useMemo(() => CHARTS.find((c) => c.key === sel) || CHARTS[0], [sel]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!acts) return <div className="loader"><span className="spin" /> 加载中…</div>;

  const built = chart.build(acts);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>趋势分析</h1>
          <div className="crumb">跨活动的时间序列趋势（复刻 ActivityLog2 · Trends）</div>
        </div>
        <button className="btn btn-ghost" onClick={() => chartPNG(chartRef.current, 'trend-' + sel)}>📷 导出当前图 PNG</button>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="filters">
          {CHARTS.map((c) => (
            <button key={c.key} className={'chip' + (c.key === sel ? ' active' : '')} onClick={() => setSel(c.key)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card pad">
        <h3 className="section-title">{chart.icon} {chart.name}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 14 }}>{chart.desc}</p>
        {built.empty ? <div className="empty">暂无足够数据生成此趋势（需 ≥2 条含时间/心率的活动）</div>
          : <Chart option={built.option} height={380} onInit={(c) => { chartRef.current = c; }} />}
      </div>
    </div>
  );
}
