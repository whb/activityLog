import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { fmtDate } from '../lib/format.js';

export default function Equipment() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.equipment().then(setRows).catch((e) => setErr(e.message)); }, []);

  const bar = useMemo(() => {
    if (!rows) return null;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => v + ' h' },
      grid: { left: 90, right: 30, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '小时', splitLine: { lineStyle: { color: '#eef1f7' } }, axisLabel: { color: '#6b7688' } },
      yAxis: { type: 'category', data: rows.map((r) => r.product_name || r.serial_number || '未知'), axisLabel: { color: '#1c2431' } },
      series: [{ type: 'bar', barMaxWidth: 26, data: rows.map((r) => +((r.usage_hours || 0)).toFixed(1)), itemStyle: { color: '#4f46e5', borderRadius: 6 }, label: { show: true, position: 'right', formatter: '{c} h', color: '#6b7688' } }],
    };
  }, [rows]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!rows) return <div className="loader"><span className="spin" /> 加载中…</div>;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>装备</h1>
          <div className="crumb">追踪设备使用情况（来自 FIT 文件中的设备信息）</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card pad empty">
          <div className="big">🔧</div>
          还没有装备数据
          <p style={{ marginTop: 8 }}>导入包含设备信息的 .FIT 文件后，这里会自动统计每台设备的累计使用时长。</p>
        </div>
      ) : (
        <>
          <div className="card pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">累计使用时长</h3>
            <Chart option={bar} height={Math.max(180, rows.length * 56)} />
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>设备</th><th>厂商</th><th>序列号</th><th>使用时长</th><th>关联活动</th><th>首次</th><th>最近</th></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} style={{ cursor: 'default' }}>
                      <td style={{ fontWeight: 700 }}>⌚ {e.product_name || '未知设备'}</td>
                      <td>{e.manufacturer || '—'}</td>
                      <td className="muted">{e.serial_number || '—'}</td>
                      <td>{Number(e.usage_hours || 0).toFixed(2)} h</td>
                      <td>{e.activity_count}</td>
                      <td className="muted">{fmtDate(e.first_seen)}</td>
                      <td className="muted">{fmtDate(e.last_seen)}</td>
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
