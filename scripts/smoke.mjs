import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const outfile = path.join(__dirname, '.smoke-bundle.cjs');
await esbuild.build({
  entryPoints: [path.join(__dirname, 'smoke-entry.jsx')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  jsx: 'automatic',
  external: ['jsdom'],
  alias: {
    echarts: path.join(__dirname, 'stub-echarts.js'),
    leaflet: path.join(__dirname, 'stub-leaflet.js'),
  },
  logLevel: 'silent',
});

// run the bundle
require(outfile);
