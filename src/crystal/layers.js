/**
 * Atomic layers of a Miller-plane family: spacing, 2D net, interlayer shift, stacking period
 * and how one conventional cube cuts the layers. Used by the "3D cell ⇄ 2D net" animation.
 *
 * Coordinates are in units of a. A point X lies on the layer with slice value s = h·X.
 */

import { latticeSites } from "./lattice.js";
import {
  add,
  angleBetween,
  cross,
  dot,
  extendedGcd,
  gcdOf,
  norm,
  normalize,
  scale,
  subtract,
} from "./math.js";
import { planeBoxPolygon, planeInfo } from "./planes.js";
import { layerOffset, surfaceCell } from "./surfaces.js";

const EPS = 1e-9;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Divide indices by their greatest common divisor; (0 0 0) is rejected. */
export function reduceIndices(hkl) {
  const g = gcdOf(hkl);
  if (!g) {
    throw new Error("(0 0 0) is not a plane.");
  }
  return hkl.map((value) => value / g);
}

/** Miller indices for text: (001), (111) for small non-negative indices, else (1 −1 0), (12 3 1). */
export const millerLabel = (hkl) =>
  hkl.every((value) => value >= 0 && value < 10)
    ? hkl.join("")
    : hkl.map((value) => String(value).replace("-", "−")).join(" ");

/** Registry letter of layer j for stacking period N: A, B, C, … (then A′, B′, … past Z). */
export function layerLetter(j, period) {
  const index = ((j % period) + period) % period;
  return LETTERS[index % 26] + "′".repeat(Math.floor(index / 26));
}

/** Coordinates (α, β) of an in-plane vector in the basis t1, t2. */
function inBasis(vector, t1, t2) {
  const g11 = dot(t1, t1);
  const g22 = dot(t2, t2);
  const g12 = dot(t1, t2);
  const det = g11 * g22 - g12 * g12;
  return [
    (dot(vector, t1) * g22 - dot(vector, t2) * g12) / det,
    (dot(vector, t2) * g11 - dot(vector, t1) * g12) / det,
  ];
}

const fraction = (value) => {
  const f = value - Math.floor(value);
  return f > 1 - 1e-9 ? 0 : f;
};

/**
 * Centered cell of the net, if it has one: perpendicular lattice vectors u, v spanning twice
 * the primitive area with a lattice point at the center (e.g. the a × a square of (001), the
 * a/√2 × a√(3/2) rectangle of (111)). Returns null for primitive-rectangular and oblique nets.
 */
function centeredCell(t1, t2) {
  let best = null;
  for (let i1 = -3; i1 <= 3; i1++) {
    for (let j1 = -3; j1 <= 3; j1++) {
      for (let i2 = -3; i2 <= 3; i2++) {
        for (let j2 = -3; j2 <= 3; j2++) {
          const det = i1 * j2 - j1 * i2;
          if (det !== 2 || (i1 + i2) % 2 || (j1 + j2) % 2) {
            continue;
          }
          const u = add(scale(t1, i1), scale(t2, j1));
          const v = add(scale(t1, i2), scale(t2, j2));
          if (Math.abs(dot(u, v)) > 1e-9) {
            continue;
          }
          const size = norm(u) + norm(v);
          if (!best || size < best.size - 1e-9) {
            best = { u, v, size };
          }
        }
      }
    }
  }
  return best && { u: best.u, v: best.v, atoms: 2 };
}

/** Name of the 2D Bravais net. */
function netType(cell, centered) {
  const [l1, l2] = [norm(cell.t1), norm(cell.t2)];
  const angle = angleBetween(cell.t1, cell.t2);
  const equal = Math.abs(l1 - l2) < 1e-9;
  if (equal && Math.abs(angle - 90) < 1e-6) return "square";
  if (equal && (Math.abs(angle - 60) < 1e-6 || Math.abs(angle - 120) < 1e-6)) return "triangular";
  if (Math.abs(angle - 90) < 1e-6) return "rectangular";
  if (centered) return "centered-rectangular";
  return "oblique";
}

/**
 * Everything the layer animation needs for a plane family, computed from the indices:
 * reduced (hkl), normal, layer step Δs, spacing d, primitive net t1, t2 (Gauss-reduced, the
 * same frame as the Surface net view), the centered cell if any, the interlayer shift and
 * the stacking period N.
 */
export function layerGeometry(hkl, a = 1) {
  const n = reduceIndices(hkl);
  const info = planeInfo(n, 1);
  const cell = surfaceCell(n, 1);
  const normal = normalize(n);
  const step = info.step;
  const d = info.gap;

  // Interlayer shift: a lattice vector reaching the next layer, projected into the plane and
  // reduced into the primitive cell.
  const up = layerOffset(n, 1);
  const inPlane = subtract(up, scale(normal, dot(up, normal)));
  const [f1, f2] = inBasis(inPlane, cell.t1, cell.t2).map(fraction);
  // Shortest in-plane representative of the shift (the arrow drawn between layers).
  let shift = null;
  let shiftFractions = null;
  for (const i of [0, -1]) {
    for (const k of [0, -1]) {
      const candidate = add(scale(cell.t1, f1 + i), scale(cell.t2, f2 + k));
      if (!shift || norm(candidate) < norm(shift) - 1e-12) {
        shift = candidate;
        shiftFractions = [f1 + i, f2 + k];
      }
    }
  }

  // Stacking period: the first j for which j shifts add up to a net vector.
  let period = 1;
  while (
    period < 5000 &&
    !(
      Math.abs(Math.round(period * f1) - period * f1) < 1e-7 &&
      Math.abs(Math.round(period * f2) - period * f2) < 1e-7
    )
  ) {
    period++;
  }

  const centered = centeredCell(cell.t1, cell.t2);
  const area = cell.area;
  return {
    input: hkl,
    hkl: n,
    a,
    normal,
    step,
    d,
    period,
    repeat: info.period,
    t1: cell.t1,
    t2: cell.t2,
    lengths: [norm(cell.t1), norm(cell.t2)],
    angle: angleBetween(cell.t1, cell.t2),
    area,
    density: 1 / area,
    coordination: cell.coordination,
    neighborDistance: Math.min(...cell.neighbors.map(norm)),
    frame: { e1: cell.ex, e2: cell.ey, e3: normal },
    shift,
    shiftFractions,
    centered,
    type: netType(cell, centered),
  };
}

/** In-plane coordinates (along e1, e2) of a point. */
export const planeCoords = (geometry, point) => [
  dot(point, geometry.frame.e1),
  dot(point, geometry.frame.e2),
];

/** Slice value s = h·X and layer index j = s / Δs of a point. */
export const sliceOf = (geometry, point) => dot(geometry.hkl, point);
export const layerOf = (geometry, point) => Math.round(sliceOf(geometry, point) / geometry.step);

/**
 * A conventional cube placed so that layer `layer` cuts through its middle: the integer
 * translation T of the unit cube and the layers it contains.
 */
export function cubeAround(geometry, layer) {
  const n = geometry.hkl;
  const sMin = n.reduce((sum, h) => sum + Math.min(0, h), 0);
  const sMax = n.reduce((sum, h) => sum + Math.max(0, h), 0);
  const target = layer * geometry.step;
  const shift = Math.round(target - (sMin + sMax) / 2);
  // Integer vector T with h·T = shift (prefer a single axis).
  let origin = null;
  const order = [0, 1, 2].sort((p, q) => Math.abs(n[q]) - Math.abs(n[p]));
  for (const axis of order) {
    if (n[axis] && shift % n[axis] === 0) {
      origin = [0, 0, 0];
      origin[axis] = shift / n[axis];
      break;
    }
  }
  if (!origin) {
    const [g12, x1, y1] = extendedGcd(n[0], n[1]);
    const [, x2, y2] = extendedGcd(g12, n[2]);
    origin = [x1 * x2 * shift, y1 * x2 * shift, y2 * shift];
  }
  origin = origin.map((value) => value + 0); // normalize -0
  const balls = latticeSites([1, 1, 1]).map((site) => {
    const p = add(site.p, origin);
    return { id: site.id, p, layer: layerOf(geometry, p) };
  });
  const layers = [...new Set(balls.map((ball) => ball.layer))].sort((x, y) => x - y);
  const slices = layers.map((j) => ({
    layer: j,
    count: balls.filter((ball) => ball.layer === j).length,
    polygon: planeBoxPolygon(n, j * geometry.step - dot(n, origin), [1, 1, 1]).map((p) =>
      add(p, origin),
    ),
  }));
  return { origin, center: add(origin, [0.5, 0.5, 0.5]), balls, layers, slices };
}

/** True when a point lies in the closed cube [origin, origin + 1]. */
export const inCube = (cube, point) =>
  point.every(
    (value, axis) => value > cube.origin[axis] - EPS && value < cube.origin[axis] + 1 + EPS,
  );

/**
 * Lattice points of layer j within in-plane distance `radius` of the normal line through
 * `center`.
 */
export function layerPoints(geometry, layer, center, radius) {
  const base = layerOffset(geometry.hkl, layer);
  const toCenter = subtract(center, base);
  const inPlane = subtract(toCenter, scale(geometry.normal, dot(toCenter, geometry.normal)));
  const [alpha, beta] = inBasis(inPlane, geometry.t1, geometry.t2);
  const width = geometry.area / Math.max(...geometry.lengths);
  const reach = Math.ceil(radius / width) + 2;
  const points = [];
  for (let i = Math.floor(alpha) - reach; i <= Math.ceil(alpha) + reach; i++) {
    for (let k = Math.floor(beta) - reach; k <= Math.ceil(beta) + reach; k++) {
      const p = add(base, add(scale(geometry.t1, i), scale(geometry.t2, k)));
      const offset = subtract(p, center);
      const planar = subtract(offset, scale(geometry.normal, dot(offset, geometry.normal)));
      if (norm(planar) <= radius + EPS) {
        points.push({ id: `L${layer}:${i}:${k}`, p, layer, planar: norm(planar) });
      }
    }
  }
  return points;
}

/**
 * Layers for the "Build" animation: the stack j0 … j0 + N (capped at `maxLayers`) plus every
 * layer the conventional cube needs, each as a patch of radius `radius` around the cube.
 */
export function stackPlan(geometry, layer, { maxLayers = 12, radius } = {}) {
  const cube = cubeAround(geometry, layer);
  const shown = Math.min(geometry.period, maxLayers);
  const stack = Array.from({ length: shown + 1 }, (_, i) => layer + i);
  const layers = [...new Set([...stack, ...cube.layers])].sort((x, y) => x - y);
  const r = radius ?? Math.min(6, Math.max(1.2, 2.2 * Math.max(...geometry.lengths)));
  const points = layers.flatMap((j) =>
    layerPoints(geometry, j, cube.center, r).map((point) => ({
      ...point,
      inCube: inCube(cube, point.p),
    })),
  );
  return { cube, stack, layers, radius: r, points };
}

/** The lattice point of layer j closest to the normal line through `center`. */
export function nearestLayerPoint(geometry, layer, center) {
  const points = layerPoints(geometry, layer, center, Math.max(...geometry.lengths) * 2);
  return points.reduce((best, point) => (point.planar < best.planar ? point : best)).p;
}

/** Number of distinct spots when the cube's balls are projected along the normal ("picture B"). */
export function projectedSpots(geometry, balls) {
  const spots = [];
  for (const ball of balls) {
    const xy = planeCoords(geometry, ball.p);
    if (!spots.some((spot) => Math.hypot(spot[0] - xy[0], spot[1] - xy[1]) < 1e-6)) {
      spots.push(xy);
    }
  }
  return spots.length;
}

/**
 * Is a cube-cut polygon itself a 2D cell of the net? A cell must be a parallelogram whose edges
 * are net translations. Returns { isCell, atoms, shape } where atoms counts lattice points per
 * cell for valid cells.
 */
export function classifyCut(geometry, polygon) {
  const shape =
    ["point", "segment", "line", "triangle", "quadrilateral", "pentagon", "hexagon"][
      polygon.length
    ] ?? `${polygon.length}-gon`;
  if (polygon.length !== 4) {
    return { isCell: false, atoms: 0, shape };
  }
  const [p0, p1, p2, p3] = polygon;
  const u = subtract(p1, p0);
  const v = subtract(p3, p0);
  const parallelogram = norm(subtract(subtract(p2, p1), v)) < 1e-7;
  const isTranslation = (w) =>
    inBasis(w, geometry.t1, geometry.t2).every((x) => Math.abs(x - Math.round(x)) < 1e-7);
  if (!parallelogram || !isTranslation(u) || !isTranslation(v)) {
    return { isCell: false, atoms: 0, shape };
  }
  const atoms = Math.round(norm(cross(u, v)) / geometry.area);
  return {
    isCell: true,
    atoms,
    shape:
      Math.abs(dot(u, v)) < 1e-9
        ? Math.abs(norm(u) - norm(v)) < 1e-9
          ? "square"
          : "rectangle"
        : "parallelogram",
  };
}

/**
 * Atoms counted in a cell with corner, edge and interior weights (¼, ½, 1), for captions such
 * as "4 corners × ¼ + 1 center = 2".
 */
export function cellCount(geometry, origin, u, v) {
  const tally = { corner: 0, edge: 0, inside: 0 };
  const reach = 4;
  for (let i = -reach; i <= reach; i++) {
    for (let k = -reach; k <= reach; k++) {
      const p = add(origin, add(scale(geometry.t1, i), scale(geometry.t2, k)));
      const [x, y] = inBasis(subtract(p, origin), u, v);
      const onX = Math.abs(x) < 1e-7 || Math.abs(x - 1) < 1e-7;
      const onY = Math.abs(y) < 1e-7 || Math.abs(y - 1) < 1e-7;
      if (x < -1e-7 || x > 1 + 1e-7 || y < -1e-7 || y > 1 + 1e-7) continue;
      if (onX && onY) tally.corner++;
      else if (onX || onY) tally.edge++;
      else tally.inside++;
    }
  }
  return { ...tally, total: tally.corner / 4 + tally.edge / 2 + tally.inside };
}
