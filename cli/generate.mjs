#!/usr/bin/env node
// Generate the printed connectors from the command line.
//   node cli/generate.mjs --leg 96 --base 60 --door 40 --ceiling 108 --socket 39.1 --out out/
// All measurements in inches except --socket (mm). Run with --help for details.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Module from 'manifold-3d';
import { DEFAULTS, deriveGeometry, validate, buildParts, buildFitTests, toSTL, gramsFor } from '../docs/parts.js';

const HELP = `Walk-in teepee tree connector generator

Options (inches unless noted):
  --leg <in>       Leg length, end to end              (default ${DEFAULTS.legLength})
  --base <in>      Base width, corner to corner at feet (default ${DEFAULTS.baseWidth})
  --door <in>      Door crosspiece height              (default ${DEFAULTS.doorHeight})
  --ceiling <in>   Ceiling height, for the star check  (default ${DEFAULTS.ceiling})
  --socket <mm>    Socket size from your fit test      (default ${DEFAULTS.socketMm})
  --fit-test       Only make the three fit-test rings around --socket
  --out <dir>      Output folder                       (default ./out)
`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(HELP); process.exit(0); }
const get = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : def; };
const params = {
  legLength: get('--leg', DEFAULTS.legLength),
  baseWidth: get('--base', DEFAULTS.baseWidth),
  doorHeight: get('--door', DEFAULTS.doorHeight),
  ceiling: get('--ceiling', DEFAULTS.ceiling),
  socketMm: get('--socket', DEFAULTS.socketMm),
};
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'out';

const problems = validate(params);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const wasm = await Module();
wasm.setup();
mkdirSync(out, { recursive: true });

const parts = args.includes('--fit-test') ? buildFitTests(wasm, params.socketMm) : buildParts(wasm, params);
let grams = 0;
for (const p of parts) {
  const stl = toSTL(p.manifold);
  writeFileSync(join(out, `${p.name}.stl`), stl);
  const g = gramsFor(p.manifold) * p.qty; grams += g;
  const bb = p.manifold.boundingBox();
  const size = bb.max.map((v, i) => (v - bb.min[i]).toFixed(0)).join(' x ');
  console.log(`${p.name.padEnd(30)} x${p.qty}  ${size} mm  ~${g.toFixed(0)} g  ${p.manifold.status ? '' : ''}`);
}

const g = deriveGeometry(params);
const summary = {
  params,
  lean_deg: +g.lean.toFixed(2),
  frame_height_in: +g.hubTop.toFixed(2),
  star_top_in: +g.starTop.toFixed(2),
  ceiling_clearance_in: +g.clearance.toFixed(2),
  base_piece_in: +g.basePiece.toFixed(3),
  crosspiece_in_approx: +g.crosspiece.toFixed(2),
  filament_g_approx: Math.round(grams),
};
writeFileSync(join(out, 'params.json'), JSON.stringify(summary, null, 2));
console.log(`\nLean ${g.lean.toFixed(2)}°, star top ${g.starTop.toFixed(1)}" (${g.clearance.toFixed(1)}" under the ceiling), ~${Math.round(grams)} g PETG`);
console.log(`Wrote ${parts.length} STL files and params.json to ${out}/`);
