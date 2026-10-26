'use strict';
// Seeds a few realistic demo activities so the UI has data to display on first run.
// Run: npm run seed
const db = require('./db');

const rand = (a, b) => a + Math.random() * (b - a);
const r1 = (x) => (x === null || x === undefined ? null : +x.toFixed(1));
const r2 = (x) => (x === null || x === undefined ? null : +x.toFixed(2));

function insertActivity(a, records) {
  const when = a.start_time;
  const info = db.prepare(`
    INSERT INTO activities (name, sport, sport_subtype, start_time, distance_km, duration_s, moving_s,
      avg_speed, max_speed, avg_hr, max_hr, avg_power, max_power, elevation_gain, elevation_loss,
      min_altitude, max_altitude, avg_temp, max_temp, avg_cadence, device, source_file, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    a.name, a.sport, a.subtype, a.start_time, a.distance_km, a.duration_s, a.moving_s,
    a.avg_speed, a.max_speed, a.avg_hr, a.max_hr, a.avg_power, a.max_power,
    a.elev_gain, a.elev_loss, a.min_alt, a.max_alt, a.avg_temp, a.max_temp,
    a.avg_cadence, a.device, a.source, new Date().toISOString()
  );
  const id = Number(info.lastInsertRowid);
  const ins = db.prepare(
    'INSERT INTO records (activity_id, t, lat, lon, altitude, speed, distance_m, hr, cadence, power, temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const r of records) ins.run(id, r.t, r.lat, r.lon, r.altitude, r.speed, r.distance_m, r.hr, r.cadence, r.power, r.temperature);
  return id;
}

function insertEquipment(serial, product, manufacturer, when, hours) {
  let row = db.prepare('SELECT id FROM equipment WHERE serial_number = ?').get(serial);
  if (row) {
    db.prepare('UPDATE equipment SET usage_hours=usage_hours+?, last_seen=MAX(last_seen,?), first_seen=MIN(first_seen,?) WHERE id=?')
      .run(hours, when, when, row.id);
    return row.id;
  }
  const r = db.prepare('INSERT INTO equipment (serial_number, product_name, manufacturer, first_seen, last_seen, usage_hours) VALUES (?,?,?,?,?,?)')
    .run(serial, product, manufacturer, when, when, hours);
  return Number(r.lastInsertRowid);
}

function link(actId, eqId) { db.prepare('INSERT OR IGNORE INTO activity_equipment (activity_id, equipment_id) VALUES (?,?)').run(actId, eqId); }

function makeRun(name, start, distKm, minutes, cx, cy) {
  const dur = minutes * 60;
  const N = 120;
  const recs = [];
  const totalDistM = distKm * 1000;
  const radius = 0.012;
  let alts = [];
  for (let i = 0; i <= N; i++) {
    const t = Math.round((i / N) * dur);
    const ang = (i / N) * Math.PI * 6; // ~3 laps
    const lat = cx + radius * Math.sin(ang);
    const lon = cy + radius * Math.cos(ang) * 1.25;
    const altitude = 45 + 22 * Math.sin(ang * 1.7) + rand(-1.5, 1.5);
    const speed = r2(rand(9.5, 13.5));
    const hr = Math.round(145 + 22 * Math.sin((i / N) * Math.PI * 3) + rand(-3, 3));
    alts.push(altitude);
    recs.push({ t, lat: r2(lat * 1e4) / 1e4, lon: r2(lon * 1e4) / 1e4, altitude: r1(altitude), speed, distance_m: Math.round((i / N) * totalDistM), hr, cadence: Math.round(168 + rand(-6, 6)), power: null, temperature: r1(rand(11, 18)) });
  }
  const avgSpeed = r2((distKm / (minutes / 60)));
  return {
    summary: {
      name, sport: 'running', subtype: 'trail', start_time: start,
      distance_km: r2(distKm), duration_s: dur, moving_s: Math.round(dur * 0.985),
      avg_speed: avgSpeed, max_speed: r2(Math.max(...recs.map((x) => x.speed))),
      avg_hr: Math.round(recs.reduce((s, x) => s + x.hr, 0) / recs.length),
      max_hr: Math.max(...recs.map((x) => x.hr)),
      avg_power: null, max_power: null,
      elev_gain: Math.max(...alts) - Math.min(...alts) + 40,
      elev_loss: Math.max(...alts) - Math.min(...alts) + 35,
      min_alt: r1(Math.min(...alts)), max_alt: r1(Math.max(...alts)),
      avg_temp: r1(recs.reduce((s, x) => s + x.temperature, 0) / recs.length),
      max_temp: r1(Math.max(...recs.map((x) => x.temperature))),
      avg_cadence: Math.round(recs.reduce((s, x) => s + x.cadence, 0) / recs.length),
      device: 'Garmin Forerunner 265', source: 'demo_' + name.replace(/\s+/g, '_').toLowerCase() + '.fit',
    },
    recs,
  };
}

function makeRide(name, start, distKm, minutes, cx, cy) {
  const dur = minutes * 60;
  const N = 240;
  const recs = [];
  const totalDistM = distKm * 1000;
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    const lat = cx + 0.05 * Math.sin(p * Math.PI * 2) + 0.06 * p;
    const lon = cy + 0.08 * Math.cos(p * Math.PI * 2) + 0.10 * p;
    const altitude = 120 + 480 * (0.5 - 0.5 * Math.cos(p * Math.PI * 3)) + rand(-4, 4);
    const speed = r2(18 + 14 * Math.sin(p * Math.PI * 5) + rand(-2, 2));
    const hr = Math.round(135 + 28 * Math.sin(p * Math.PI * 2.5) + rand(-4, 4));
    const power = Math.round(190 + 110 * Math.sin(p * Math.PI * 5) + rand(-15, 15));
    const cadence = Math.round(88 + 8 * Math.sin(p * Math.PI * 3) + rand(-3, 3));
    recs.push({ t: Math.round(p * dur), lat: r2(lat * 1e4) / 1e4, lon: r2(lon * 1e4) / 1e4, altitude: r1(altitude), speed: Math.max(2, speed), distance_m: Math.round(p * totalDistM), hr, cadence, power, temperature: r1(rand(9, 21)) });
  }
  return {
    summary: {
      name, sport: 'cycling', subtype: 'road', start_time: start,
      distance_km: r2(distKm), duration_s: dur, moving_s: Math.round(dur * 0.99),
      avg_speed: r2(distKm / (minutes / 60)), max_speed: r2(Math.max(...recs.map((x) => x.speed))),
      avg_hr: Math.round(recs.reduce((s, x) => s + x.hr, 0) / recs.length),
      max_hr: Math.max(...recs.map((x) => x.hr)),
      avg_power: Math.round(recs.reduce((s, x) => s + x.power, 0) / recs.length),
      max_power: Math.max(...recs.map((x) => x.power)),
      elev_gain: Math.max(...recs.map((x) => x.altitude)) - Math.min(...recs.map((x) => x.altitude)),
      elev_loss: Math.max(...recs.map((x) => x.altitude)) - Math.min(...recs.map((x) => x.altitude)),
      min_alt: r1(Math.min(...recs.map((x) => x.altitude))), max_alt: r1(Math.max(...recs.map((x) => x.altitude))),
      avg_temp: r1(recs.reduce((s, x) => s + x.temperature, 0) / recs.length),
      max_temp: r1(Math.max(...recs.map((x) => x.temperature))),
      avg_cadence: Math.round(recs.reduce((s, x) => s + x.cadence, 0) / recs.length),
      device: 'Garmin Edge 1040', source: 'demo_' + name.replace(/\s+/g, '_').toLowerCase() + '.fit',
    },
    recs,
  };
}

function makeSwim(name, start, distM, minutes, cx, cy) {
  const dur = minutes * 60;
  const N = 120;
  const recs = [];
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    const hr = Math.round(118 + 22 * Math.sin(p * Math.PI * 4) + rand(-3, 3));
    recs.push({ t: Math.round(p * dur), lat: r2(cx * 1e4) / 1e4, lon: r2(cy * 1e4) / 1e4, altitude: 0, speed: r2(distM / (dur / 3600)), distance_m: Math.round(p * distM), hr, cadence: null, power: null, temperature: r1(rand(26, 28)) });
  }
  return {
    summary: {
      name, sport: 'swimming', subtype: 'swim', start_time: start,
      distance_km: r2(distM / 1000), duration_s: dur, moving_s: Math.round(dur * 0.92),
      avg_speed: r2((distM / 1000) / (minutes / 60)), max_speed: null,
      avg_hr: Math.round(recs.reduce((s, x) => s + x.hr, 0) / recs.length),
      max_hr: Math.max(...recs.map((x) => x.hr)),
      avg_power: null, max_power: null,
      elev_gain: 0, elev_loss: 0, min_alt: 0, max_alt: 0,
      avg_temp: r1(27), max_temp: r1(27.5), avg_cadence: null,
      device: 'Garmin Forerunner 265', source: 'demo_' + name.replace(/\s+/g, '_').toLowerCase() + '.fit',
    },
    recs,
  };
}

function main() {
  const count = db.prepare('SELECT COUNT(*) c FROM activities').get().c;
  if (count > 0 && !process.argv.includes('--force')) {
    console.log('Database already has', count, 'activities. Use "npm run seed -- --force" to replace with demo data.');
    return;
  }
  db.exec('BEGIN');
  db.exec('DELETE FROM records');
  db.exec('DELETE FROM activity_equipment');
  db.exec('DELETE FROM activities');
  db.exec('DELETE FROM equipment');
  try {
    const act = [
      makeRun('Morning Trail Run', '2026-03-08T07:15:00.000Z', 10.2, 52, 39.9087, 116.3975),
      makeRide('Weekend Mountain Ride', '2026-03-15T06:30:00.000Z', 62.5, 132, 39.95, 116.5),
      makeSwim('Pool Interval Set', '2026-03-20T09:00:00.000Z', 2000, 31, 39.91, 116.40),
      makeRun('Long Run', '2026-04-05T07:00:00.000Z', 18.4, 98, 39.93, 116.42),
      makeRide('Evening Road Ride', '2026-04-12T17:20:00.000Z', 38.0, 88, 39.92, 116.45),
    ];
    const eqRun = insertEquipment('FR265-8842', 'Forerunner 265', 'Garmin', '2026-03-08T07:15:00.000Z', 0);
    const eqRide = insertEquipment('EDGE-1040-2231', 'Edge 1040', 'Garmin', '2026-03-15T06:30:00.000Z', 0);
    for (const a of act) {
      const id = insertActivity(a.summary, a.recs);
      if (a.summary.sport === 'cycling') link(id, eqRide);
      else link(id, eqRun);
    }
    // Compute usage hours from linked activities
    db.exec(`UPDATE equipment SET usage_hours = (
      SELECT COALESCE(SUM(a.duration_s),0)/3600.0
      FROM activity_equipment ae JOIN activities a ON a.id = ae.activity_id
      WHERE ae.equipment_id = equipment.id
    )`);
    db.exec('COMMIT');
    console.log('Seeded', act.length, 'demo activities.');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
}

main();
