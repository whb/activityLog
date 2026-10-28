// 纯前端分析计算库 —— 复刻 ActivityLog2 的核心分析功能。
// 所有函数都是纯函数、对缺失数据做防御性处理（数据不足时返回 null / 空数组），
// 调用方据返回值决定是否渲染对应区块。

const round = (v, d = 1) => (v == null || isNaN(v) ? null : +v.toFixed(d));

// =============== 功率分析（Aerolab 风格） ===============
// 输入 records: [{ t, power, speed, distance_m, hr, ... }]（t 为秒，升序）
// 输出 { avg, np, ifac, tss, zones, curve } 或 null（无功率数据）
export function powerAnalysis(records, ftpHint) {
  const p = records.filter((r) => r.power != null && r.power > 0);
  if (p.length < 20) return null;
  const n = p.length;
  const avg = p.reduce((s, r) => s + r.power, 0) / n;
  const dt = n > 1 ? (p[n - 1].t - p[0].t) / (n - 1) : 1;

  // Normalized Power：30s 滚动均值 of power^4 再开 4 次方（用相对基准缩放避免数值溢出）
  const base = avg || 1;
  let acc = 0;
  const winSec = 30;
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    const lo = Math.max(0, i - Math.round(winSec / dt));
    for (let j = lo; j <= i; j++) { s += p[j].power; c++; }
    const wavg = s / c;
    const rel = wavg / base;
    acc += rel * rel * rel * rel;
  }
  const np = base * Math.pow(acc / n, 0.25);

  const ftp = ftpHint && ftpHint > 0 ? ftpHint : avg; // 无 FTP 时用平均功率做代理
  const ifac = np / ftp;
  const hours = (p[n - 1].t - p[0].t) / 3600;
  const tss = ifac * ifac * hours * 100;

  // 分区（按 FTP 百分比，标准 5 区）
  const zones = [
    { name: 'Z1 恢复', lo: 0, hi: 0.55, time: 0 },
    { name: 'Z2 耐力', lo: 0.55, hi: 0.75, time: 0 },
    { name: 'Z3 节奏', lo: 0.75, hi: 0.90, time: 0 },
    { name: 'Z4 阈值', lo: 0.90, hi: 1.05, time: 0 },
    { name: 'Z5 无氧', lo: 1.05, hi: 1e9, time: 0 },
  ];
  for (const r of p) {
    const f = r.power / ftp;
    const z = zones.find((zz) => f >= zz.lo && f < zz.hi) || zones[4];
    z.time += dt;
  }
  const total = zones.reduce((s, z) => s + z.time, 0);
  zones.forEach((z) => (z.pct = total ? (z.time / total) * 100 : 0));

  // 功率曲线：1s / 5s / 1min / 5min / 20min 最佳平均功率
  const curve = [
    ['1s', 1], ['5s', 5], ['1min', 60], ['5min', 300], ['20min', 1200],
  ].map(([label, secs]) => {
    const win = Math.max(1, Math.round(secs / dt));
    let best = 0;
    if (win <= n) {
      let s = 0;
      for (let j = 0; j < win; j++) s += p[j].power;
      best = s / win;
      for (let i = win; i < n; i++) {
        s += p[i].power - p[i - win].power;
        const a = s / win;
        if (a > best) best = a;
      }
    }
    return { label, w: Math.round(best) };
  });

  return {
    avg: Math.round(avg), np: Math.round(np),
    ifac: round(ifac, 2), tss: Math.round(tss),
    zones: zones.map((z) => ({ name: z.name, pct: round(z.pct), time: Math.round(z.time) })),
    curve,
  };
}

// =============== 功率尖峰（Power Spikes Tool） ===============
// 输出：功率超过 1.5×平均 且持续 ≥3s 的尖峰，按峰值取前 N
export function powerSpikes(records, top = 10) {
  const p = records.filter((r) => r.power != null && r.power > 0);
  if (p.length < 20) return [];
  const avg = p.reduce((s, r) => s + r.power, 0) / p.length;
  const thr = avg * 1.5;
  const spikes = [];
  let run = null;
  const flush = () => {
    if (run && run.n >= 3) {
      spikes.push({ start: run.start, dur: run.n, peak: Math.round(run.peak), avg: Math.round(run.sum / run.n) });
    }
    run = null;
  };
  for (const r of p) {
    if (r.power >= thr) {
      if (!run) run = { start: r.t, end: r.t, peak: r.power, sum: r.power, n: 1 };
      else { run.end = r.t; run.peak = Math.max(run.peak, r.power); run.sum += r.power; run.n++; }
    } else flush();
  }
  flush();
  return spikes.sort((a, b) => b.peak - a.peak).slice(0, top);
}

// =============== 爬升分析（Climb Analysis Tool） ===============
// 从海拔+累计距离检测爬升：长度 ≥150m、爬升 ≥10m、长度 ≤20km
export function climbAnalysis(records) {
  const pts = records
    .filter((r) => r.altitude != null && r.distance_m != null)
    .sort((a, b) => a.distance_m - b.distance_m);
  if (pts.length < 10) return [];
  const climbs = [];
  const MIN_GAIN = 10, MIN_LEN = 150, MAX_LEN = 20000;
  let i = 0;
  const n = pts.length;
  while (i < n - 1) {
    if (pts[i + 1].altitude <= pts[i].altitude) { i++; continue; }
    const start = i;
    let maxAlt = pts[i].altitude, maxIdx = i, drops = 0;
    let j = i + 1;
    while (j < n) {
      if (pts[j].altitude > maxAlt) { maxAlt = pts[j].altitude; maxIdx = j; drops = 0; }
      else { drops++; if (drops > 8) { j--; break; } }
      j++;
    }
    const end = j >= n ? n - 1 : j;
    const gain = maxAlt - pts[start].altitude;
    const dist = pts[maxIdx].distance_m - pts[start].distance_m;
    const grades = [];
    for (let k = start; k < maxIdx; k++) {
      const dd = pts[k + 1].distance_m - pts[k].distance_m;
      const da = pts[k + 1].altitude - pts[k].altitude;
      if (dd > 0) grades.push((da / dd) * 100);
    }
    const avgGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
    const maxGrade = grades.length ? Math.max(...grades) : 0;
    const sumGrade = grades.reduce((a, b) => a + (b > 0 ? b : 0), 0);
    if (gain >= MIN_GAIN && dist >= MIN_LEN && dist <= MAX_LEN) {
      climbs.push({
        length: Math.round(dist), gain: Math.round(gain),
        avgGrade: round(avgGrade), maxGrade: round(maxGrade),
        sumGrade: Math.round(sumGrade), alt: Math.round(pts[start].altitude),
      });
    }
    i = Math.max(i + 1, maxIdx);
  }
  return climbs.sort((a, b) => b.gain - a.gain).slice(0, 15);
}

// =============== 散点图 ===============
export function scatter(records, xKey, yKey, max = 500) {
  const pts = records
    .filter((r) => r[xKey] != null && r[yKey] != null && isFinite(r[xKey]) && isFinite(r[yKey]))
    .map((r) => [r[xKey], r[yKey]]);
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  return pts.filter((_, i) => i % step === 0);
}

// =============== 直方图 ===============
export function histogram(values, bins = 22) {
  const vs = values.filter((v) => v != null && isFinite(v));
  if (vs.length < 5) return null;
  const min = Math.min(...vs), max = Math.max(...vs);
  if (min === max) return { bins: [{ x0: round(min), x1: round(max + 1), count: vs.length }], min, max };
  const w = (max - min) / bins;
  const arr = Array.from({ length: bins }, (_, i) => ({ x0: round(min + i * w), x1: round(min + (i + 1) * w), count: 0 }));
  for (const v of vs) {
    const bi = Math.min(bins - 1, Math.floor((v - min) / w));
    arr[bi].count++;
  }
  return { bins: arr, min, max };
}

// =============== 游泳指标 ===============
// 输入 activity 汇总 + records。pace = 秒/100m；SWOLF/划频需划次数据（本数据模型未存），返回 null 时前端隐藏。
export function swimStats(activity, records) {
  const km = activity.distance_km;
  const dur = activity.moving_s || activity.duration_s;
  const pace = km && dur ? round((dur / (km * 1000)) * 100) : null; // 秒/100m
  const strokeRate = records.find((r) => r.stroke_rate != null)?.stroke_rate ?? null;
  const swolf = null; // 需 stroke count，本模型未采集
  return { pace, strokeRate, swolf };
}

// =============== 训练负荷 PMC + 红绿灯 ===============
// 输入：全部活动（含 start_time, moving_s/duration_s, avg_hr, max_hr, distance_km, sport）
// 每日负荷用 Banister TRIMP（心率储备法）；CTL/ATL 用指数加权（42d/7d 半衰期）；TSB=CTL-ATL
export function trainingLoad(activities) {
  const maxHrs = activities.map((a) => a.max_hr).filter((v) => v && v > 0);
  const maxHR = maxHrs.length ? Math.min(210, Math.max(...maxHrs)) : 185;
  const rest = 60;
  const byDay = {};
  for (const a of activities) {
    if (!a.start_time) continue;
    const day = a.start_time.slice(0, 10);
    const durMin = (a.moving_s || a.duration_s || 0) / 60;
    let load;
    if (a.avg_hr && a.avg_hr > rest) {
      const hrp = Math.max(0, Math.min(1.2, (a.avg_hr - rest) / (maxHR - rest)));
      load = durMin * (0.64 + 1.92 * hrp - 0.6192 * hrp * hrp);
      if (a.sport === 'cycling' || a.sport === 'biking') load *= 1.15;
    } else {
      load = durMin * (a.sport === 'cycling' || a.sport === 'biking' ? 1.2 : 1.0);
    }
    byDay[day] = (byDay[day] || 0) + load;
  }
  const days = Object.keys(byDay).sort();
  if (!days.length) return { series: [], status: null, maxHR };

  const start = new Date(days[0] + 'T00:00:00Z');
  const end = new Date(days[days.length - 1] + 'T00:00:00Z');
  const W42 = 1 - Math.exp(-1 / 42);
  const W7 = 1 - Math.exp(-1 / 7);
  const series = [];
  let ctl = 0, atl = 0;
  const d = new Date(start);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    const load = byDay[key] || 0;
    ctl = ctl * (1 - W42) + load * W42;
    atl = atl * (1 - W7) + load * W7;
    series.push({ date: key, load: round(load), ctl: round(ctl), atl: round(atl), tsb: round(ctl - atl) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const last = series[series.length - 1];
  return { series, status: trafficLight(last.tsb, last.ctl, last.atl), maxHR, last };
}

// 红绿灯（Traffic Light）：按 TSB 判定训练状态
export function trafficLight(tsb, ctl, atl) {
  let color, label, desc;
  if (tsb < -65) { color = 'red'; label = '过度疲劳'; desc = '训练负荷过高，身体未恢复，建议减量并安排休息。'; }
  else if (tsb < -25) { color = 'orange'; label = '偏累'; desc = '疲劳偏高，适合轻松恢复性训练。'; }
  else if (tsb < 0) { color = 'amber'; label = '竞技状态'; desc = '处于合理疲劳区，适合保持或适度提升强度。'; }
  else if (tsb < 25) { color = 'green'; label = '恢复良好'; desc = '体能盈余，可安排高强度训练课。'; }
  else { color = 'green'; label = '可全力训练'; desc = '充分恢复，适合大强度课或比赛。'; }
  return { color, label, desc, tsb: Math.round(tsb), ctl: Math.round(ctl), atl: Math.round(atl) };
}

// =============== 日历热力图（贡献图风格） ===============
// 返回 ECharts calendar 可用的数据 + 范围
export function calendarHeatmap(activities) {
  const byDay = {};
  for (const a of activities) {
    if (!a.start_time) continue;
    const d = a.start_time.slice(0, 10);
    byDay[d] = { km: (byDay[d]?.km || 0) + (a.distance_km || 0), c: (byDay[d]?.c || 0) + 1, h: (byDay[d]?.h || 0) + (a.duration_s || 0) / 3600 };
  }
  const data = [];
  let min = null, max = null;
  for (const d in byDay) {
    data.push([d, +byDay[d].km.toFixed(1), byDay[d].c, +byDay[d].h.toFixed(2)]);
  }
  const dates = data.map((x) => x[0]).sort();
  return { data, min: dates[0] || null, max: dates[dates.length - 1] || null };
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const monthKey = (iso) => (iso ? iso.slice(0, 7) : null);
const monthsOf = (acts) => [...new Set(acts.map((a) => monthKey(a.start_time)).filter(Boolean))].sort();

// =============== 趋势：训练量（按月、按运动类型堆叠里程 + 总时长） ===============
export function trainingVolumeTrend(acts) {
  const months = monthsOf(acts);
  const sports = [...new Set(acts.map((a) => a.sport))];
  const grid = {};
  months.forEach((m) => (grid[m] = { hours: 0 }));
  for (const a of acts) {
    const m = monthKey(a.start_time); if (!m) continue;
    grid[m][a.sport] = (grid[m][a.sport] || 0) + (a.distance_km || 0);
    grid[m].hours += (a.duration_s || 0) / 3600;
  }
  return {
    months, sports,
    data: months.map((m) => ({
      month: m, hours: +grid[m].hours.toFixed(1),
      bySport: Object.fromEntries(sports.map((s) => [s, +(grid[m][s] || 0).toFixed(1)])),
    })),
  };
}

// =============== 趋势：区间时间（Time in Zone，按月堆叠 Z1–Z5 时长） ===============
export function timeInZoneTrend(acts) {
  const maxHrs = acts.map((a) => a.max_hr).filter((v) => v > 0);
  const maxHR = maxHrs.length ? Math.min(210, Math.max(...maxHrs)) : 185;
  const rest = 60;
  const zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
  const months = monthsOf(acts);
  const grid = {}; months.forEach((m) => (grid[m] = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }));
  for (const a of acts) {
    const m = monthKey(a.start_time); if (!m || !a.avg_hr) continue;
    const hrp = Math.max(0, Math.min(1.2, (a.avg_hr - rest) / (maxHR - rest)));
    let z; if (hrp < 0.65) z = 'Z1'; else if (hrp < 0.8) z = 'Z2'; else if (hrp < 0.9) z = 'Z3'; else if (hrp < 1.05) z = 'Z4'; else z = 'Z5';
    grid[m][z] += (a.duration_s || 0) / 3600;
  }
  return {
    months, zones,
    data: months.map((m) => ({ month: m, ...Object.fromEntries(zones.map((z) => [z, +grid[m][z].toFixed(2)])) })),
  };
}

// =============== 趋势：有氧效率（每单位心率产出，指数化 mean=100 便于跨运动比较） ===============
export function aerobicEfficiencyTrend(acts) {
  const rows = acts
    .filter((a) => a.avg_hr && a.avg_hr > 0)
    .map((a) => {
      const eff = a.avg_power && a.avg_power > 0 ? a.avg_power / a.avg_hr
        : a.avg_speed ? (a.avg_speed / a.avg_hr) * 100 : null;
      return eff != null ? { date: a.start_time, eff, sport: a.sport } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (rows.length < 2) return null;
  const m = mean(rows.map((r) => r.eff)) || 1;
  return { rows: rows.map((r) => ({ ...r, idx: +( (r.eff / m) * 100 ).toFixed(1) })) };
}

// =============== 趋势：受伤风险（ACWR 急性:慢性负荷比，周粒度） ===============
export function injuryRiskTrend(acts) {
  const byDay = {};
  const maxHrs = acts.map((a) => a.max_hr).filter((v) => v > 0);
  const maxHR = maxHrs.length ? Math.min(210, Math.max(...maxHrs)) : 185;
  const rest = 60;
  for (const a of acts) {
    if (!a.start_time) continue;
    const day = a.start_time.slice(0, 10);
    const durMin = (a.moving_s || a.duration_s || 0) / 60;
    let load;
    if (a.avg_hr && a.avg_hr > rest) {
      const hrp = Math.max(0, Math.min(1.2, (a.avg_hr - rest) / (maxHR - rest)));
      load = durMin * (0.64 + 1.92 * hrp - 0.6192 * hrp * hrp);
      if (a.sport === 'cycling' || a.sport === 'biking') load *= 1.15;
    } else load = durMin * (a.sport === 'cycling' || a.sport === 'biking' ? 1.2 : 1);
    byDay[day] = (byDay[day] || 0) + load;
  }
  const days = Object.keys(byDay).sort();
  if (!days.length) return null;
  const sumWin = (d, off, span) => {
    let s = 0, c = 0;
    for (let i = off; i < off + span; i++) {
      const dk = new Date(d); dk.setUTCDate(dk.getUTCDate() - i);
      const k = dk.toISOString().slice(0, 10);
      if (byDay[k] != null) { s += byDay[k]; c++; }
    }
    return c ? s / c : 0;
  };
  const series = [];
  const d = new Date(days[0] + 'T00:00:00Z');
  const end = new Date(days[days.length - 1] + 'T00:00:00Z');
  while (d <= end) {
    const acute = sumWin(d, 0, 7), chronic = sumWin(d, 7, 28);
    series.push({
      date: d.toISOString().slice(0, 10),
      acute: +acute.toFixed(0), chronic: +chronic.toFixed(0),
      acwr: chronic > 0 ? +(acute / chronic).toFixed(2) : null,
    });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return { series };
}

// =============== 会话进阶：均值最大图（Mean Max / Best Avg） ===============
// 对某指标在固定时长窗口（5s/1m/5m/20m/60m）求最佳平均值
export function meanMaxChart(records, key, durations = [5, 60, 300, 1200, 3600]) {
  const pts = records.filter((r) => r[key] != null && isFinite(r[key])).sort((a, b) => a.t - b.t);
  if (pts.length < 10) return null;
  const n = pts.length;
  const dt = n > 1 ? (pts[n - 1].t - pts[0].t) / (n - 1) : 1;
  const out = [];
  for (const secs of durations) {
    const win = Math.max(1, Math.round(secs / dt));
    if (win > n) { out.push({ secs, best: null }); continue; }
    let s = 0; for (let j = 0; j < win; j++) s += pts[j][key];
    let best = s / win;
    for (let i = win; i < n; i++) { s += pts[i][key] - pts[i - win][key]; const v = s / win; if (v > best) best = v; }
    out.push({ secs, best: +(best.toFixed(2)) });
  }
  return out;
}

// =============== 会话进阶：象限图（两指标散点 + 均值参考线四象限） ===============
export function quadrantData(records, xKey, yKey, max = 600) {
  const pts = records
    .filter((r) => r[xKey] != null && r[yKey] != null && isFinite(r[xKey]) && isFinite(r[yKey]))
    .map((r) => [r[xKey], r[yKey]]);
  if (pts.length < 10) return null;
  const step = Math.ceil(pts.length / max);
  const data = pts.filter((_, i) => i % step === 0);
  return { data, mx: +(mean(data.map((p) => p[0])).toFixed(1)), my: +(mean(data.map((p) => p[1])).toFixed(1)) };
}

// =============== 会话进阶：有氧解耦（Aerobic Decoupling） ===============
// 后半程 HR 相对前半程的变化 − 功率变化；>5% 视为明显解耦（心率漂移）
export function aerobicDecoupling(records) {
  const p = records.filter((r) => r.power != null && r.hr != null && r.power > 0).sort((a, b) => a.t - b.t);
  if (p.length < 40) return null;
  const mid = Math.floor(p.length / 2);
  const a1 = p.slice(0, mid), a2 = p.slice(mid);
  const hr1 = mean(a1.map((r) => r.hr)), hr2 = mean(a2.map((r) => r.hr));
  const pw1 = mean(a1.map((r) => r.power)), pw2 = mean(a2.map((r) => r.power));
  const hrDelta = ((hr2 - hr1) / hr1) * 100;
  const pwDelta = ((pw2 - pw1) / pw1) * 100;
  const decoupling = hrDelta - pwDelta;
  return {
    decoupling: +decoupling.toFixed(1),
    hrDelta: +hrDelta.toFixed(1), pwDelta: +pwDelta.toFixed(1),
    hr1: Math.round(hr1), hr2: Math.round(hr2),
    verdict: decoupling <= 5 ? 'good' : decoupling <= 10 ? 'warn' : 'bad',
  };
}

// =============== 会话进阶：间隔检测（Interval Detection） ===============
// 找出显著高于均值（>mean+std）的连续努力段，视为一次间隔
export function intervalDetection(records, key = 'power') {
  const pts = records.filter((r) => r[key] != null && isFinite(r[key])).sort((a, b) => a.t - b.t);
  if (pts.length < 30) return [];
  const vals = pts.map((r) => r[key]);
  const m = mean(vals);
  const std = Math.sqrt(mean(vals.map((v) => (v - m) ** 2)));
  const thr = m + std;
  const ivals = [];
  let run = null;
  const flush = () => {
    if (run && run.n >= 5) ivals.push({ start: run.start, end: run.end, avg: Math.round(run.sum / run.n), peak: Math.round(run.peak), n: run.n });
    run = null;
  };
  for (const r of pts) {
    if (r[key] >= thr) {
      if (!run) run = { start: r.t, end: r.t, sum: r[key], peak: r[key], n: 1 };
      else { run.end = r.t; run.sum += r[key]; run.peak = Math.max(run.peak, r[key]); run.n++; }
    } else flush();
  }
  flush();
  return ivals.slice(0, 40);
}

// =============== 星期 × 时段 热力图 ===============
export function weekdayHourHeatmap(activities) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const a of activities) {
    if (!a.start_time) continue;
    const d = new Date(a.start_time);
    const wd = d.getUTCDay(); // 0=周日
    const hr = d.getUTCHours();
    const v = (a.duration_s || a.moving_s || 0) / 3600;
    grid[wd][hr] += v;
    if (v > max) max = v;
  }
  const data = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 24; x++) {
      if (grid[y][x] > 0) data.push([x, y, +grid[y][x].toFixed(2)]);
    }
  }
  return { data, max: max || 1 };
}
