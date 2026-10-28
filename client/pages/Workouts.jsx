import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { sportMeta, fmtDate } from '../lib/format.js';

const STEP_TYPES = [
  { v: 'warmup', label: '热身' },
  { v: 'interval', label: '间隔' },
  { v: 'rest', label: '恢复' },
  { v: 'cooldown', label: '冷却' },
];
const NEW_STEP = { type: 'interval', duration_s: 300, target_type: 'power', target: '' };

export default function Workouts() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: '', sport: 'cycling', description: '' });
  const [steps, setSteps] = useState([NEW_STEP]);
  const [err, setErr] = useState('');

  const load = () => api.workouts().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setStep = (i, k, v) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addStep = () => setSteps((s) => [...s, { ...NEW_STEP }]);
  const delStep = (i) => setSteps((s) => s.filter((_, j) => j !== i));

  async function save() {
    if (!f.name) { setErr('请填写训练名称'); return; }
    try {
      setErr('');
      await api.addWorkout({ ...f, steps: steps.map((s) => ({ ...s, target: s.target === '' ? null : +s.target })) });
      setF({ name: '', sport: 'cycling', description: '' }); setSteps([NEW_STEP]); await load();
    } catch (e) { setErr(e.message); }
  }
  async function del(id) { if (!confirm('删除该训练计划？')) return; await api.removeWorkout(id); load(); }

  const totalDur = (list) => (list || []).reduce((s, x) => s + (+x.duration_s || 0), 0);
  const fmtDur = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h${m}m` : m ? `${m}m` : `${s}s`; };

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!rows) return <div className="loader"><span className="spin" /> 加载中…</div>;

  return (
    <div>
      <div className="topbar">
        <div><h1>训练计划</h1><div className="crumb">创建 / 管理训练结构（复刻 ActivityLog2 · Workout Editor 的 Web 简化版）</div></div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <h3 className="section-title">新建训练</h3>
        <div className="filters" style={{ alignItems: 'flex-end' }}>
          <label className="fld"><span>名称</span><input type="text" style={{ width: 180 }} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="fld"><span>运动</span>
            <select value={f.sport} onChange={(e) => set('sport', e.target.value)}>
              <option value="cycling">骑行</option><option value="running">跑步</option><option value="swimming">游泳</option><option value="fitness">健身</option>
            </select>
          </label>
          <label className="fld" style={{ flex: 1 }}><span>描述</span><input type="text" style={{ width: '100%' }} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
        </div>

        <div className="wk-steps">
          <div className="wk-step-head">
            <span>类型</span><span>时长(s)</span><span>目标类型</span><span>目标值</span><span></span>
          </div>
          {steps.map((s, i) => (
            <div className="wk-step" key={i}>
              <select value={s.type} onChange={(e) => setStep(i, 'type', e.target.value)}>
                {STEP_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <input type="number" value={s.duration_s} onChange={(e) => setStep(i, 'duration_s', e.target.value)} />
              <select value={s.target_type} onChange={(e) => setStep(i, 'target_type', e.target.value)}>
                <option value="power">功率(W)</option><option value="hr">心率(bpm)</option><option value="speed">速度(km/h)</option><option value="pace">配速</option><option value="none">—</option>
              </select>
              <input type="number" placeholder="目标" value={s.target} onChange={(e) => setStep(i, 'target', e.target.value)} />
              <button className="rowdel" onClick={() => delStep(i)}>🗑</button>
            </div>
          ))}
          <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={addStep}>＋ 加一段</button>
            <button className="btn btn-primary" onClick={save}>保存训练</button>
            <span className="muted" style={{ alignSelf: 'center' }}>总时长 {fmtDur(totalDur(steps))}</span>
          </div>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty"><div className="big">📝</div>还没有训练计划，从上方创建。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>名称</th><th>运动</th><th>段落</th><th>总时长</th><th>描述</th><th>创建</th><th></th></tr></thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td><span className="tag" style={{ background: sportMeta(w.sport).color + '22', color: sportMeta(w.sport).color }}>{sportMeta(w.sport).icon} {sportMeta(w.sport).label}</span></td>
                    <td>{(w.steps || []).length} 段</td>
                    <td>{fmtDur(totalDur(w.steps))}</td>
                    <td className="muted">{w.description || '—'}</td>
                    <td className="muted">{fmtDate(w.created_at)}</td>
                    <td><button className="rowdel" onClick={() => del(w.id)}>🗑</button></td>
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
