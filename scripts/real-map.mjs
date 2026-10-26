import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const outfile = path.join(__dirname, '.real-map-bundle.cjs');
await esbuild.build({
  entryPoints: [path.join(__dirname, 'real-map-entry.jsx')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  jsx: 'automatic',
  external: ['jsdom'],
  // NOTE: no alias here -> the REAL leaflet is bundled
  logLevel: 'silent',
});

require(outfile);
