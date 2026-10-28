'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'activitylog.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS activities (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT,
  sport          TEXT,
  sport_subtype  TEXT,
  start_time     TEXT,
  distance_km    REAL,
  duration_s     INTEGER,
  moving_s       INTEGER,
  avg_speed      REAL,
  max_speed      REAL,
  avg_hr         INTEGER,
  max_hr         INTEGER,
  avg_power      INTEGER,
  max_power      INTEGER,
  elevation_gain REAL,
  elevation_loss REAL,
  min_altitude   REAL,
  max_altitude   REAL,
  avg_temp       REAL,
  max_temp       REAL,
  avg_cadence    INTEGER,
  device         TEXT,
  source_file    TEXT,
  created_at     TEXT
);

CREATE TABLE IF NOT EXISTS records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  t           INTEGER,
  lat         REAL,
  lon         REAL,
  altitude    REAL,
  speed       REAL,
  distance_m  REAL,
  hr          INTEGER,
  cadence     INTEGER,
  power       INTEGER,
  temperature REAL
);

CREATE TABLE IF NOT EXISTS laps (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id      INTEGER NOT NULL,
  idx              INTEGER,
  start_t          INTEGER,
  end_t            INTEGER,
  duration_s       INTEGER,
  start_distance_m REAL,
  end_distance_m   REAL,
  distance_m       REAL,
  start_lat        REAL,
  start_lon        REAL,
  end_lat          REAL,
  end_lon          REAL,
  avg_speed        REAL,
  max_speed        REAL,
  avg_hr           INTEGER,
  max_hr           INTEGER,
  avg_power        INTEGER,
  max_power        INTEGER,
  elevation_gain   REAL,
  elevation_loss   REAL,
  avg_cadence      INTEGER,
  calories         INTEGER,
  lap_trigger      TEXT
);

CREATE TABLE IF NOT EXISTS equipment (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number  TEXT,
  product_name   TEXT,
  manufacturer   TEXT,
  first_seen     TEXT,
  last_seen      TEXT,
  usage_hours    REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_equipment (
  activity_id  INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  PRIMARY KEY (activity_id, equipment_id)
);

CREATE TABLE IF NOT EXISTS athlete_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT,
  weight_kg   REAL,
  resting_hr  INTEGER,
  max_hr      INTEGER,
  lthr        INTEGER,
  ftp         INTEGER,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS workouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  sport       TEXT,
  description TEXT,
  steps       TEXT,
  created_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_records_activity ON records(activity_id);
CREATE INDEX IF NOT EXISTS idx_laps_activity ON laps(activity_id);
CREATE INDEX IF NOT EXISTS idx_activities_start ON activities(start_time);
CREATE INDEX IF NOT EXISTS idx_athlete_at ON athlete_metrics(recorded_at);
`);

module.exports = db;
