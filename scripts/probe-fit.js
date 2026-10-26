'use strict';
// Probe-parse the real .FIT test files with the project's parseFit to confirm field mapping.
const fs = require('fs');
const path = require('path');
const { parseFit } = require('../server/fit');

const dir = path.join(__dirname, '..', 'data', 'import');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.fit'));

(async () => {
  for (const f of files) {
    try {
      const buf = fs.readFileSync(path.join(dir, f));
      const { summary: s, samples } = await parseFit(buf, f);
      const gps = samples.filter((r) => r.lat != null && r.lon != null).length;
      const hr = samples.filter((r) => r.hr != null).length;
      const pw = samples.filter((r) => r.power != null).length;
      const cd = samples.filter((r) => r.cadence != null).length;
      const alt = samples.filter((r) => r.altitude != null).length;
      console.log('\n=== ' + f + ' ===');
      console.log('  sport:', s.sport, '| subtype:', s.sport_subtype, '| name:', s.name);
      console.log('  start:', s.start_time, '| dur_s:', s.duration_s, '| moving_s:', s.moving_s);
      console.log('  dist_km:', s.distance_km, '| avg_speed:', s.avg_speed, '| max_speed:', s.max_speed);
      console.log('  hr:', s.avg_hr, '/', s.max_hr, '| power:', s.avg_power, '/', s.max_power, '| cadence:', s.avg_cadence);
      console.log('  elev_gain/loss:', s.elevation_gain, '/', s.elevation_loss, '| alt range:', s.min_altitude, '-', s.max_altitude);
      console.log('  device:', s.device, '| src:', s.source_file);
      console.log('  samples:', samples.length, '| gps:', gps, 'hr:', hr, 'pw:', pw, 'cd:', cd, 'alt:', alt);
      const g = samples.find((r) => r.lat != null && r.lon != null);
      if (g) console.log('  first gps sample: t=' + g.t + ' lat=' + g.lat + ' lon=' + g.lon + ' alt=' + g.altitude + ' spd=' + g.speed);
    } catch (e) {
      console.log('\n=== ' + f + ' ===\n  PARSE ERROR:', e.message);
    }
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
