'use strict';
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { parseFit } = require('./fit');
const { insertParsed } = require('./importer');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---- Import ----
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
    db.exec('BEGIN');
    try {
      const { activityId, recordCount } = insertParsed(parsed);
      db.exec('COMMIT');
      res.json({ ok: true, id: activityId, count: recordCount });
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
  const laps = db.prepare(
    'SELECT * FROM laps WHERE activity_id = ? ORDER BY idx ASC, id ASC'
  ).all(id).map((l) => ({ ...l, trigger: l.lap_trigger }));
  res.json({ activity: act, records, laps });
});

// ---- Delete ----
app.delete('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!act) return res.status(404).json({ error: 'Not found' });
  db.exec('BEGIN');
  db.prepare('DELETE FROM records WHERE activity_id = ?').run(id);
  db.prepare('DELETE FROM laps WHERE activity_id = ?').run(id);
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

// ---- Reports：按月聚合（Count/时长/里程/均心率/均踏频/爬升） ----
app.get('/api/reports/monthly', (req, res) => {
  const { sport } = req.query;
  const where = ['start_time IS NOT NULL']; const args = [];
  if (sport && sport !== 'all') { where.push('sport = ?'); args.push(sport); }
  const sql = `
    SELECT substr(start_time,1,7) AS month, sport,
           COUNT(*) AS count,
           ROUND(SUM(duration_s)/3600.0,1) AS hours,
           ROUND(SUM(distance_km),1) AS distance_km,
           ROUND(AVG(avg_hr)) AS avg_hr,
           ROUND(AVG(avg_cadence)) AS avg_cadence,
           ROUND(SUM(elevation_gain)) AS elevation,
           ROUND(AVG(avg_power)) AS avg_power
    FROM activities
    WHERE ${where.join(' AND ')}
    GROUP BY month, sport ORDER BY month, sport
  `;
  const rows = db.prepare(sql).all(...args);
  res.json({ rows, sql });
});

// ---- Athlete metrics（运动员指标，随时间记录体重/静息HR/最大HR/LTHR/FTP） ----
app.get('/api/athlete-metrics', (req, res) => {
  res.json(db.prepare('SELECT * FROM athlete_metrics ORDER BY recorded_at ASC, id ASC').all());
});
app.post('/api/athlete-metrics', (req, res) => {
  const b = req.body || {};
  if (!b.recorded_at) return res.status(400).json({ error: 'recorded_at 必填' });
  const r = db.prepare(`
    INSERT INTO athlete_metrics (recorded_at, weight_kg, resting_hr, max_hr, lthr, ftp, notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(b.recorded_at, b.weight_kg ?? null, b.resting_hr ?? null, b.max_hr ?? null, b.lthr ?? null, b.ftp ?? null, b.notes ?? null);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
app.delete('/api/athlete-metrics/:id', (req, res) => {
  db.prepare('DELETE FROM athlete_metrics WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Workouts（训练计划：步骤以 JSON 存于 steps 列） ----
app.get('/api/workouts', (req, res) => {
  const rows = db.prepare('SELECT * FROM workouts ORDER BY created_at DESC, id DESC').all();
  res.json(rows.map((w) => { try { w.steps = JSON.parse(w.steps || '[]'); } catch { w.steps = []; } return w; }));
});
app.post('/api/workouts', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name 必填' });
  const steps = Array.isArray(b.steps) ? b.steps : [];
  const r = db.prepare('INSERT INTO workouts (name, sport, description, steps, created_at) VALUES (?,?,?,?,?)')
    .run(b.name, b.sport || 'cycling', b.description || '', JSON.stringify(steps), new Date().toISOString());
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
app.delete('/api/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Runtime config (frontend needs the AMap key) ----
app.get('/api/config', (req, res) => {
  res.json({
    amapKey: process.env.amap_key || '',
    amapSecurityCode: process.env.amap_security_code || '',
  });
});

// ---- Errors ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ---- Static serving (when a production build exists) ----
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ActivityLog server listening on http://localhost:${PORT}`));
