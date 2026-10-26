'use strict';
// Loads the real ActivityLog2 test .FIT files (data/import/) into the DB as demo data.
// Run: npm run seed:fit            (skips if DB already has activities)
//      npm run seed:fit -- --force (wipe existing data first)
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { parseFit } = require('./fit');
const { insertParsed, recomputeUsageHours } = require('./importer');

const dir = path.join(__dirname, '..', 'data', 'import');

async function main() {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.fit')) : [];
  if (!files.length) {
    console.error('No .FIT files found in', dir);
    process.exit(1);
  }

  const count = db.prepare('SELECT COUNT(*) c FROM activities').get().c;
  if (count > 0 && !process.argv.includes('--force')) {
    console.log('Database already has', count, 'activities. Use "npm run seed:fit -- --force" to replace with the real test-data set.');
    return;
  }

  db.exec('BEGIN');
  try {
    if (count > 0) {
      db.exec('DELETE FROM records');
      db.exec('DELETE FROM activity_equipment');
      db.exec('DELETE FROM activities');
      db.exec('DELETE FROM equipment');
    }
    const rows = [];
    for (const f of files) {
      const buf = fs.readFileSync(path.join(dir, f));
      const parsed = await parseFit(buf, f);
      const { activityId, recordCount } = insertParsed(parsed);
      rows.push({ file: f, id: activityId, sport: parsed.summary.sport, km: parsed.summary.distance_km, recs: recordCount, device: parsed.summary.device });
    }
    recomputeUsageHours();
    db.exec('COMMIT');
    console.log('Imported ' + rows.length + ' activities from real FIT test data:');
    console.table(rows);
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('Import failed:', e.message);
    process.exit(1);
  }
}

main();
