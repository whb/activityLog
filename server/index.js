'use strict';
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { parseFit } = require('./fit');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());

// ---- Import ----
function upsertEquipment(eq, when) {
  if (!eq) return null;
  const hours = eq.duration_s ? eq.duration_s / 3600 : 0;
  let row = db.prepare(
    'SELECT id FROM equipment WHERE (serial_number IS NOT NULL AND serial_number = ?)'
  ).get(eq.serial_number || null);
  if (!row && eq.serial_number) {
    // no serial match, try product name
  }
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

app.post('/api/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'No file uploaded (field "file")' });
    }
    let parsed;
    try {
      parsed = await parseFit(req.file.buffer, req.file.originalname);
    } catch (e) {
      return res.status(422).json({ error: 'Failed to parse FIT file: ' + e.message });
    }
    const s = parsed.summary;
    db.exec('BEGIN');
    try {
      const ins = db.prepare(`
        INSERT INTO activities (
          name, sport, sport_subtype, start_time, distance_km, duration_s, moving_s,
          avg_speed, max_speed, avg_hr, max_hr, avg_power, max_power,
          elevation_gain, elevation_loss, min_altitude, max_altitude,
          avg_temp, max_temp, avg_cadence, device, source_file, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const info = ins.run(
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
      const when = s.start_time || new Date().toISOString();
      const insEqLink = db.prepare('INSERT OR IGNORE INTO activity_equipment (activity_id, equipment_id) VALUES (?,?)');

      for (const r of parsed.samples) {
        insRec.run(activityId, r.t, r.lat, r.lon, r.altitude, r.speed, r.distance_m, r.hr, r.cadence, r.power, r.temperature);
      }
      const eqId = upsertEquipment(parsed.equipment, when);
      if (eqId) insEqLink.run(activityId, eqId);

      db.exec('COMMIT');
      res.json({ ok: true, id: activityId, count: parsed.samples.length });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// ---- Activity list ----
app.get('/api/activities', (req, res) => {
  const { sport, from, to, q } = req.query;
  const where = [];
  const args = [];
  if (sport && sport !== 'all') { where.push('sport = ?'); args.push(sport); }
  if (from) { where.push('start_time >= ?'); args.push(from + 'T00:00:00.000Z'); }
  if (to) { where.push('start_time <= ?'); args.push(to + 'T23:59:59.999Z'); }
  if (q) { where.push('(name LIKE ? OR source_file LIKE ?)'); args.push('%' + q + '%', '%' + q + '%'); }
  const sql = `SELECT * FROM activities ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY start_time DESC, id DESC LIMIT 1000`;
  res.json(db.prepare(sql).all(...args));
});

// Distinct sports for filters
app.get('/api/activities/sports', (req, res) => {
  const rows = db.prepare('SELECT sport, COUNT(*) c FROM activities GROUP BY sport ORDER BY c DESC').all();
  res.json(rows.map((r) => r.sport));
});

// ---- Activity detail ----
app.get('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!act) return res.status(404).json({ error: 'Not found' });
  const records = db.prepare(
    'SELECT t, lat, lon, altitude, speed, distance_m, hr, cadence, power, temperature FROM records WHERE activity_id = ? ORDER BY t ASC, id ASC'
  ).all(id);
  res.json({ activity: act, records });
});

// ---- Delete ----
app.delete('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!act) return res.status(404).json({ error: 'Not found' });
  db.exec('BEGIN');
  db.prepare('DELETE FROM records WHERE activity_id = ?').run(id);
  db.prepare('DELETE FROM activity_equipment WHERE activity_id = ?').run(id);
  db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  db.exec('COMMIT');
  res.json({ ok: true });
});

// ---- Reports ----
app.get('/api/reports/summary', (req, res) => {
  const totals = db.prepare(`
    SELECT sport,
           COUNT(*) AS count,
           ROUND(COALESCE(SUM(distance_km),0),1) AS distance_km,
           ROUND(COALESCE(SUM(duration_s),0)/3600.0,1) AS hours
    FROM activities GROUP BY sport
  `).all();

  // Monthly volume (last 12 months), per sport
  const monthly = db.prepare(`
    SELECT substr(start_time,1,7) AS month, sport,
           ROUND(SUM(distance_km),1) AS distance_km,
           ROUND(SUM(duration_s)/3600.0,1) AS hours,
           COUNT(*) AS count
    FROM activities WHERE start_time IS NOT NULL
    GROUP BY month, sport ORDER BY month
  `).all();

  const grand = db.prepare(`
    SELECT COUNT(*) AS count,
           ROUND(COALESCE(SUM(distance_km),0),1) AS distance_km,
           ROUND(COALESCE(SUM(duration_s),0)/3600.0,1) AS hours,
           MIN(start_time) AS first, MAX(start_time) AS last
    FROM activities
  `).get();

  res.json({ totals, monthly, grand });
});

// ---- Equipment ----
app.get('/api/equipment', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, COUNT(ae.activity_id) AS activity_count
    FROM equipment e LEFT JOIN activity_equipment ae ON ae.equipment_id = e.id
    GROUP BY e.id ORDER BY e.last_seen DESC
  `).all();
  res.json(rows);
});

// ---- Errors ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ---- Production static serving ----
const distDir = path.join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ActivityLog server listening on http://localhost:${PORT}`));
