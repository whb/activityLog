'use strict';
// Parses a .FIT buffer into a normalized activity summary + sample records.
const { default: FitParser, getFitSportName, getFitSubSportName, getFitManufacturerName } = require('fit-file-parser');

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
  const session = sessions[sessions.length - 1] || {};
  const records = data.records || [];

  // Sport
  const sportId = session.sport ?? session.activity_type;
  let sport = null;
  if (typeof sportId === 'number' || typeof sportId === 'string') {
    sport = getFitSportName(sportId) || null;
  }
  const subSportId = session.sub_sport;
  let sportSubtype = null;
  if (typeof subSportId === 'number' || typeof subSportId === 'string') {
    sportSubtype = getFitSubSportName(subSportId) || null;
  }

  // Distance: session total (m) -> km, fallback to last record cumulative
  let distanceM = num(session.total_distance);
  if (distanceM === null && records.length) {
    const last = records[records.length - 1];
    distanceM = num(last.distance);
  }

  // Altitude min/max from session bounds if absent, else scan records
  let minAlt = num(session.min_altitude);
  let maxAlt = num(session.max_altitude);

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
      t: relTime(r, session.start_time),
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

  // Cadence average fallback from records
  let avgCadence = num(session.avg_cadence);
  if (avgCadence === null) {
    const cs = samples.map((s) => s.cadence).filter((c) => c !== null && c > 0);
    if (cs.length) avgCadence = Math.round(cs.reduce((a, b) => a + b, 0) / cs.length);
  }

  // Temperature bounds
  let maxTemp = num(session.max_temperature);
  if (maxTemp === null) {
    const ts = samples.map((s) => s.temperature).filter((t) => t !== null);
    if (ts.length) maxTemp = Math.max(...ts);
  }

  const durationS = num(session.total_elapsed_time);
  const movingS = num(session.active_time ?? session.moving_time);

  // Device info
  const di = data.device_info || {};
  let device = null;
  let manufacturer = null;
  let product = null;
  let serial = null;
  if (di) {
    manufacturer = di.manufacturer != null ? getFitManufacturerName(di.manufacturer) : null;
    product = di.product_name || di.product || null;
    serial = di.serial_number != null ? String(di.serial_number) : null;
    device = [product, manufacturer].filter(Boolean).join(' ') || null;
  }

  const summary = {
    name: session.name || null,
    sport: sport || 'unknown',
    sport_subtype: sportSubtype,
    start_time: toDate(session.start_time),
    distance_km: distanceM !== null ? +(distanceM / 1000).toFixed(3) : null,
    duration_s: durationS !== null ? Math.round(durationS) : null,
    moving_s: movingS !== null ? Math.round(movingS) : null,
    avg_speed: num(session.avg_speed),
    max_speed: num(session.max_speed),
    avg_hr: session.avg_heart_rate != null ? Math.round(session.avg_heart_rate) : null,
    max_hr: session.max_heart_rate != null ? Math.round(session.max_heart_rate) : null,
    avg_power: num(session.avg_power),
    max_power: num(session.max_power),
    elevation_gain: num(session.total_ascent),
    elevation_loss: num(session.total_descent),
    min_altitude: minAlt,
    max_altitude: maxAlt,
    avg_temp: num(session.avg_temperature),
    max_temp: maxTemp,
    avg_cadence: avgCadence,
    device,
    source_file: sourceFile,
  };

  const equipment = (serial || product) ? { serial_number: serial, product_name: product, manufacturer, duration_s: durationS } : null;

  return { summary, samples, equipment };
}

module.exports = { parseFit };
