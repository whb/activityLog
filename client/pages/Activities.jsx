import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { sportMeta, fmtDate, fmtDuration, num } from '../lib/format.js';
import { downloadCSV } from '../lib/export.js';

export default function Activities() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [sports, setSports] = useState([]);
  const [f, setF] = useState({ sport: 'all', from: '', to: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.activities(f).then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [f]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.sports().then(setSports).catch(() => {}); }, []);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function remove(id) {
    if (!confirm('确定删除这条活动记录？此操作不可撤销。')) return;
    try {
      await api.remove(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) { alert('删除失败：' + e.message); }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>活动记录</h1>
          <div className="crumb">共 {rows.length} 条 · 按时间倒序</div>
        </div>
        <button className="btn btn-ghost" onClick={() => downloadCSV('activities', rows)}>📄 导出 CSV（当前筛选）</button>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="filters">
          <select value={f.sport} onChange={(e) => set('sport', e.target.value)}>
            <option value="all">全部运动</option>
            {sports.map((s) => <option key={s} value={s}>{sportMeta(s).icon} {sportMeta(s).label}</option>)}
          </select>
          <input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} title="开始日期" />
          <span className="muted">至</span>
          <input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} title="结束日期" />
          <input type="text" placeholder="搜索名称 / 文件名…" value={f.q} onChange={(e) => set('q', e.target.value)} style={{ minWidth: 180 }} />
          <span style={{ marginLeft: 'auto', fontSize: 13 }} className="muted">筛选即时生效</span>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loader"><span className="spin" /> 加载中…</div>
        ) : err ? (
          <div className="empty">⚠️ {err}</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="big">📭</div>
            没有符合条件的活动
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日期</th><th>名称</th><th>类型</th><th>里程</th>
                  <th>时长</th><th>均速</th><th>均心率</th><th>爬升</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => nav('/activities/' + a.id)}>
                    <td className="muted">{fmtDate(a.start_time)}</td>
                    <td style={{ fontWeight: 600 }}>{a.name || '—'}</td>
                    <td><span className="tag" style={{ background: sportMeta(a.sport).color + '22', color: sportMeta(a.sport).color }}>{sportMeta(a.sport).icon} {sportMeta(a.sport).label}</span></td>
                    <td>{num(a.distance_km)} <span className="muted">km</span></td>
                    <td>{fmtDuration(a.duration_s)}</td>
                    <td>{a.avg_speed != null ? num(a.avg_speed) + ' km/h' : '—'}</td>
                    <td>{a.avg_hr != null ? a.avg_hr + ' bpm' : '—'}</td>
                    <td>{a.elevation_gain != null ? Math.round(a.elevation_gain) + ' m' : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="rowdel" title="删除" onClick={() => remove(a.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
