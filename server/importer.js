'use strict';
// Shared import logic: persist a parsed FIT (summary + samples + equipment) into the DB.
// Used by both the /api/import endpoint and the seed-fit demo loader, so the two never drift.
const db = require('./db');

// Find-or-create the device; accumulate usage hours + first/last seen.
function upsertEquipment(eq, when) {
  if (!eq) return null;
  const hours = eq.duration_s ? eq.duration_s / 3600 : 0;
  let row = eq.serial_number
    ? db.prepare('SELECT id FROM equipment WHERE serial_number = ?').get(eq.serial_number)
    : null;
  if (!row && eq.product_name) {
    row = db.prepare('SELECT id FROM equipment WHERE product_name = ?').get(eq.product_name);
  }
  if (row) {
    db.prepare(
      `UPDATE equipment SET usage_hours = usage_hours + ?,
        last_seen = MAX(COALESCE(last_seen, ?), ?),
        first_seen = MIN(COALESCE(first_seen, ?), ?)
        WHERE id = ?`
    ).run(hours, when, when, when, when, row.id);
    return row.id;
  }
  const r = db.prepare(
    'INSERT INTO equipment (serial_number, product_name, manufacturer, first_seen, last_seen, usage_hours) VALUES (?,?,?,?,?,?)'
  ).run(eq.serial_number || null, eq.product_name || null, eq.manufacturer || null, when, when, hours);
  return Number(r.lastInsertRowid);
}

// Insert one parsed activity + its records + equipment link. Caller manages the transaction.
function insertParsed(parsed) {
  const s = parsed.summary;
  const info = db.prepare(`
    INSERT INTO activities (
      name, sport, sport_subtype, start_time, distance_km, duration_s, moving_s,
      avg_speed, max_speed, avg_hr, max_hr, avg_power, max_power,
      elevation_gain, elevation_loss, min_altitude, max_altitude,
      avg_temp, max_temp, avg_cadence, device, source_file, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    s.name || (s.sport + ' ' + (s.start_time ? s.start_time.slice(0, 10) : '')),
    s.sport, s.sport_subtype, s.start_time, s.distance_km, s.duration_s, s.moving_s,
    s.avg_speed, s.max_speed, s.avg_hr, s.max_hr, s.avg_power, s.max_power,
    s.elevation_gain, s.elevation_loss, s.min_altitude, s.max_altitude,
    s.avg_temp, s.max_temp, s.avg_cadence, s.device, s.source_file, new Date().toISOString()
  );
  const activityId = Number(info.lastInsertRowid);

  const insRec = db.prepare(
    'INSERT INTO records (activity_id, t, lat, lon, altitude, speed, distance_m, hr, cadence, power, temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const r of parsed.samples) {
    insRec.run(activityId, r.t, r.lat, r.lon, r.altitude, r.speed, r.distance_m, r.hr, r.cadence, r.power, r.temperature);
  }

  if (Array.isArray(parsed.laps) && parsed.laps.length) {
    const insLap = db.prepare(`
      INSERT INTO laps (
        activity_id, idx, start_t, end_t, duration_s, start_distance_m, end_distance_m, distance_m,
        start_lat, start_lon, end_lat, end_lon, avg_speed, max_speed, avg_hr, max_hr,
        avg_power, max_power, elevation_gain, elevation_loss, avg_cadence, calories, lap_trigger
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const l of parsed.laps) {
      insLap.run(
        activityId, l.index, l.start_t, l.end_t, l.duration_s, l.start_distance_m, l.end_distance_m, l.distance_m,
        l.start_lat, l.start_lon, l.end_lat, l.end_lon, l.avg_speed, l.max_speed, l.avg_hr, l.max_hr,
        l.avg_power, l.max_power, l.elevation_gain, l.elevation_loss, l.avg_cadence, l.calories, l.trigger
      );
    }
  }

  const when = s.start_time || new Date().toISOString();
  const eqId = upsertEquipment(parsed.equipment, when);
  if (eqId) db.prepare('INSERT OR IGNORE INTO activity_equipment (activity_id, equipment_id) VALUES (?,?)').run(activityId, eqId);

  return { activityId, recordCount: parsed.samples.length };
}

// Set each device's usage_hours to the exact sum of its linked activities' durations.
function recomputeUsageHours() {
  db.exec(`UPDATE equipment SET usage_hours = (
    SELECT COALESCE(SUM(a.duration_s),0)/3600.0
    FROM activity_equipment ae JOIN activities a ON a.id = ae.activity_id
    WHERE ae.equipment_id = equipment.id
  )`);
}

module.exports = { upsertEquipment, insertParsed, recomputeUsageHours };
