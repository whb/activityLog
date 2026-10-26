import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { sportMeta, fmtDate, fmtDuration, num } from '../lib/format.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.reports().then(setData).catch((e) => setErr(e.message));
  }, []);

  const { monthlyBar, pie, hoursLine } = useMemo(() => {
    if (!data) return { monthlyBar: {}, pie: {}, hoursLine: {} };
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
        type: 'pie', radius: ['42%', '68%'], center: ['50%', '46%'],
        avoidLabelOverlap: true,
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
    return { monthlyBar, pie, hoursLine };
  }, [data]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!data) return <div className="loader"><span className="spin" /> 加载中…</div>;

  const g = data.grand;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>仪表盘</h1>
          <div className="crumb">训练数据总览与趋势</div>
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
