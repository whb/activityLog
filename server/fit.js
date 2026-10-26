'use strict';
// Parses a .FIT buffer into a normalized activity summary + sample records.
const { default: FitParser, getFitSportName, getFitManufacturerName, getFitGarminProductDisplayName } = require('fit-file-parser');

function num(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Pick the "main" device from the device_infos array (watch/computer that created the file).
function pickDevice(deviceInfos) {
  if (!Array.isArray(deviceInfos) || !deviceInfos.length) return null;
  return (
    deviceInfos.find((d) => d && d.device_index === 'creator') ||
    deviceInfos.find((d) => d && d.serial_number != null) ||
    deviceInfos[0]
  );
}

// Prefer explicit elapsed_time, else derive from timestamps.
function relTime(rec, startTime) {
  const e = num(rec.elapsed_time);
  if (e !== null) return Math.round(e);
  const ts = rec.timestamp;
  if (ts && startTime) {
    const a = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    const b = new Date(startTime).getTime();
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(0, Math.round((a - b) / 1000));
  }
  return null;
}

async function parseFit(buffer, sourceFile) {
  const parser = new FitParser({
    mode: 'list',
    speedUnit: 'km/h',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
  });
  const data = await parser.parseAsync(buffer);

  const sessions = data.sessions || [];
  const records = data.records || [];
  const activity = data.activity || {};
  const lastSession = sessions[sessions.length - 1] || {};

  // ---- Multi-sport (triathlon) detection: explicit type, or >1 real sport across sessions ----
  const realSports = new Set(sessions.map((s) => s.sport).filter((x) => x && x !== 'transition' && x !== 'generic'));
  const isMulti = (activity.type && String(activity.type).includes('multi')) ||
    (sessions.length > 1 && realSports.size > 1);

  // ---- Sport name (parser returns a decoded string like "running", or a numeric id) ----
  const decode = (v) => (typeof v === 'string' && v ? v : typeof v === 'number' ? getFitSportName(v) || null : null);
  let sport = isMulti ? 'triathlon' : decode(lastSession.sport ?? lastSession.activity_type);
  let sportSubtype = isMulti ? null : decode(lastSession.sub_sport);
  if (!sport || sport === 'generic' || sport === 'unknown') {
    const st = (sportSubtype || '').toLowerCase();
    if (st.includes('swim') || st === 'open_water') sport = 'swimming';
    else if (st === 'triathlon') sport = 'triathlon';
  }

  // ---- Cross-session aggregation helpers ----
  const vals = (f) => sessions.map((s) => num(s[f])).filter((v) => v !== null);
  const sumV = (f) => { const v = vals(f); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const maxV = (f) => { const v = vals(f); return v.length ? Math.max(...v) : null; };
  const meanV = (f) => { const v = vals(f); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  let movingS = 0, hasMoving = false;
  for (const s of sessions) { const m = num(s.moving_time ?? s.active_time); if (m !== null) { movingS += m; hasMoving = true; } }
  if (!hasMoving) movingS = null;

  // Distance = sum of all session distances (m); fallback to last record cumulative.
  let distanceM = sumV('total_distance') || 0;
  if (!distanceM && records.length) distanceM = num(records[records.length - 1].distance) || 0;

  // Duration = activity total timer time for multi-sport, else last session elapsed.
  let durationS = isMulti ? num(activity.total_timer_time) : num(lastSession.total_elapsed_time);
  if (durationS === null) durationS = sumV('total_elapsed_time');

  // Start = earliest session start.
  const starts = sessions.map((s) => toDate(s.start_time)).filter(Boolean).sort();
  const startTime = starts[0] || null;

  // Altitude bounds from sessions first, refined by scanning records below.
  let minAlt = null, maxAlt = null;
  const sMin = vals('min_altitude'), sMax = vals('max_altitude');
  if (sMin.length) minAlt = Math.min(...sMin);
  if (sMax.length) maxAlt = Math.max(...sMax);

  const samples = [];
  for (const r of records) {
    const lat = num(r.position_lat);
    const lon = num(r.position_long ?? r.position_lon);
    const alt = num(r.altitude);
    if (alt !== null) {
      minAlt = minAlt === null ? alt : Math.min(minAlt, alt);
      maxAlt = maxAlt === null ? alt : Math.max(maxAlt, alt);
    }
    samples.push({
      t: relTime(r, startTime),
      lat,
      lon,
      altitude: alt,
      speed: num(r.speed),
      distance_m: num(r.distance),
      hr: r.heart_rate != null ? Math.round(r.heart_rate) : null,
      cadence: r.cadence != null ? Math.round(r.cadence) : null,
      power: num(r.power),
      temperature: num(r.temperature),
    });
  }

  // Cadence average (across sessions), fallback to per-record mean.
  const avgCadSess = meanV('avg_cadence');
  let avgCadence = avgCadSess != null ? Math.round(avgCadSess) : null;
  if (avgCadence === null) {
    const cs = samples.map((s) => s.cadence).filter((c) => c !== null && c > 0);
    if (cs.length) avgCadence = Math.round(cs.reduce((a, b) => a + b, 0) / cs.length);
  }

  // Temperature max across sessions, fallback to records.
  let maxTemp = maxV('max_temperature');
  if (maxTemp === null) {
    const ts = samples.map((s) => s.temperature).filter((t) => t !== null);
    if (ts.length) maxTemp = Math.max(...ts);
  }

  // Device info (device_infos is an array: watch + sensors; pick the creator)
  const di = pickDevice(data.device_infos);
  let device = null;
  let manufacturer = null;
  let product = null;
  let serial = null;
  if (di) {
    manufacturer = di.manufacturer;
    if (typeof manufacturer === 'number') manufacturer = getFitManufacturerName(manufacturer) || null;
    if (typeof manufacturer === 'string' && manufacturer) manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
    if (di.product_name) product = di.product_name;
    else if (typeof di.product === 'number') product = getFitGarminProductDisplayName(di.product) || null;
    serial = di.serial_number != null ? String(di.serial_number) : null;
    device = [product, manufacturer].filter(Boolean).join(' ') || null;
  }

  // avg_speed: recompute for multi-sport (total/total), else the official session value.
  const avgSpeed = isMulti
    ? (distanceM && durationS ? +((distanceM / 1000) / (durationS / 3600)).toFixed(2) : null)
    : num(lastSession.avg_speed);

  const summary = {
    name: lastSession.name || null,
    sport: sport || 'unknown',
    sport_subtype: sportSubtype,
    start_time: startTime,
    distance_km: distanceM ? +(distanceM / 1000).toFixed(3) : null,
    duration_s: durationS !== null ? Math.round(durationS) : null,
    moving_s: movingS !== null ? Math.round(movingS) : null,
    avg_speed: avgSpeed,
    max_speed: maxV('max_speed'),
    avg_hr: meanV('avg_heart_rate') != null ? Math.round(meanV('avg_heart_rate')) : null,
    max_hr: maxV('max_heart_rate'),
    avg_power: meanV('avg_power') != null ? Math.round(meanV('avg_power')) : null,
    max_power: maxV('max_power'),
    elevation_gain: sumV('total_ascent'),
    elevation_loss: sumV('total_descent'),
    min_altitude: minAlt,
    max_altitude: maxAlt,
    avg_temp: isMulti ? meanV('avg_temperature') : num(lastSession.avg_temperature),
    max_temp: maxTemp,
    avg_cadence: avgCadence,
    device,
    source_file: sourceFile,
  };

  const equipment = (serial || product) ? { serial_number: serial, product_name: product, manufacturer, duration_s: durationS } : null;

  return { summary, samples, equipment };
}

module.exports = { parseFit };
