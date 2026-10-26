import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { sportMeta, fmtDate, fmtDuration, num } from '../lib/format.js';
import { trainingLoad, calendarHeatmap, weekdayHourHeatmap } from '../lib/analysis.js';

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const TL_COLOR = { red: '#ef4444', orange: '#f97316', amber: '#f59e0b', green: '#16a34a' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [acts, setActs] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.reports().then(setData).catch((e) => setErr(e.message));
    api.activities().then(setActs).catch(() => setActs([]));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const months = [...new Set(data.monthly.map((m) => m.month))].sort();
    const sports = [...new Set(data.monthly.map((m) => m.sport))];
    const find = (mo, sp) => {
      const r = data.monthly.find((x) => x.month === mo && x.sport === sp);
      return r ? r.distance_km : 0;
    };

    const monthlyBar = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, textStyle: { color: '#6b7688' } },
      grid: { left: 48, right: 18, top: 24, bottom: 40 },
      xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#e6eaf2' } }, axisLabel: { color: '#6b7688' } },
      yAxis: { type: 'value', name: 'km', nameTextStyle: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' } },
      series: sports.map((sp) => ({
        name: sportMeta(sp).label, type: 'bar', stack: 'total', barMaxWidth: 46,
        itemStyle: { color: sportMeta(sp).color },
        emphasis: { focus: 'series' },
        data: months.map((mo) => find(mo, sp)),
      })),
    };

    const pie = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} km ({d}%)' },
      legend: { bottom: 0, icon: 'circle', textStyle: { color: '#6b7688' } },
      series: [{
        type: 'pie', radius: ['42%', '68%'], center: ['50%', '46%'], avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%' },
        data: data.totals.filter((t) => t.distance_km > 0).map((t) => ({
          name: sportMeta(t.sport).label, value: t.distance_km, itemStyle: { color: sportMeta(t.sport).color },
        })),
      }],
    };

    const hoursLine = {
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 18, top: 24, bottom: 40 },
      xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#e6eaf2' } }, axisLabel: { color: '#6b7688' } },
      yAxis: { type: 'value', name: '小时', nameTextStyle: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' } },
      series: [{
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
        lineStyle: { width: 3, color: '#7c3aed' },
        itemStyle: { color: '#7c3aed' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(124,58,237,.25)' }, { offset: 1, color: 'rgba(124,58,237,0)' }] } },
        data: months.map((mo) => {
          const rows = data.monthly.filter((x) => x.month === mo);
          return +(rows.reduce((s, r) => s + (r.hours || 0), 0)).toFixed(1);
        }),
      }],
    };

    // ---- 训练负荷 PMC + 红绿灯 ----
    const tl = trainingLoad(acts);
    const pmc = tl.series.length ? {
      tooltip: { trigger: 'axis' },
      legend: { data: ['ATL 急性负荷', 'CTL 慢性体能', 'TSB 状态'], bottom: 0, textStyle: { color: '#6b7688' } },
      grid: { left: 44, right: 18, top: 24, bottom: 40 },
      xAxis: { type: 'category', data: tl.series.map((s) => s.date), boundaryGap: false, axisLine: { lineStyle: { color: '#e6eaf2' } }, axisLabel: { color: '#6b7688', formatter: (v) => v.slice(5) } },
      yAxis: { type: 'value', axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
      series: [
        { name: 'ATL 急性负荷', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' }, data: tl.series.map((s) => s.atl) },
        { name: 'CTL 慢性体能', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#4f46e5' }, itemStyle: { color: '#4f46e5' }, data: tl.series.map((s) => s.ctl) },
        { name: 'TSB 状态', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#16a34a' }, itemStyle: { color: '#16a34a' }, areaStyle: { color: 'rgba(22,163,74,.08)' }, data: tl.series.map((s) => s.tsb) },
      ],
    } : null;

    // ---- 星期 × 时段 热力图 ----
    const whData = weekdayHourHeatmap(acts);
    const wh = whData.data.length ? {
      tooltip: { position: 'top', formatter: (p) => `${DAY_LABELS[p.value[1]]} ${p.value[0]}:00–${p.value[0] + 1}:00<br/>时长 ${p.value[2]} h` },
      grid: { left: 44, right: 12, top: 12, bottom: 60 },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => i), splitArea: { show: true }, axisLine: { lineStyle: { color: '#e6eaf2' } }, axisLabel: { color: '#6b7688', interval: 1 } },
      yAxis: { type: 'category', data: DAY_LABELS, inverse: true, splitArea: { show: true }, axisLine: { lineStyle: { color: '#e6eaf2' } }, axisLabel: { color: '#6b7688' } },
      visualMap: { min: 0, max: whData.max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef2ff', '#818cf8', '#4338ca'] }, textStyle: { color: '#6b7688' } },
      series: [{ type: 'heatmap', data: whData.data, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.4)' } } }],
    } : null;

    // ---- 日历热力图（限最近 12 个月，避免跨度过大） ----
    const calRaw = calendarHeatmap(acts);
    let cal = null, calData = null;
    if (calRaw.data.length && calRaw.max) {
      const lastD = new Date(calRaw.max + 'T00:00:00Z');
      const capStart = new Date(lastD); capStart.setUTCDate(capStart.getUTCDate() - 364);
      const rs = capStart.toISOString().slice(0, 10);
      const inRange = calRaw.data.filter((d) => d[0] >= rs && d[0] <= calRaw.max);
      if (inRange.length) {
        calData = inRange;
        const maxKm = Math.max(...inRange.map((d) => d[1]), 1);
        cal = {
          tooltip: { formatter: (p) => { const [d, km, c, h] = p.value; return `${d}<br/>里程 ${km} km<br/>活动 ${c} 次<br/>时长 ${h} h`; } },
          visualMap: { min: 0, max: maxKm, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef2ff', '#a5b4fc', '#4f46e5', '#312e81'] }, textStyle: { color: '#6b7688' } },
          calendar: {
            range: [rs, calRaw.max], cellSize: ['auto', 14], top: 30, left: 44,
            itemStyle: { color: 'transparent', borderWidth: 3, borderColor: '#fff' },
            dayLabel: { color: '#6b7688', nameMap: 'ZH', fontSize: 10 },
            monthLabel: { color: '#6b7688', nameMap: 'ZH', fontSize: 11 },
            yearLabel: { show: false }, splitLine: { show: false },
          },
          series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData.map((d) => [d[0], d[1]]) }],
        };
      }
    }

    return { monthlyBar, pie, hoursLine, pmc, wh, cal, calData, status: tl.status };
  }, [data, acts]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!data || !view) return <div className="loader"><span className="spin" /> 加载中…</div>;

  const g = data.grand;
  const { monthlyBar, pie, hoursLine, pmc, wh, cal, status } = view;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>仪表盘</h1>
          <div className="crumb">训练数据总览、趋势与负荷分析</div>
        </div>
        <Link to="/import" className="btn btn-primary">📥 导入 FIT</Link>
      </div>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <span className="bar" style={{ background: '#4f46e5' }} />
          <span className="lab">活动总数</span>
          <span className="val">{g.count}</span>
          <span className="hint">{fmtDate(g.first)} 至 {fmtDate(g.last)}</span>
        </div>
        <div className="card stat">
          <span className="bar" style={{ background: '#2196f3' }} />
          <span className="lab">总里程</span>
          <span className="val">{num(g.distance_km)}</span>
          <span className="hint">千米</span>
        </div>
        <div className="card stat">
          <span className="bar" style={{ background: '#f59e0b' }} />
          <span className="lab">总时长</span>
          <span className="val">{num(g.hours, 1)}</span>
          <span className="hint">小时</span>
        </div>
        <div className="card stat">
          <span className="bar" style={{ background: '#16a34a' }} />
          <span className="lab">运动类型</span>
          <span className="val">{data.totals.length}</span>
          <span className="hint">{data.totals.map((t) => sportMeta(t.sport).label).join(' · ') || '—'}</span>
        </div>
      </div>

      {g.count === 0 ? (
        <div className="card pad empty" style={{ marginTop: 10 }}>
          <div className="big">📭</div>
          <div style={{ fontWeight: 600, color: '#1c2431' }}>还没有活动数据</div>
          <p style={{ margin: '8px 0 18px' }}>导入你的 .FIT 训练文件开始分析，或运行 <code>npm run seed</code> 载入演示数据。</p>
          <Link to="/import" className="btn btn-primary">去导入</Link>
        </div>
      ) : (
        <>
          {/* 训练状态红绿灯 + PMC 指标 */}
          {status && (
            <div className="grid charts-2" style={{ marginBottom: 16 }}>
              <div className="card pad traffic-light" style={{ borderLeft: `4px solid ${TL_COLOR[status.color]}` }}>
                <h3 className="section-title">训练状态（Traffic Light）</h3>
                <div className="tl-row">
                  <span className="tl-dot" style={{ background: TL_COLOR[status.color] }} />
                  <span className="tl-label" style={{ color: TL_COLOR[status.color] }}>{status.label}</span>
                </div>
                <p className="tl-desc">{status.desc}</p>
                <div className="tl-metrics">
                  <div className="tl-m"><span>CTL 体能</span><b style={{ color: '#4f46e5' }}>{status.ctl}</b></div>
                  <div className="tl-m"><span>ATL 疲劳</span><b style={{ color: '#f59e0b' }}>{status.atl}</b></div>
                  <div className="tl-m"><span>TSB 状态</span><b style={{ color: '#16a34a' }}>{status.tsb > 0 ? '+' : ''}{status.tsb}</b></div>
                </div>
              </div>
              <div className="card pad">
                <h3 className="section-title">PMC 训练负荷趋势（ATL / CTL / TSB）</h3>
                {pmc ? <Chart option={pmc} height={230} /> : <div className="empty">数据不足</div>}
              </div>
            </div>
          )}

          <div className="card pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">月度里程构成（按运动类型堆叠）</h3>
            <Chart option={monthlyBar} height={320} />
          </div>

          <div className="grid charts-2" style={{ marginBottom: 16 }}>
            <div className="card pad">
              <h3 className="section-title">运动时长趋势（月）</h3>
              <Chart option={hoursLine} height={300} />
            </div>
            <div className="card pad">
              <h3 className="section-title">里程占比</h3>
              <Chart option={pie} height={300} />
            </div>
          </div>

          {/* 热力图 */}
          <div className="grid charts-2" style={{ marginBottom: 16 }}>
            <div className="card pad">
              <h3 className="section-title">🕒 训练时段热力图（星期 × 小时）</h3>
              {wh ? <Chart option={wh} height={300} /> : <div className="empty">暂无足够数据</div>}
            </div>
            <div className="card pad">
              <h3 className="section-title">📅 活动日历热力图（最近 12 个月里程）</h3>
              {cal ? <Chart option={cal} height={300} /> : <div className="empty">暂无足够数据</div>}
            </div>
          </div>

          <div className="card">
            <div className="pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
              <h3 className="section-title" style={{ margin: 0 }}>各运动类型累计</h3>
              <Link to="/activities" className="btn btn-ghost">查看活动 →</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>类型</th><th>次数</th><th>里程 (km)</th><th>时长</th><th>平均时长/次</th></tr>
                </thead>
                <tbody>
                  {data.totals.map((t) => (
                    <tr key={t.sport} onClick={() => (window.location.href = '/activities')}>
                      <td><span className="tag" style={{ background: sportMeta(t.sport).color + '22', color: sportMeta(t.sport).color }}>{sportMeta(t.sport).icon} {sportMeta(t.sport).label}</span></td>
                      <td>{t.count}</td>
                      <td>{num(t.distance_km)}</td>
                      <td>{fmtDuration(t.hours * 3600)}</td>
                      <td className="muted">{t.count ? fmtDuration((t.hours * 3600) / t.count) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
