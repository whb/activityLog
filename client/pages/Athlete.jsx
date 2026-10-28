import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import Chart from '../components/Chart.jsx';
import { fmtDate, num } from '../lib/format.js';

const EMPTY = { recorded_at: '', weight_kg: '', resting_hr: '', max_hr: '', lthr: '', ftp: '', notes: '' };
const SERIES = [
  { key: 'weight_kg', name: '体重 (kg)', color: '#4f46e5' },
  { key: 'resting_hr', name: '静息心率 (bpm)', color: '#ef4444' },
  { key: 'lthr', name: 'LTHR (bpm)', color: '#f59e0b' },
  { key: 'ftp', name: 'FTP (W)', color: '#7c3aed' },
];

export default function Athlete() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = () => api.athleteMetrics().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    if (!f.recorded_at) { setErr('请选择日期'); return; }
    try {
      setErr(''); setOkMsg('');
      await api.addAthleteMetric({
        recorded_at: f.recorded_at,
        weight_kg: f.weight_kg === '' ? null : +f.weight_kg,
        resting_hr: f.resting_hr === '' ? null : +f.resting_hr,
        max_hr: f.max_hr === '' ? null : +f.max_hr,
        lthr: f.lthr === '' ? null : +f.lthr,
        ftp: f.ftp === '' ? null : +f.ftp,
        notes: f.notes,
      });
      setF(EMPTY); setOkMsg('已保存 ✓'); await load();
    } catch (e) { setErr(e.message); }
  }
  async function del(id) {
    if (!confirm('删除这条指标记录？')) return;
    await api.removeAthleteMetric(id); load();
  }

  const chart = useMemo(() => {
    if (!rows || rows.length < 1) return null;
    const present = SERIES.filter((s) => rows.some((r) => r[s.key] != null));
    if (!present.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#6b7688' } },
      grid: { left: 48, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: rows.map((r) => r.recorded_at.slice(5)), axisLabel: { color: '#6b7688' } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: '#6b7688' }, splitLine: { lineStyle: { color: '#eef1f7' } } },
      series: present.map((s) => ({
        name: s.name, type: 'line', smooth: true, symbolSize: 6,
        lineStyle: { width: 2, color: s.color }, itemStyle: { color: s.color },
        data: rows.map((r) => (r[s.key] != null ? r[s.key] : null)), connectNulls: true,
      })),
    };
  }, [rows]);

  if (err) return <div className="empty">⚠️ {err}</div>;
  if (!rows) return <div className="loader"><span className="spin" /> 加载中…</div>;

  return (
    <div>
      <div className="topbar">
        <div><h1>运动员指标</h1><div className="crumb">体重 / 心率阈值 / FTP 等随时间记录（复刻 ActivityLog2 · Athlete）</div></div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <h3 className="section-title">新增指标</h3>
        <div className="filters" style={{ alignItems: 'flex-end' }}>
          <label className="fld"><span>日期</span><input type="date" value={f.recorded_at} onChange={(e) => set('recorded_at', e.target.value)} /></label>
          <label className="fld"><span>体重 kg</span><input type="number" step="0.1" value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></label>
          <label className="fld"><span>静息HR</span><input type="number" value={f.resting_hr} onChange={(e) => set('resting_hr', e.target.value)} /></label>
          <label className="fld"><span>最大HR</span><input type="number" value={f.max_hr} onChange={(e) => set('max_hr', e.target.value)} /></label>
          <label className="fld"><span>LTHR</span><input type="number" value={f.lthr} onChange={(e) => set('lthr', e.target.value)} /></label>
          <label className="fld"><span>FTP W</span><input type="number" value={f.ftp} onChange={(e) => set('ftp', e.target.value)} /></label>
          <label className="fld" style={{ flex: 1 }}><span>备注</span><input type="text" style={{ width: '100%' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <button className="btn btn-primary" onClick={save}>保存</button>
        </div>
        {okMsg && <div className="ok-msg" style={{ marginTop: 10 }}>{okMsg}</div>}
      </div>

      {chart && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 className="section-title">指标趋势</h3>
          <Chart option={chart} height={320} />
        </div>
      )}

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty"><div className="big">📭</div>还没有指标记录，从上方表单添加。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>体重</th><th>静息HR</th><th>最大HR</th><th>LTHR</th><th>FTP</th><th>备注</th><th></th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{fmtDate(r.recorded_at)}</td>
                    <td>{r.weight_kg != null ? num(r.weight_kg) : '—'}</td>
                    <td>{r.resting_hr ?? '—'}</td><td>{r.max_hr ?? '—'}</td>
                    <td>{r.lthr ?? '—'}</td><td>{r.ftp ?? '—'}</td>
                    <td className="muted">{r.notes || '—'}</td>
                    <td><button className="rowdel" onClick={() => del(r.id)}>🗑</button></td>
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
