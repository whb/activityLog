// 内置演示数据：当前端无法连到后端（如纯静态预览 / 离线）时作为回退，保证界面可展示。
// 结构与后端 API 保持一致。
function recs(n, kind) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const base = { t: Math.round(p * (kind === 'ride' ? 7920 : kind === 'swim' ? 1860 : 3120)), hr: 0, cadence: null, power: null };
    if (kind === 'swim') {
      base.lat = 39.91; base.lon = 116.4; base.altitude = 0; base.speed = 3.9; base.hr = 118 + Math.round(20 * Math.sin(p * Math.PI * 4)); base.temperature = 27;
    } else {
      const cx = kind === 'ride' ? 39.95 : 39.9087;
      const cy = kind === 'ride' ? 116.5 : 116.3975;
      const r = kind === 'ride' ? 0.05 : 0.012;
      base.lat = +(cx + r * Math.sin(p * Math.PI * (kind === 'ride' ? 2 : 6)) + (kind === 'ride' ? 0.06 * p : 0)).toFixed(5);
      base.lon = +(cy + r * 1.25 * Math.cos(p * Math.PI * (kind === 'ride' ? 2 : 6)) + (kind === 'ride' ? 0.1 * p : 0)).toFixed(5);
      base.altitude = +(kind === 'ride' ? 120 + 480 * (0.5 - 0.5 * Math.cos(p * Math.PI * 3)) : 45 + 22 * Math.sin(p * Math.PI * 3)).toFixed(1);
      base.speed = +(kind === 'ride' ? 18 + 14 * Math.sin(p * Math.PI * 5) : 9.5 + 4 * Math.sin(p * Math.PI * 4)).toFixed(1);
      base.hr = Math.round((kind === 'ride' ? 135 : 145) + 28 * Math.sin(p * Math.PI * 2.5));
      base.cadence = Math.round(kind === 'ride' ? 90 : 170);
      base.power = kind === 'ride' ? Math.round(190 + 110 * Math.sin(p * Math.PI * 5)) : null;
      base.temperature = +(kind === 'ride' ? 15 : 14).toFixed(1);
    }
    base.distance_m = Math.round(p * (kind === 'ride' ? 62500 : kind === 'swim' ? 2000 : 10200));
    out.push(base);
  }
  return out;
}

export const activities = [
  { id: 1, name: 'Morning Trail Run', sport: 'running', sport_subtype: 'trail', start_time: '2026-03-08T07:15:00.000Z', distance_km: 10.2, duration_s: 3120, moving_s: 3073, avg_speed: 11.8, max_speed: 15.2, avg_hr: 150, max_hr: 172, avg_power: null, max_power: null, elevation_gain: 87, elevation_loss: 82, min_altitude: 43, max_altitude: 68, avg_temp: 14, max_temp: 18, avg_cadence: 170, device: 'Garmin Forerunner 265', source_file: 'demo_morning_trail_run.fit' },
  { id: 2, name: 'Weekend Mountain Ride', sport: 'cycling', sport_subtype: 'road', start_time: '2026-03-15T06:30:00.000Z', distance_km: 62.5, duration_s: 7920, moving_s: 7840, avg_speed: 28.4, max_speed: 46.1, avg_hr: 139, max_hr: 167, avg_power: 204, max_power: 341, elevation_gain: 487, elevation_loss: 489, min_altitude: 120, max_altitude: 600, avg_temp: 15, max_temp: 21, avg_cadence: 90, device: 'Garmin Edge 1040', source_file: 'demo_weekend_mountain_ride.fit' },
  { id: 3, name: 'Pool Interval Set', sport: 'swimming', sport_subtype: 'swim', start_time: '2026-03-20T09:00:00.000Z', distance_km: 2, duration_s: 1860, moving_s: 1711, avg_speed: 3.9, max_speed: null, avg_hr: 118, max_hr: 142, avg_power: null, max_power: null, elevation_gain: 0, elevation_loss: 0, min_altitude: 0, max_altitude: 0, avg_temp: 27, max_temp: 27.5, avg_cadence: null, device: 'Garmin Forerunner 265', source_file: 'demo_pool_interval_set.fit' },
  { id: 4, name: 'Long Run', sport: 'running', sport_subtype: 'trail', start_time: '2026-04-05T07:00:00.000Z', distance_km: 18.4, duration_s: 5880, moving_s: 5792, avg_speed: 11.3, max_speed: 14.8, avg_hr: 149, max_hr: 170, avg_power: null, max_power: null, elevation_gain: 85, elevation_loss: 84, min_altitude: 44, max_altitude: 67, avg_temp: 13, max_temp: 17, avg_cadence: 168, device: 'Garmin Forerunner 265', source_file: 'demo_long_run.fit' },
  { id: 5, name: 'Evening Road Ride', sport: 'cycling', sport_subtype: 'road', start_time: '2026-04-12T17:20:00.000Z', distance_km: 38, duration_s: 5280, moving_s: 5227, avg_speed: 25.9, max_speed: 42.3, avg_hr: 138, max_hr: 161, avg_power: 204, max_power: 322, elevation_gain: 487, elevation_loss: 486, min_altitude: 120, max_altitude: 600, avg_temp: 16, max_temp: 22, avg_cadence: 91, device: 'Garmin Edge 1040', source_file: 'demo_evening_road_ride.fit' },
];

export const sports = ['running', 'cycling', 'swimming'];

export function detail(id) {
  const a = activities.find((x) => x.id === Number(id)) || activities[0];
  const kind = a.sport === 'cycling' ? 'ride' : a.sport === 'swimming' ? 'swim' : 'run';
  const n = kind === 'ride' ? 240 : 120;
  return { activity: a, records: recs(n, kind) };
}

function agg() {
  const totals = {};
  const monthly = {};
  let count = 0, distance = 0, hours = 0, first = null, last = null;
  for (const a of activities) {
    count++; distance += a.distance_km || 0; const h = (a.duration_s || 0) / 3600; hours += h;
    if (!first || a.start_time < first) first = a.start_time;
    if (!last || a.start_time > last) last = a.start_time;
    const t = totals[a.sport] || (totals[a.sport] = { sport: a.sport, count: 0, distance_km: 0, hours: 0 });
    t.count++; t.distance_km += a.distance_km || 0; t.hours += h;
    const m = a.start_time.slice(0, 7);
    const mk = m + '|' + a.sport;
    const mo = monthly[mk] || (monthly[mk] = { month: m, sport: a.sport, distance_km: 0, hours: 0, count: 0 });
    mo.distance_km += a.distance_km || 0; mo.hours += h; mo.count++;
  }
  return {
    totals: Object.values(totals).map((x) => ({ ...x, distance_km: +x.distance_km.toFixed(1), hours: +x.hours.toFixed(1) })),
    monthly: Object.values(monthly).map((x) => ({ ...x, distance_km: +x.distance_km.toFixed(1), hours: +x.hours.toFixed(1) })),
    grand: { count, distance_km: +distance.toFixed(1), hours: +hours.toFixed(1), first, last },
  };
}

export const reports = agg();

export const equipment = [
  { id: 1, serial_number: 'FR265-8842', product_name: 'Forerunner 265', manufacturer: 'Garmin', first_seen: '2026-03-08T07:15:00.000Z', last_seen: '2026-04-05T07:00:00.000Z', usage_hours: 3.02, activity_count: 3 },
  { id: 2, serial_number: 'EDGE-1040-2231', product_name: 'Edge 1040', manufacturer: 'Garmin', first_seen: '2026-03-15T06:30:00.000Z', last_seen: '2026-04-12T17:20:00.000Z', usage_hours: 3.67, activity_count: 2 },
];

export function filteredActivities(f = {}) {
  let r = activities.filter((a) => !_removed.has(a.id));
  if (f.sport && f.sport !== 'all') r = r.filter((a) => a.sport === f.sport);
  if (f.from) r = r.filter((a) => a.start_time && a.start_time >= f.from);
  if (f.to) r = r.filter((a) => a.start_time && a.start_time <= f.to + 'T23:59:59.999Z');
  if (f.q) { const q = f.q.toLowerCase(); r = r.filter((a) => (a.name || '').toLowerCase().includes(q) || (a.source_file || '').toLowerCase().includes(q)); }
  return r.sort((a, b) => (b.start_time || '').localeCompare(a.start_time || ''));
}

let _removed = new Set();
export function removeActivity(id) { _removed.add(Number(id)); return { ok: true }; }
export function allRemoved() { return [..._removed]; }
