// 无头浏览器 + CDP：对全部页面做真实渲染校验（文本 + 控制台错误 + 导出交互）。
// 自动探测系统里的 Edge / Chrome，跨平台可用。用法：node scripts/verify-pages.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function findBrowser() {
  const win = [
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const unix = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const cands = os.platform() === 'win32' ? win : unix;
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge，无法运行真实渲染校验');
}
const BROWSER = findBrowser();
const PORT = 9333;

const CASES = [
  ['/trends', '趋势分析', ['区间时间', '受伤风险', '有氧效率']],
  ['/reports', '报表', ['月度明细', '底层 SQL']],
  ['/calendar', '日历', ['本月']],
  ['/athlete', '运动员指标', ['新增指标']],
  ['/workouts', '训练计划', ['新建训练']],
  ['/activities/28', '均值最大图', ['象限图', '间隔检测']], // 骑行活动，验证 Phase2 进阶分析
];

function connectWS(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error('ws error ' + (e.message || '')));
  });
}

async function http(path) {
  const r = await fetch('http://127.0.0.1:' + PORT + path);
  return r.json();
}

let idc = 0;
async function main() {
  const udd = path.join(os.tmpdir(), 'al2-verify');
  const chrome = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=1400,900', '--user-data-dir=' + udd, 'about:blank',
  ], { stdio: 'ignore' });

  let ws, target;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const list = await http('/json');
      target = list.find((t) => t.type === 'page');
      if (target) { ws = await connectWS(target.webSocketDebuggerUrl); break; }
    } catch { /* not ready */ }
  }
  if (!ws) throw new Error('Edge CDP not reachable');

  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + (m.params.args[0]?.value || '').slice(0, 200));
  });

  let pass = true;
  for (const [path, marker, extras] of CASES) {
    await send('Page.navigate', { url: 'http://localhost:3001' + path });
    await sleep(1400);
    const r = await send('Runtime.evaluate', { expression: `document.body ? document.body.innerText : ''`, returnByValue: true });
    const text = (r.result && r.result.result && r.result.result.value) || '';
    const has = (s) => text.includes(s);
    const ok = has(marker);
    const miss = extras.filter((e) => !has(e));
    if (!ok) pass = false;
    console.log(`${ok ? '✅' : '❌'} ${path}  marker="${marker}" ${ok ? 'found' : 'MISSING'}${miss.length ? '  缺少:' + miss.join('/') : ''}  (len=${text.length})`);
  }

  // 交互测试：活动详情页点击导出按钮，确认不抛异常（blob/anchor 在无头环境可执行）
  await send('Page.navigate', { url: 'http://localhost:3001/activities/28' });
  await sleep(1500);
  const before = errors.length;
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = [...document.querySelectorAll('button')];
      const by = (t) => btns.find((b) => b.textContent.includes(t));
      const out = {};
      for (const t of ['记录 CSV', '圈速 CSV', '导出图片']) {
        const b = by(t); if (!b) { out[t] = 'NO-BTN'; continue; }
        try { b.click(); out[t] = 'clicked'; } catch (e) { out[t] = 'ERR:' + e.message; }
      }
      return JSON.stringify(out);
    })()`, returnByValue: true,
  });
  const clicks = (clickRes.result && clickRes.result.result && clickRes.result.result.value) || '{}';
  console.log('\n===== 导出按钮交互（/activities/28） =====');
  console.log('  ' + clicks);
  await sleep(400);
  const newErrs = errors.slice(before);
  if (newErrs.length) { pass = false; newErrs.forEach((e) => console.log('  ' + e)); } else console.log('  点击无运行时错误');

  console.log('\n===== 控制台/运行时错误 =====');
  if (errors.length) { errors.forEach((e) => console.log('  ' + e)); }
  else console.log('  无');

  console.log(pass ? '\nRESULT: ALL PASS' : '\nRESULT: FAIL');
  ws.close(); chrome.kill();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('VERIFY FAIL:', e); process.exit(1); });
