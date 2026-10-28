// 导出工具：CSV / 文本 / ECharts 图片 PNG
function trigger(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function safeName(name) {
  return String(name || 'export').replace(/[\\/:*?"<>|\s]+/g, '_');
}

// rows: Array<Object>，取首行 keys 作为表头
export function downloadCSV(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) { alert('没有可导出的数据'); return; }
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','));
  // \uFEFF BOM 让 Excel 正确识别 UTF-8 中文
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  trigger(url, safeName(filename) + '.csv');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  trigger(url, safeName(filename));
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ECharts 实例 → PNG。pixelRatio 提升清晰度，白底。
export function chartPNG(chart, filename, { pixelRatio = 2, backgroundColor = '#ffffff' } = {}) {
  if (!chart || typeof chart.getDataURL !== 'function') { alert('图表尚未就绪'); return; }
  const url = chart.getDataURL({ pixelRatio, backgroundColor });
  trigger(url, safeName(filename) + '.png');
}
