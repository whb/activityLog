import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { sportMeta, fmtDuration, num } from '../lib/format.js';

const WD = ['一', '二', '三', '四', '五', '六', '日'];

function ym(d) { return d.toISOString().slice(0, 7); }
function dayKey(d) { return d.toISOString().slice(0, 10); }

export default function Calendar() {
  const nav = useNavigate();
  const [acts, setActs] = useState(null);
  const [cur, setCur] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.activities().then(setActs).catch((e) => setErr(e.message)); }, []);

  const byDay = useMemo(() => {
    const m = {};
    for (const a of acts || []) {
      const k = a.start_time && a.start_time.slice(0, 10);
      if (!k) continue;
      (m[k] = m[k] || []).push(a);
    }
    return m;
  }, [acts]);

  const cells = useMemo(() => {
    const first = new Date(cur);
    const startDow = (first.getDay() + 6) % 7; // 周一=0
    const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cur.getFullYear(), cur.getMonth(), d));
    return arr;
  }, [cur]);

  const monthActs = (acts || []).filter((a) => a.start_time && ym(new Date(a.start_time)) === ym(cur));
  const monthKm = monthActs.reduce((s, a) => s + (a.distance_km || 0), 0);
  const monthH = monthActs.reduce((s, a) => s + (a.duration_s || 0), 0) / 3600;

  const selList = sel ? (byDay[sel] || []) : [];

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!acts) return <div className="loader"><span className="spin" /> 加载中…</div>;

  return (
    <div>
      <div className="topbar">
        <div><h1>日历</h1><div className="crumb">按日查看训练分布（复刻 ActivityLog2 · Calendar）</div></div>
        <div className="filters">
          <button className="btn btn-ghost" onClick={() => setCur((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>← 上月</button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{cur.getFullYear()} 年 {cur.getMonth() + 1} 月</span>
          <button className="btn btn-ghost" onClick={() => setCur((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>下月 →</button>
        </div>
      </div>

      <div className="grid charts-2" style={{ marginBottom: 16 }}>
        <div className="card pad">
          <div className="cal-head">
            {WD.map((w) => <div key={w} className="cal-wd">周{w}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={'b' + i} className="cal-cell empty" />;
              const k = dayKey(d);
              const list = byDay[k] || [];
              const isSel = sel === k;
              return (
                <div key={k} className={'cal-cell' + (list.length ? ' has' : '') + (isSel ? ' sel' : '')} onClick={() => setSel(k)}>
                  <div className="cal-d">{d.getDate()}</div>
                  {list.length > 0 && <div className="cal-badge">{list.length}</div>}
                  <div className="cal-dots">{list.slice(0, 4).map((a, j) => <span key={j} style={{ background: sportMeta(a.sport).color }} title={a.name} />)}</div>
                </div>
              );
            })}
          </div>
          <div className="cal-summary">本月：{monthActs.length} 次 · {num(monthKm)} km · {num(monthH, 1)} h</div>
        </div>

        <div className="card pad">
          <h3 className="section-title">{sel ? sel + ' 的活动' : '选择日期查看活动'}</h3>
          {!sel ? <div className="empty">点击左侧日历中的某天</div> : selList.length === 0 ? <div className="empty">当天没有训练</div> : (
            <div className="cal-list">
              {selList.map((a) => (
                <div key={a.id} className="cal-item" onClick={() => nav('/activities/' + a.id)}>
                  <span className="tag" style={{ background: sportMeta(a.sport).color + '22', color: sportMeta(a.sport).color }}>{sportMeta(a.sport).icon} {sportMeta(a.sport).label}</span>
                  <div className="cal-item-name">{a.name || '—'}</div>
                  <div className="cal-item-meta muted">{num(a.distance_km)} km · {fmtDuration(a.duration_s)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
