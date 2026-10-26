import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Import() {
  const nav = useNavigate();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]); // {name, status, msg, id}
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => /\.(fit|fts)$/i.test(f.name) || f.size > 0);
    if (!files.length) return;
    setBusy(true);
    for (const file of files) {
      setItems((prev) => [{ name: file.name, status: 'pending', msg: '等待中…' }, ...prev]);
      try {
        const res = await api.importFit(file);
        setItems((prev) => prev.map((it) => it.name === file.name
          ? { ...it, status: 'ok', msg: `已导入 ${res.count} 个记录点`, id: res.id }
          : it));
      } catch (e) {
        setItems((prev) => prev.map((it) => it.name === file.name
          ? { ...it, status: 'err', msg: e.message }
          : it));
      }
    }
    setBusy(false);
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>导入 FIT 文件</h1>
          <div className="crumb">支持 Garmin / Polar / Suunto 等设备的 .fit 训练文件，可一次导入多个</div>
        </div>
      </div>

      <div
        className={'card pad drop' + (drag ? ' drag' : '')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="big">📥</div>
        <div className="t">点击选择，或将 .fit 文件拖到这里</div>
        <div className="s">支持批量导入 · 单个文件上限 50MB · 数据保存在本地 SQLite 数据库</div>
        <input ref={inputRef} type="file" accept=".fit,.fts" multiple hidden
          onChange={(e) => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {items.length > 0 && (
        <div className="upload-list">
          {items.map((it, i) => (
            <div className="up-item" key={i}>
              <span>
                <span className={'badge-dot'} style={{ background: it.status === 'ok' ? '#16a34a' : it.status === 'err' ? '#ef4444' : '#f59e0b' }} />
                {it.name}
              </span>
              <span className={it.status === 'ok' ? 'ok' : it.status === 'err' ? 'err' : 'muted'}>
                {it.status === 'ok' ? `✓ ${it.msg}` : it.status === 'err' ? `✗ ${it.msg}` : <span className="spin" style={{ verticalAlign: '-3px' }} />}
                {it.status === 'ok' && it.id ? (
                  <button className="btn btn-ghost" style={{ marginLeft: 12, padding: '5px 12px', fontSize: 13 }}
                    onClick={() => nav('/activities/' + it.id)}>查看</button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}

      {busy && <div className="loader"><span className="spin" /> 正在解析并导入…</div>}

      <div className="card pad" style={{ marginTop: 18 }}>
        <h3 className="section-title">说明</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, color: '#4b5563', fontSize: 14 }}>
          <li>导入后数据自动存入本地 <code>data/activitylog.db</code>（SQLite）。</li>
          <li>支持跑步、骑行、游泳、步行、徒步、力量、瑜伽等所有 FIT 运动类型。</li>
          <li>解析出的轨迹、心率、功率、踏频、海拔、温度等将用于详情图表与地图展示。</li>
          <li>文件中的设备信息会自动进入「装备」页并累计使用时长。</li>
        </ul>
      </div>
    </div>
  );
}
