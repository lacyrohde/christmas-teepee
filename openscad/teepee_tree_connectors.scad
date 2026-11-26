// Walk-in teepee tree: printed connectors (OpenSCAD 2021.01+, MakerWorld Parametric Model Maker)
// Same geometry as docs/parts.js. Inputs in inches except the socket size (mm).
// Planner with cut list and shopping list: https://lacyrohde.github.io/christmas-teepee/

/* [Your measurements] */
// Leg length, end to end (in). Measure your boards: "8 ft" is often 96 to 96.25.
leg_length_in = 96; // [72:0.25:120]
// Base width, corner to corner at the feet (in)
base_width_in = 60; // [48:1:84]

/* [Fit] */
// Square socket size (mm). Print the fit-test rings and use the one that fits your wood.
socket_mm = 39.1; // [37.5:0.1:40.5]

/* [Output] */
// Which part to make. "all" lays out one of each; print the base corner 4 times.
part = "all"; // [all, top_hub, star_post, base_corner_2arm, doorway_corner_left, doorway_corner_right, crosspiece_sleeve_left_leg, crosspiece_sleeve_right_leg, fit_test_rings]

/* [Hidden] */
IN = 25.4;
HUB_FLOOR_R = 2.2 * IN;
FOOT_FLOOR_Z = 0.5 * IN;
ARM_FLOOR = 1.5 * IN;
SLEEVE_FLOOR = 1.42 * IN;
D = 50.8;        // socket depth: hub and leg feet
DA = 38.1;       // base-arm socket depth (1.5"): the screws hold the base pieces
W = 4;           // wall
SCREW = 4.5;     // #8 screw clearance
S = socket_mm;
S_SLIDE = socket_mm + 0.5;
R_IN = base_width_in / 2;
THETA = asin((R_IN - 2.2) / leg_length_in);
sT = sin(THETA); cT = cos(THETA);

assert(THETA <= 30, str("Legs would lean ", THETA, " degrees; keep it under 30: longer legs or a narrower base."));
echo(str("Leg lean: ", THETA, " degrees"));

function unit(v) = v / norm(v);
function basis(axis) =
  let(z = unit(axis), ref = abs(z[2]) < 0.999 ? [0, 0, 1] : [1, 0, 0], x = unit(cross(ref, z)), y = cross(z, x)) [x, y, z];
function M(axis, p) = let(b = basis(axis))
  [[b[0][0], b[1][0], b[2][0], p[0]], [b[0][1], b[1][1], b[2][1], p[1]], [b[0][2], b[1][2], b[2][2], p[2]], [0, 0, 0, 1]];

module bar(p0, axis, len, w) { multmatrix(M(axis, p0)) translate([-w / 2, -w / 2, 0]) cube([w, w, len]); }
// square tube with its four long outside edges chamfered (c = chamfer leg; 3 mm leaves 2.5 mm outside the socket's corner relief)
module chamfer_bar(p0, axis, len, w, c = 3) {
  h = w / 2;
  multmatrix(M(axis, p0)) linear_extrude(height = len)
    polygon([[-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]]);
}
module cyl(p0, axis, len, d, fn = 48) { multmatrix(M(axis, p0)) cylinder(h = len, d = d, $fn = fn); }
// square socket with round reliefs in the inside corners
module cav(p0, axis, len, w) {
  multmatrix(M(axis, p0)) {
    translate([-w / 2, -w / 2, 0]) cube([w, w, len]);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * w / 2, sy * w / 2, 0]) rotate([0, 0, 11.25]) cylinder(h = len, d = 2, $fn = 16);
  }
}
function M2(axis, up, p) = let(z = unit(axis), y = unit(up - (up * z) * z), x = cross(y, z))
  [[x[0], y[0], z[0], p[0]], [x[1], y[1], z[1], p[1]], [x[2], y[2], z[2], p[2]], [0, 0, 0, 1]];
// square with a roof (phi = roof angle from vertical) so sideways sockets print without supports;
// flat = half-width of a flat ridge that cuts off the point (a short, easy bridge)
function house(hw, bottom, top, phi, flat = 0) = let(ridge = top + (hw - flat) / tan(phi))
  flat > 0 ? [[-hw, bottom], [hw, bottom], [hw, top], [flat, ridge], [-flat, ridge], [-hw, top]]
           : [[-hw, bottom], [hw, bottom], [hw, top], [0, ridge], [-hw, top]];
RIDGE = 5;   // roof cavities get a 10 mm flat ceiling; outside ridge half-width = RIDGE + W keeps the roof W thick
module prism(poly, p0, axis, up, len) { multmatrix(M2(axis, up, p0)) linear_extrude(height = len) polygon(poly); }
module roof_cav(p0, axis, up, len, w, phi, flat = RIDGE) {
  r = 1.2; o = 0.13;   // diamond reliefs in the bottom corners; o keeps tips off the 0.2 mm layer planes
  multmatrix(M2(axis, up, p0)) linear_extrude(height = len) {
    polygon(house(w / 2, -w / 2, w / 2, phi, flat));
    for (sx = [-1, 1]) let(cx = sx * (w / 2 + o), cy = -(w / 2 + o)) polygon([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]);
  }
}
module hexprism(r, z0, z1) { translate([0, 0, z0]) cylinder(h = z1 - z0, r = r, $fn = 6); }
module above(z) { translate([-1000, -1000, z]) cube([2000, 2000, 1000]); }
module below(z) { translate([-1000, -1000, z - 1000]) cube([2000, 2000, 1000]); }
module below(z) { translate([-1000, -1000, z - 1000]) cube([2000, 2000, 1000]); }

// ---------- top hub (modelled upright, printed upside down) ----------
module top_hub() {
  TOP = 12;
  NUT_AF = 11.11 + 0.5; NUT_H = 8.3 + 0.5; NUT_Z = -42;   // 7/16" across flats, 0.328" nylon-insert nut
  NUT_TIP = 11.11 / 2 / cos(30) + 0.1;
  translate([0, 0, TOP]) rotate([180, 0, 0]) difference() {
    intersection() {
      union() {
        for (i = [0:5]) let(a = 60 * i, r = [cos(a), sin(a), 0], fl = r * HUB_FLOOR_R, d = [r[0] * sT, r[1] * sT, -cT])
          bar(fl - d * 40, d, 40 + D, S + 2 * W);   // runs past the hub top: nothing overhangs the bed in print
        hexprism(40, -20, TOP);   // core: just enough to join the tubes and wrap the post hole
        translate([0, 0, -45]) cylinder(h = 25, r = 17, $fn = 64);   // boss with a captured nut for a 1/4"-20 eye bolt
      }
      below(TOP);
    }
    for (i = [0:5]) let(a = 60 * i, r = [cos(a), sin(a), 0], fl = r * HUB_FLOOR_R, d = [r[0] * sT, r[1] * sT, -cT])
      cav(fl, d, D + 30, S);
    cyl([0, 0, TOP - 21], [0, 0, 1], 22, 22.4, 64);                                   // star post plug hole
    translate([0, 0, TOP - 21 - 7.8]) cylinder(h = 7.8, r1 = 3.4, r2 = 11.2, $fn = 64);   // 45-degree cone, no flat ceiling
    cyl([0, 0, NUT_Z + 1], [0, 0, 1], (TOP - 21 - 7.8 + 0.3) - (NUT_Z + 1), 6.8);      // bolt clearance above the nut
    // captured 1/4"-20 nylon lock nut: square-ended side slot; staggered opening where the bolt passes the
    // slot ceiling (strip, then square) so every ceiling layer is an anchored bridge
    rotate([0, 0, 30]) {
      translate([-NUT_TIP, -NUT_AF / 2, NUT_Z]) cube([30 + NUT_TIP, NUT_AF, NUT_H]);
      translate([-3.4, -NUT_AF / 2, NUT_Z - 0.2]) cube([6.8, NUT_AF, 0.5]);
      translate([-3.4, -3.4, -46.4]) cube([6.8, 6.8, 4.5]);
    }
  }
}

// ---------- base corners ----------
// Arm sockets: 45-degree roofs with a 10 mm flat ridge, 6.05 mm floor, countersunk #8 holes from underneath.
module corner(signs) {
  FLOOR = 6.05; PHI = 45;
  u = [0, sT, cT];
  F = [0, 0, FOOT_FLOOR_Z];
  zc = FLOOR + S / 2;
  difference() {
    intersection() {
      union() {
        // doorway corners (one arm) sit where kids crawl in, so their foot tube gets chamfered corners; every arm is
        // trimmed back to the leaning tube's back face (0.3 mm inside it) so its outer corner can't stick out as a point
        doorway = len(signs) == 1;
        if (doorway) chamfer_bar(F - u * 25, u, 25 + D, S + 2 * W);     // foot tube runs below the bed, trimmed at z = 0
        else bar(F - u * 25, u, 25 + D, S + 2 * W);
        for (s = signs) intersection() {
          prism(house(S / 2 + W, -(S / 2 + FLOOR + 1), S / 2 + W, PHI, RIDGE + W), [0, 0, zc], [s * sin(60), cos(60), 0], [0, 0, 1], ARM_FLOOR + DA);
          multmatrix(M([0, -cT, sT], F + [0, -cT, sT] * (S / 2 + W - 0.3))) translate([-1000, -1000, -1000]) cube([2000, 2000, 1000]);
        }
      }
      above(0);
    }
    cav(F, u, D + 30, S);
    for (s = signs) let(a = [s * sin(60), cos(60), 0], h = a * (ARM_FLOOR + DA / 2)) {
      roof_cav(a * ARM_FLOOR + [0, 0, zc], a, [0, 0, 1], DA + 10, S, PHI);
      cyl(h + [0, 0, -1], [0, 0, 1], FLOOR + 2, SCREW);
      translate([h[0], h[1], -0.5]) cylinder(h = 3, r1 = 4.6, r2 = 2.0, $fn = 32);   // 82-degree countersink
    }
  }
}

// ---------- crosspiece sleeves ----------
// Printed with the leg channel vertical; side socket roof 35 degrees from vertical; solid foot under it.
// The side socket tilts ~8 degrees in print, so its roof is cut level in print (a flat bridge up to
// ~11 mm wide) instead of with a ridge parallel to the socket; the outside top is cut level W higher.
module to_print() { translate([0, 0, 35]) rotate([THETA, 0, 0]) children(); }
module sleeve_side(side) {
  prism(house(S / 2 + W, -(S / 2 + W), S / 2 + W, 35), [0, 0, 0], [side * sin(60), cos(60), 0], [0, sT, cT], SLEEVE_FLOOR + 1.5 * IN);
}
function rotx(t, p) = [p[0], p[1] * cos(t) - p[2] * sin(t), p[1] * sin(t) + p[2] * cos(t)];
// height in print of the pointed roof's apex where it meets the end of the side tube
function sleeve_apex(side) = let(a = [side * sin(60), cos(60), 0], u = [0, sT, cT], y = unit(u - (u * a) * a),
  ry = S / 2 + (S / 2) / tan(35))
  max([for (t = [SLEEVE_FLOOR, SLEEVE_FLOOR + 1.5 * IN]) rotx(THETA, a * t + y * ry)[2] + 35]);
module sleeve(side) {
  u = [0, sT, cT];
  a = [side * sin(60), cos(60), 0];
  n = [0, -cT, sT];
  zc = round((sleeve_apex(side) - 8) * 10) / 10 + 0.05;   // .x5 keeps the ceiling off the 0.2 mm layer planes
  difference() {
    union() {
      to_print() bar(u * -35, u, 70, S_SLIDE + 2 * W);
      // the hull already contains the side tube; unioning it again leaves coincident faces (non-manifold edges)
      intersection() {
        hull() {
          intersection() { to_print() sleeve_side(side); below(zc + W); }
          translate([0, 0, -200]) intersection() { to_print() sleeve_side(side); below(zc + W); }
        }
        above(0);
      }
    }
    to_print() cav(u * -80, u, 160, S_SLIDE);
    intersection() { to_print() roof_cav(a * SLEEVE_FLOOR, a, u, 60, S, 35, 0); below(zc); }
    to_print() cyl(u * -24, n, 40, SCREW);
  }
}

// ---------- star post ----------
module star_post() {
  cylinder(h = 20, r = 11, $fn = 64);                                         // plug: 20 mm into the hub
  translate([0, 0, 20]) cylinder(h = 1.5, r1 = 11, r2 = 12.5, $fn = 64);     // 45-degree shoulder
  translate([0, 0, 21.5]) cylinder(h = 148.5, r1 = 12.5, r2 = 6, $fn = 64);
  translate([0, 0, 170]) sphere(r = 6, $fn = 48);
}

// ---------- fit-test rings (0.5 mm apart; 1, 2, 3 notches) ----------
module fit_test_rings() {
  for (i = [0:2]) let(inner = S - 0.5 + 0.5 * i, o = inner + 6) translate([i * 60, 0, 0]) difference() {
    translate([-o / 2, -o / 2, 0]) cube([o, o, 15]);
    cav([0, 0, -1], [0, 0, 1], 20, inner);
    for (k = [0:i]) translate([-o / 2 + 6 + k * 7, -o / 2 - 2, 12]) cube([3, 10, 4]);
  }
}

module make(p) {
  if (p == "top_hub") top_hub();
  else if (p == "star_post") star_post();
  else if (p == "base_corner_2arm") corner([1, -1]);
  else if (p == "doorway_corner_left") corner([-1]);
  else if (p == "doorway_corner_right") corner([1]);
  else if (p == "crosspiece_sleeve_left_leg") sleeve(1);
  else if (p == "crosspiece_sleeve_right_leg") sleeve(-1);
  else if (p == "fit_test_rings") fit_test_rings();
}

if (part == "all") {
  // one of each, spaced apart; in Bambu Studio use "Split to objects", then Arrange
  make("top_hub");
  translate([160, 0, 0]) make("star_post");
  translate([360, 0, 0]) make("base_corner_2arm");
  translate([0, 230, 0]) make("doorway_corner_left");
  translate([190, 230, 0]) make("doorway_corner_right");
  translate([360, 230, 0]) make("crosspiece_sleeve_left_leg");
  translate([620, 230, 0]) make("crosspiece_sleeve_right_leg");
} else make(part);
