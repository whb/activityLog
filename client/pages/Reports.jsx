import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { sportMeta, num } from '../lib/format.js';
import { downloadCSV } from '../lib/export.js';

export default function Reports() {
  const [data, setData] = useState(null);
  const [sports, setSports] = useState([]);
  const [f, setF] = useState({ sport: 'all' });
  const [err, setErr] = useState('');

  useEffect(() => { api.sports().then(setSports).catch(() => {}); }, []);
  useEffect(() => { setData(null); api.reportsMonthly(f).then(setData).catch((e) => setErr(e.message)); }, [f]);

  const view = useMemo(() => {
    if (!data || !data.rows.length) return null;
    const rows = data.rows;
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const totalByMonth = {};
    for (const r of rows) {
      const t = (totalByMonth[r.month] = totalByMonth[r.month] || { count: 0, hours: 0, distance_km: 0, elevation: 0 });
      t.count += r.count; t.hours += r.hours || 0; t.distance_km += r.distance_km || 0; t.elevation += r.elevation || 0;
    }
    const sportSet = [...new Set(rows.map((r) => r.sport))];
    const find = (mo, sp) => { const r = rows.find((x) => x.month === mo && x.sport === sp); return r ? r.distance_km : 0; };
    const bar = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: '#6b7688' } },
      grid: { left: 48, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: months, axisLabel: { color: '#6b7688' } },
      yAxis: { type: 'value', name: 'km', nameTextStyle: { color: '#6b7688' }, axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
      series: sportSet.map((sp) => ({ name: sportMeta(sp).label, type: 'bar', stack: 't', barMaxWidth: 40, itemStyle: { color: sportMeta(sp).color }, data: months.map((mo) => find(mo, sp)) })),
    };
    return { rows, months, totalByMonth, bar };
  }, [data]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!data) return <div className="loader"><span className="spin" /> 加载中…</div>;

  return (
    <div>
      <div className="topbar">
        <div><h1>报表</h1><div className="crumb">按月聚合的训练报告（复刻 ActivityLog2 · Reports）</div></div>
        <div className="filters">
          <select value={f.sport} onChange={(e) => setF((p) => ({ ...p, sport: e.target.value }))}>
            <option value="all">全部运动</option>
            {sports.map((s) => <option key={s} value={s}>{sportMeta(s).icon} {sportMeta(s).label}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => downloadCSV('reports-monthly', data ? data.rows : [])}>📄 导出 CSV</button>
        </div>
      </div>

      {!view ? (
        <div className="card pad empty">暂无数据</div>
      ) : (
        <>
          <div className="card pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">月度里程（按运动堆叠）</h3>
            <Chart option={view.bar} height={320} />
          </div>

          <div className="card">
            <div className="pad" style={{ paddingBottom: 8 }}><h3 className="section-title" style={{ margin: 0 }}>月度明细</h3></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>月份</th><th>运动</th><th>次数</th><th>时长(h)</th><th>里程(km)</th><th>均心率</th><th>均踏频</th><th>爬升(m)</th><th>均功率(W)</th></tr>
                </thead>
                <tbody>
                  {view.months.map((mo) => (
                    <MonthBlock key={mo} month={mo} rows={view.rows} total={view.totalByMonth[mo]} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card pad" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="section-title" style={{ margin: 0 }}>底层 SQL</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(data.sql); alert('SQL 已复制到剪贴板'); }}>📋 复制</button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>该报表由以下查询生成，可作为自定义报表的起点：</p>
            <pre className="sql">{data.sql}</pre>
          </div>
        </>
      )}
    </div>
  );
}

function MonthBlock({ month, rows, total }) {
  const rs = rows.filter((r) => r.month === month);
  return (
    <>
      {rs.map((r, i) => (
        <tr key={month + r.sport + i}>
          <td className="muted">{i === 0 ? month : ''}</td>
          <td><span className="tag" style={{ background: sportMeta(r.sport).color + '22', color: sportMeta(r.sport).color }}>{sportMeta(r.sport).icon} {sportMeta(r.sport).label}</span></td>
          <td>{r.count}</td><td>{num(r.hours)}</td><td>{num(r.distance_km)}</td>
          <td>{r.avg_hr != null ? r.avg_hr : '—'}</td><td>{r.avg_cadence != null ? r.avg_cadence : '—'}</td>
          <td>{r.elevation != null ? Math.round(r.elevation) : '—'}</td><td>{r.avg_power != null ? Math.round(r.avg_power) : '—'}</td>
        </tr>
      ))}
      <tr className="month-total">
        <td colSpan={2}><b>小计</b></td>
        <td><b>{total.count}</b></td><td><b>{num(total.hours)}</b></td><td><b>{num(total.distance_km)}</b></td>
        <td colSpan={4} className="muted">—</td>
      </tr>
    </>
  );
}
