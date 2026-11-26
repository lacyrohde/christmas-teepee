// Walk-in teepee tree: printed connector geometry.
// One source of truth for the browser planner (docs/index.html) and the CLI (cli/generate.mjs).
// All user-facing inputs are in inches; geometry is built in millimetres.
// Needs a manifold-3d instance (https://github.com/elalish/manifold), passed in as `wasm`.

export const IN = 25.4;

// Fixed design constants (inches unless noted)
export const DESIGN = {
  hubFloorRadius: 2.2,   // centre of tree to the floor of each hub socket
  footFloorHeight: 0.5,  // floor of the foot socket above the ground
  hubAbove: 0.4,         // hub top above the leg-top socket floors
  starPost: 6,           // star post showing above the hub
  starAbove: 7,          // a 10" star sitting 3" down over the post
  armFloor: 1.5,         // base-corner arm socket floor, from the foot centre
  sleeveFloor: 1.42,     // crosspiece socket floor, from the leg centre
  socketDepthMm: 50.8,   // 2" (hub and leg feet: these carry the leaning legs)
  armDepthMm: 38.1,      // 1.5" base-arm sockets: the screws hold the base pieces, so less depth is needed
  wallMm: 4,
  screwMm: 4.5,          // #8 wood screw clearance
};

export const DEFAULTS = {
  legLength: 96,     // in
  baseWidth: 60,     // in, corner to corner at the feet
  doorHeight: 40,    // in, crosspiece centre
  ceiling: 108,      // in
  socketMm: 39.1,    // square socket size; set from the fit-test rings
};

export const LIMITS = {
  legLength: [72, 120], baseWidth: [48, 84], doorHeight: [24, 54], ceiling: [84, 168], socketMm: [37.5, 40.5],
  maxLeanDeg: 30,
};

/** Everything the planner shows, derived from the four measurements. */
export function deriveGeometry(p) {
  const R = p.baseWidth / 2;
  const run = R - DESIGN.hubFloorRadius;
  const V = Math.sqrt(p.legLength ** 2 - run ** 2);
  const lean = Math.asin(run / p.legLength) * 180 / Math.PI;
  const legTop = DESIGN.footFloorHeight + V;
  const hubTop = legTop + DESIGN.hubAbove;
  const starTop = hubTop + DESIGN.starPost + DESIGN.starAbove;
  const rAt = z => R - run * (z - DESIGN.footFloorHeight) / V;
  const crosspiece = rAt(p.doorHeight) - 2 * DESIGN.sleeveFloor;
  const vMax = p.ceiling - 1 - DESIGN.starPost - DESIGN.starAbove - DESIGN.hubAbove - DESIGN.footFloorHeight;
  const maxLegForCeiling = vMax > 0 ? Math.sqrt(vMax ** 2 + run ** 2) : 0;
  return {
    ...p, R, run, V, lean, legTop, hubTop, starTop, crosspiece, maxLegForCeiling,
    basePiece: R - 2 * DESIGN.armFloor,
    clearance: p.ceiling - starTop,
    doorAtFloor: R - 2.5,
    insideWidth: R * Math.sqrt(3),
  };
}

/** Returns a list of problems with a set of measurements (empty if it can be built). */
export function validate(p) {
  const out = [];
  for (const k of ['legLength', 'baseWidth', 'doorHeight', 'ceiling', 'socketMm']) {
    const [lo, hi] = LIMITS[k];
    if (!(p[k] >= lo && p[k] <= hi)) out.push(`${k} must be between ${lo} and ${hi}.`);
  }
  if (out.length) return out;
  const g = deriveGeometry(p);
  if (!(g.lean <= LIMITS.maxLeanDeg)) out.push(`The legs would lean ${g.lean.toFixed(1)}°. Keep it under ${LIMITS.maxLeanDeg}°: use longer legs or a narrower base.`);
  if (p.doorHeight > g.legTop - 18) out.push('The door crosspiece is too close to the top of the tree.');
  return out;
}

// ---------- small vector helpers ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

function frame(axis) {
  const z = unit(axis);
  const ref = Math.abs(z[2]) < 0.999 ? [0, 0, 1] : [1, 0, 0];
  const x = unit(cross(ref, z));
  const y = cross(z, x);
  return { x, y, z };
}
const mat = (f, p) => [...f.x, 0, ...f.y, 0, ...f.z, 0, ...p, 1]; // column-major 4x4

/**
 * Builds every printed part.
 * @returns {{name:string, qty:number, note:string, manifold:any}[]}
 */
export function buildParts(wasm, params) {
  const { Manifold } = wasm;
  const p = { ...DEFAULTS, ...params };
  const problems = validate(p);
  if (problems.length) throw new Error(problems.join(' '));

  const R = p.baseWidth / 2;
  const THETA = Math.asin((R - DESIGN.hubFloorRadius) / p.legLength);
  const RF = DESIGN.hubFloorRadius * IN;
  const S = p.socketMm, S_SLIDE = p.socketMm + 0.5;
  const W = DESIGN.wallMm, D = DESIGN.socketDepthMm, SCREW = DESIGN.screwMm;
  const sinT = Math.sin(THETA), cosT = Math.cos(THETA);

  const bar = (p0, axis, length, w) =>
    Manifold.cube([w, w, length]).translate([-w / 2, -w / 2, 0]).transform(mat(frame(axis), p0));
  // Square tube with its four long outside edges cut off at 45 degrees (c = chamfer leg). 3 mm leaves
  // 2.5 mm of plastic between the chamfer and the socket's corner relief.
  const chamferBar = (p0, axis, length, w, c = 3) => {
    const h = w / 2;
    const oct = [[-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]];
    return new wasm.CrossSection([oct]).extrude(length).transform(mat(frame(axis), p0));
  };
  const cyl = (p0, axis, length, d, segs = 48, twist = 0) =>
    Manifold.cylinder(length, d / 2, d / 2, segs).rotate([0, 0, twist]).transform(mat(frame(axis), p0));
  const hexprism = (r, z0, z1) => Manifold.cylinder(z1 - z0, r, r, 6).translate([0, 0, z0]);
  const bigBox = (z0, z1) => Manifold.cube([2000, 2000, z1 - z0]).translate([-1000, -1000, z0]);
  const union = parts => Manifold.union(parts);
  const toFloor = m => m.translate([0, 0, -m.boundingBox().min[2]]);
  // square socket with round reliefs in the inside corners, so sharp-edged ripped strips seat fully
  const cav = (p0, axis, length, w) => {
    const f = frame(axis);
    const parts = [bar(p0, axis, length, w)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      parts.push(cyl(add(add(p0, mul(f.x, sx * w / 2)), mul(f.y, sy * w / 2)), axis, length, 2.0, 16, 11.25));
    return union(parts);
  };

  // Extruded 2D profile: x across, y toward `up` (made square to the axis), z along the axis.
  const prism = (poly, p0, axis, up, length) => {
    const z = unit(axis);
    const d = up[0] * z[0] + up[1] * z[1] + up[2] * z[2];
    const y = unit(sub(up, mul(z, d)));
    const x = cross(y, z);
    return new wasm.CrossSection([poly]).extrude(length).transform(mat({ x, y, z }, p0));
  };
  // Square with a roof on top, so the ceiling prints without supports.
  // phi = roof angle from vertical (45 = classic gable; smaller = steeper).
  // flat = half-width of a flat ridge that cuts off the point: a short bridge (2 x flat) the printer
  // spans easily, instead of a tall, sharp peak.
  const house = (hw, bottom, top, phi, flat = 0) => {
    const ridge = top + (hw - flat) / Math.tan(phi * Math.PI / 180);
    return flat > 0
      ? [[-hw, bottom], [hw, bottom], [hw, top], [flat, ridge], [-flat, ridge], [-hw, top]]
      : [[-hw, bottom], [hw, bottom], [hw, top], [0, ridge], [-hw, top]];
  };
  // Roof cavities get a 10 mm flat ceiling; the outside ridge sits one wall (W) above it, so the
  // roof stays at least W thick everywhere: outside flat half-width = RIDGE + W.
  const RIDGE = 5;
  const roofCav = (p0, axis, up, length, w, phi, flat = RIDGE) => {
    const parts = [prism(house(w / 2, -w / 2, w / 2, phi, flat), p0, axis, up, length)];
    // Diamond reliefs in the two bottom corners (45-degree faces, so they print cleanly), nudged
    // 0.1 mm into the corner so no vertex lands on a wall plane. The top corners open into the roof.
    const r = 1.2, o = 0.13;   // o also keeps the diamond tips off the 0.2 mm layer planes
    for (const sx of [-1, 1]) {
      const cx = sx * (w / 2 + o), cy = -(w / 2 + o);
      parts.push(prism([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], p0, axis, up, length));
    }
    return union(parts);
  };

  // ----- top hub: modelled upright, printed upside down -----
  function hub() {
    const TOP = 12;
    const tubes = [], cavs = [];
    for (let i = 0; i < 6; i++) {
      const a = (60 * i) * Math.PI / 180;
      const rhat = [Math.cos(a), Math.sin(a), 0];
      const floor = mul(rhat, RF);
      const d = [rhat[0] * sinT, rhat[1] * sinT, -cosT]; // down and outward along the leg
      tubes.push(bar(sub(floor, mul(d, 40)), d, 40 + D, S + 2 * W)); // runs past the hub top so nothing overhangs the bed in print
      cavs.push(cav(floor, d, D + 30, S));
    }
    const boss = Manifold.cylinder(25, 17, 17, 64).translate([0, 0, -45]); // takes a 1/4"-20 eye bolt
    // core: just big enough to join the six socket tubes (inner faces ~33 mm out) and wrap the post hole and cone
    let body = union([...tubes, hexprism(40, -20, TOP), boss]).intersect(bigBox(-500, TOP));
    // Eye bolt (1/4"-20 x 1") threads up into a captured 1/4"-20 nylon lock nut. The nut slides into a
    // hex-ended slot in the side of the boss; nothing breaks through into the star-post hole, so that hole's
    // ceiling is a solid disc the printer bridges (an open ring around a hole is a floating cantilever).
    const NUT_AF = 11.11 + 0.5, NUT_H = 8.3 + 0.5;          // 7/16" across flats, 0.328" nylon-insert height
    const nutZ = -42;                                         // 3 mm of plastic under the nut
    const nutTip = 11.11 / 2 / Math.cos(Math.PI / 6) + 0.1;  // end wall just past the nut's corner: nut stops centred
    const trap = union([
      // square-ended slot: the nut's corner stops at the end wall with the nut centred on the bolt, and the
      // slot is narrower than the nut's corner-to-corner width, so it can't spin while the bolt is tightened
      Manifold.cube([30 + nutTip, NUT_AF, NUT_H]).translate([-nutTip, -NUT_AF / 2, nutZ]),
      // Where the bolt passes the slot ceiling: a staggered opening instead of a round hole, so every
      // ceiling layer is a bridge anchored at both ends (no floating ring), and nothing needs drilling.
      // Layer 1 above the slot: a 6.8 mm strip wall to wall; layer 2 and up: a 6.8 mm square hole.
      Manifold.cube([6.8, NUT_AF, 0.5]).translate([-3.4, -NUT_AF / 2, nutZ - 0.2]),
      Manifold.cube([6.8, 6.8, 4.5]).translate([-3.4, -3.4, -46.4]),
    ]).rotate([0, 0, 30]);                                    // slot opens between two legs
    body = body
      .subtract(union(cavs))
      .subtract(cyl([0, 0, TOP - 21], [0, 0, 1], 22, 22.4))   // star post plug hole, 21 mm deep
      // 45-degree cone from the post hole down into the bolt hole: no flat ceiling anywhere in print
      .subtract(Manifold.cylinder(7.8, 3.4, 11.2, 64).translate([0, 0, TOP - 21 - 7.8]))
      .subtract(cyl([0, 0, nutZ + 1], [0, 0, 1], (TOP - 21 - 7.8 + 0.3) - (nutZ + 1), 6.8))   // above the nut, up to the cone
      .subtract(trap);
    return toFloor(body.rotate([180, 0, 0]));
  }

  // ----- base corners: foot socket leaning toward the centre (+y) -----
  // Arm sockets have 45-degree roofs with a 10 mm flat ridge (a short bridge), a 6 mm floor, and countersunk screw holes
  // from underneath: assemble the base upside down, screw up into the base pieces, flip it over.
  function corner(armSigns) {
    const FLOOR = 6.05, PHI = 45;   // 6.05 keeps the roof ridge (58.95) off the 0.2 mm layer planes
    const u = [0, sinT, cosT];
    const F = [0, 0, DESIGN.footFloorHeight * IN];
    const zc = FLOOR + S / 2;
    const up = [0, 0, 1];
    // foot tube runs down past the bed (trimmed at z = 0) so its tilted end never hangs in the air
    // no separate core: the arms start at the foot centre and overlap the foot tube, which joins them
    // Doorway corners sit where kids crawl in, so their foot tube's long outside corners are chamfered.
    const doorway = armSigns.length === 1;
    const parts = [(doorway ? chamferBar : bar)(sub(F, mul(u, 25)), u, 25 + D, S + 2 * W)];
    const cuts = [cav(F, u, D + 30, S)];
    const armFloor = DESIGN.armFloor * IN, DA = DESIGN.armDepthMm;
    // The arm starts at the foot centre, but the foot tube leans in toward the tree, so near the top the
    // arm's outer corner sticks out past the tube's back face as a pointed triangle. Every arm is trimmed
    // back to that face (0.3 mm inside it, so the faces never coincide); the cut slopes outward and up,
    // so it prints without supports.
    const back = [0, -cosT, sinT];   // outward normal of the foot tube's back face (square to the leg)
    const behind = Manifold.cube([2000, 2000, 1000]).translate([-1000, -1000, -1000])
      .transform(mat(frame(back), add(F, mul(back, S / 2 + W - 0.3))));
    for (const s of armSigns) {
      const a = [s * Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0];
      const arm = prism(house(S / 2 + W, -(S / 2 + FLOOR + 1), S / 2 + W, PHI, RIDGE + W), [0, 0, zc], a, up, armFloor + DA); // trimmed at the bed below
      parts.push(arm.intersect(behind));
      cuts.push(roofCav(add(mul(a, armFloor), [0, 0, zc]), a, up, DA + 10, S, PHI));
      const h = add(mul(a, armFloor + DA / 2), [0, 0, 0]);
      cuts.push(cyl(add(h, [0, 0, -1]), [0, 0, 1], FLOOR + 2, SCREW));                      // #8 clearance
      cuts.push(Manifold.cylinder(3.0, 4.6, 2.0, 32).translate([h[0], h[1], -0.5]));          // 82-degree countersink
    }
    return toFloor(union(parts).intersect(bigBox(0, 500)).subtract(union(cuts)));
  }

  // ----- crosspiece sleeves: slide over a front leg, level side socket -----
  // Printed with the leg channel vertical. The side socket gets a steep roof (35 degrees from
  // vertical, to allow for its tilt in print), and a solid foot fills the space under it down to the bed.
  // The side socket's axis tilts ~8 degrees in print, so a ridge parallel to it would be a sloped
  // ceiling that steps out 1.4 mm per layer. Instead the roof is cut level in print (a true bridge,
  // at most ~11 mm wide), and the outside top is cut level one wall (W) higher.
  function sleeve(sideSign) {
    const PHI = 35, CUT_DEPTH = 8;   // flat ceiling up to 2 x 8 x tan(35) = 11.2 mm wide
    const u = [0, sinT, cosT];
    const a = [sideSign * Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0];
    const floor = DESIGN.sleeveFloor * IN;
    const side = prism(house(S / 2 + W, -(S / 2 + W), S / 2 + W, PHI), [0, 0, 0], a, u, floor + 1.5 * IN);
    const n = [0, -cosT, sinT]; // outward, square to the leg
    const toPrint = m => m.rotate([THETA * 180 / Math.PI, 0, 0]).translate([0, 0, 35]);
    const roofP = toPrint(roofCav(mul(a, floor), a, u, 60, S, PHI, 0));
    const apex = roofP.intersect(toPrint(side)).boundingBox().max[2];
    const zCut = Math.round((apex - CUT_DEPTH) * 10) / 10 + 0.05;   // .x5 keeps the ceiling off the 0.2 mm layer planes
    const sideP = toPrint(side).intersect(bigBox(-500, zCut + W));
    const foot = Manifold.hull([sideP, sideP.translate([0, 0, -200])]).intersect(bigBox(0, 500));
    const cuts = union([toPrint(cav(mul(u, -80), u, 160, S_SLIDE)), roofP.intersect(bigBox(-500, zCut)),
                        toPrint(cyl(mul(u, -24), n, 40, SCREW))]);
    return toFloor(union([toPrint(bar(mul(u, -35), u, 70, S_SLIDE + 2 * W)), foot]).subtract(cuts));
  }

  // ----- star post: plug + cone (1" to 1/2") + rounded tip -----
  function starPost() {
    return union([
      Manifold.cylinder(20, 11.0, 11.0, 64),                            // plug: 20 mm into the hub
      Manifold.cylinder(1.5, 11.0, 12.5, 64).translate([0, 0, 20]),   // 45-degree shoulder, no ledge
      Manifold.cylinder(148.5, 12.5, 6.0, 64).translate([0, 0, 21.5]),
      Manifold.sphere(6.0, 48).translate([0, 0, 170]),
    ]);
  }

  // Clean-up so the float32 STL round-trip can't weld slivers into non-manifold edges.
  const clean = m => m.simplify(0.01);
  return [
    { name: 'top_hub', qty: 1, note: 'Print upside down as oriented. No supports.', manifold: clean(hub()) },
    { name: 'star_post', qty: 1, note: 'Standing, with a brim. 6+ walls.', manifold: clean(starPost()) },
    { name: 'base_corner_2arm', qty: 4, note: 'Flat as oriented. No supports.', manifold: clean(corner([1, -1])) },
    { name: 'doorway_corner_left', qty: 1, note: 'Flat as oriented. No supports.', manifold: clean(corner([-1])) },
    { name: 'doorway_corner_right', qty: 1, note: 'Flat as oriented. No supports.', manifold: clean(corner([1])) },
    { name: 'crosspiece_sleeve_left_leg', qty: 1, note: 'As oriented. No supports.', manifold: clean(sleeve(1)) },
    { name: 'crosspiece_sleeve_right_leg', qty: 1, note: 'As oriented. No supports.', manifold: clean(sleeve(-1)) },
  ];
}

/** Three short square rings around a chosen socket size, with 1-3 notches for telling them apart. */
export function buildFitTests(wasm, centreMm = DEFAULTS.socketMm) {
  const { Manifold } = wasm;
  const sizes = [centreMm - 0.5, centreMm, centreMm + 0.5].map(s => Math.round(s * 10) / 10);
  return sizes.map((inner, i) => {
    const o = inner + 6;
    let ring = Manifold.cube([o, o, 15]).translate([-o / 2, -o / 2, 0]);
    ring = ring.subtract(Manifold.cube([inner, inner, 20]).translate([-inner / 2, -inner / 2, -1]));
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      ring = ring.subtract(Manifold.cylinder(20, 1, 1, 16).translate([sx * inner / 2, sy * inner / 2, -1]));
    for (let k = 0; k <= i; k++)
      ring = ring.subtract(Manifold.cube([3, 10, 4]).translate([-o / 2 + 6 + k * 7, -o / 2 - 2, 12]));
    return { name: `fit_test_${inner.toFixed(1)}mm_${i + 1}notch`, qty: 1, note: 'Print all three first.', manifold: ring };
  });
}

/** Binary STL from a Manifold. */
export function toSTL(manifold) {
  const mesh = manifold.getMesh();
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  const nTri = tv.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  const header = 'walk-in teepee tree connector';
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, nTri, true);
  let o = 84;
  const v = i => [vp[i * np], vp[i * np + 1], vp[i * np + 2]];
  for (let t = 0; t < nTri; t++) {
    const a = v(tv[3 * t]), b = v(tv[3 * t + 1]), c = v(tv[3 * t + 2]);
    let n = cross(sub(b, a), sub(c, a));
    const l = Math.hypot(...n) || 1; n = mul(n, 1 / l);
    for (const x of [...n, ...a, ...b, ...c]) { dv.setFloat32(o, x, true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

/** Rough filament estimate in grams (PETG, 4 walls, 20% gyroid infill, 4 top/bottom layers). */
export const gramsFor = manifold => manifold.volume() / 1000 * 1.27 * 0.49;   // 4 walls, 20% gyroid
