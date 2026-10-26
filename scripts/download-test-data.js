'use strict';
// Downloads the .FIT test files from ActivityLog2 repo via the GitHub API
// (api.github.com is reachable even when raw.githubusercontent.com TLS fails on this host).
const fs = require('fs');
const path = require('path');

const FILES = [
  '310xt-bike.fit', '310xt-ows.fit', '310xt-run.fit',
  '920xt-bike.fit', '920xt-lap-swim.fit', '920xt-run.fit', '920xt-triathlon.fit',
  'cydynamics-bike.fit', 'garmin-swim.fit',
];
const API = 'https://api.github.com/repos/alex-hhh/ActivityLog2/contents/test/test-data/';
const outDir = path.join(__dirname, '..', 'data', 'import');

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'activitylog-demo' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of FILES) {
    const j = await fetchText(API + name);
    if (j.content && j.encoding === 'base64') {
      fs.writeFileSync(path.join(outDir, name), Buffer.from(j.content, 'base64'));
      console.log('ok', name, (j.size / 1024).toFixed(1) + 'KB');
    } else {
      // may be LFS pointer or missing
      console.log('skip (no content)', name, j.message || '');
    }
  }
  console.log('done ->', outDir);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
