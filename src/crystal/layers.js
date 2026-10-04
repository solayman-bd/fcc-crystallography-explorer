/**
 * Atomic layers of a Miller-plane family in SC, BCC, FCC or HCP: spacing, 2D net, interlayer
 * shifts, stacking period and how one conventional cell cuts the layers. Used by the Cell ⇄ Net
 * animations.
 *
 * Coordinates are Cartesian, in units of a. G is the plane normal in reciprocal units, so the
 * slice value s = G·X is hX + kY + lZ for the cubic structures (h·f₁ + k·f₂ + l·f₃ in the
 * fractional coordinates of HCP). A point lies on layer j when its s equals s_j.
 *
 * A structure is a Bravais lattice plus a basis. Lattice points fill layers Δs apart; basis atoms
 * whose s differs by a multiple of Δs share those layers, otherwise they form extra layers in
 * between (HCP (0001): A layers at s = 0, 1, 2…, B layers at s = ½, 3/2…).
 */

import {
  add,
  angleBetween,
  cross,
  dot,
  extendedGcd,
  gcdOf,
  norm,
  normalize,
  orthonormalFrame,
  scale,
  subtract,
} from "./math.js";
import { planeLevel } from "./planes.js";
import { combine, coordinatesIn, millerBravais, structureOf } from "./structures.js";
import { gaussReduce, integerKernel } from "./surfaces.js";

const EPS = 1e-9;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PERIOD_LIMIT = 20000;

const resolve = (structure) =>
  typeof structure === "string" || !structure ? structureOf(structure) : structure;

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

/** Plane indices for text: (hkl) for the cubic structures, (h k i l) for HCP. */
export const planeLabel = (hkl, structure = "fcc") =>
  millerLabel(resolve(structure).hexagonal ? millerBravais(hkl) : hkl);

const letterOf = (index) => LETTERS[index % 26] + "′".repeat(Math.floor(index / 26));

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

/** value mod m in [0, m), with values within 1e-9 of a multiple of m snapped to 0. */
const residue = (value, m) => {
  const r = value - Math.floor(value / m) * m;
  return r < 1e-9 || r > m - 1e-9 ? 0 : r;
};

/** Component of a vector in the layer plane. */
const inPlaneOf = (normal, vector) => subtract(vector, scale(normal, dot(vector, normal)));

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
function netType(t1, t2, centered) {
  const [l1, l2] = [norm(t1), norm(t2)];
  const angle = angleBetween(t1, t2);
  const equal = Math.abs(l1 - l2) < 1e-9;
  if (equal && Math.abs(angle - 90) < 1e-6) return "square";
  if (equal && (Math.abs(angle - 60) < 1e-6 || Math.abs(angle - 120) < 1e-6)) return "triangular";
  if (Math.abs(angle - 90) < 1e-6) return "rectangular";
  if (centered) return "centered-rectangular";
  return "oblique";
}

/** A lattice point with s = J·Δs: a Bézout solution of q·m = g·J in primitive coordinates. */
function latticePoint(structure, q, J) {
  const [g12, x1, y1] = extendedGcd(q[0], q[1]);
  const [, x2, y2] = extendedGcd(g12, q[2]);
  return combine(structure.primitive, [x1 * x2 * J, y1 * x2 * J, y2 * J]);
}

/** Slice value s_j of layer j. */
export function layerS(geometry, j) {
  const M = geometry.offsets.length;
  const J = Math.floor(j / M);
  return J * geometry.step + geometry.offsets[j - J * M];
}

/** Height of layer j along the unit normal (units of a). */
export const layerHeight = (geometry, j) => layerS(geometry, j) / geometry.gNorm;

/** One atom of layer j per basis atom in it; the layer is these seeds plus the 2D net. */
function layerSeeds(geometry, j) {
  const { structure, lattice, step, sigma } = geometry;
  const M = geometry.offsets.length;
  const s = layerS(geometry, j);
  return geometry.classes[j - Math.floor(j / M) * M].map((b) =>
    add(
      latticePoint(structure, lattice.q, Math.round((s - sigma[b]) / step)),
      structure.basisCartesian[b],
    ),
  );
}

/** Shortest in-plane representative of an offset modulo the net, with its t1, t2 fractions. */
function shortestShift(vector, t1, t2) {
  const [f1, f2] = inBasis(vector, t1, t2).map(fraction);
  let shift = null;
  let fractions = null;
  for (const i of [0, -1]) {
    for (const k of [0, -1]) {
      const candidate = add(scale(t1, f1 + i), scale(t2, f2 + k));
      if (!shift || norm(candidate) < norm(shift) - 1e-12) {
        shift = candidate;
        fractions = [f1 + i, f2 + k];
      }
    }
  }
  return { shift, fractions };
}

/** Shortest lattice vector along the normal (found independently of the layer period). */
function normalRepeat(structure, normal) {
  const u = coordinatesIn(structure.primitive, normal);
  const largest = u.reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), 0);
  const w = u.map((value) => value / largest);
  for (let K = 1; K <= PERIOD_LIMIT; K++) {
    const m = w.map((value) => value * K);
    if (m.every((value) => Math.abs(value - Math.round(value)) < 1e-7)) {
      return norm(combine(structure.primitive, m.map(Math.round)));
    }
  }
  return Infinity;
}

/**
 * Everything the layer animations need for a plane family of a structure, computed from the
 * indices: reduced (hkl), normal, layer step Δs and offsets, spacings, primitive net t1, t2
 * (Gauss-reduced, the same frame as the Surface net view for FCC), the centered cell if any, the
 * interlayer shifts and the stacking period N.
 */
export function layerGeometry(hkl, a = 1, structure = "fcc") {
  const S = resolve(structure);
  const n = reduceIndices(hkl);
  const G = combine(S.reciprocal, n);
  const gNorm = norm(G);
  const normal = normalize(G);

  // Lattice layers: s(Σ mᵢpᵢ) = q·m / D, so they lie Δs = g/D apart.
  const q = S.primitiveFractional.map((p) => Math.round(dot(p, n) * S.denominator));
  const g = gcdOf(q);
  const step = g / S.denominator;

  // The in-plane lattice: an integer kernel of q, Gauss-reduced.
  const [k1, k2] = integerKernel(q);
  const [t1, t2, m1, m2] = gaussReduce(
    combine(S.primitive, k1),
    combine(S.primitive, k2),
    k1,
    k2,
    G,
  );

  // Basis atoms sort into layer classes by their slice value modulo Δs.
  const sigma = S.basis.map((f) => dot(n, f));
  const residues = sigma.map((value) => residue(value, step));
  const offsets = [];
  for (const r of residues) {
    if (!offsets.some((o) => Math.abs(o - r) < 1e-9)) offsets.push(r);
  }
  offsets.sort((x, y) => x - y);
  const classes = offsets.map((o) =>
    S.basis.map((_, b) => b).filter((b) => Math.abs(residues[b] - o) < 1e-9),
  );
  const M = offsets.length;

  const geometry = {
    structure: S,
    input: hkl,
    hkl: n,
    label: planeLabel(n, S),
    a,
    G,
    gNorm,
    normal,
    step,
    lattice: { q, g, D: S.denominator },
    offsets,
    classes,
    sigma,
    layersPerStep: M,
    t1,
    t2,
    m1,
    m2,
  };

  // Lattice shift: from one lattice layer to the next, in the plane, as t1, t2 fractions.
  const [f1, f2] = inBasis(inPlaneOf(normal, latticePoint(S, q, 1)), t1, t2).map(fraction);
  // Stacking period: the first k for which k lattice shifts add up to a net vector, times the
  // number of layers per lattice step.
  let k = 1;
  while (
    k < PERIOD_LIMIT &&
    !(Math.abs(Math.round(k * f1) - k * f1) < 1e-7 && Math.abs(Math.round(k * f2) - k * f2) < 1e-7)
  ) {
    k++;
  }

  // Gaps and shortest shifts from each layer class to the next.
  const seeds = Array.from({ length: M + 1 }, (_, j) => layerSeeds(geometry, j));
  const moves = Array.from({ length: M }, (_, r) =>
    shortestShift(inPlaneOf(normal, subtract(seeds[r + 1][0], seeds[r][0])), t1, t2),
  );
  const gaps = Array.from(
    { length: M },
    (_, r) => (layerS(geometry, r + 1) - layerS(geometry, r)) / gNorm,
  );

  // In-layer neighbors of one atom of layer 0.
  const origin = seeds[0][0];
  let shortest = Infinity;
  let coordination = 0;
  for (const seed of seeds[0]) {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const length = norm(subtract(add(seed, add(scale(t1, i), scale(t2, j))), origin));
        if (length < 1e-8) continue;
        if (length < shortest - 1e-8) {
          shortest = length;
          coordination = 1;
        } else if (Math.abs(length - shortest) < 1e-8) {
          coordination++;
        }
      }
    }
  }

  const atomsPerCell = classes[0].length;
  const centered = atomsPerCell === 1 ? centeredCell(t1, t2) : null;
  const area = norm(cross(t1, t2));
  const e1 = normalize(t1);
  return Object.assign(geometry, {
    d: step / (M * gNorm),
    gaps,
    evenlySpaced: gaps.every((gap) => Math.abs(gap - gaps[0]) < 1e-9),
    period: M * k,
    repeat: normalRepeat(S, normal),
    latticeShift: [f1, f2],
    lengths: [norm(t1), norm(t2)],
    angle: angleBetween(t1, t2),
    area,
    atomsPerCell,
    density: atomsPerCell / area,
    coordination,
    neighborDistance: shortest,
    frame: { e1, e2: cross(normal, e1), e3: normal },
    shift: moves[0].shift,
    shiftFractions: moves[0].fractions,
    shifts: moves.map((move) => move.shift),
    centered,
    type: netType(t1, t2, centered),
  });
}

/** Spacing from layer j to layer j + 1 (units of a). */
export const gapAbove = (geometry, j) => layerHeight(geometry, j + 1) - layerHeight(geometry, j);

/** Shortest in-plane shift from layer j to layer j + 1. */
export const shiftAbove = (geometry, j) => {
  const M = geometry.layersPerStep;
  return geometry.shifts[j - Math.floor(j / M) * M];
};

/** In-plane coordinates (along e1, e2) of a point. */
export const planeCoords = (geometry, point) => [
  dot(point, geometry.frame.e1),
  dot(point, geometry.frame.e2),
];

/** Slice value s = G·X of a point. */
export const sliceOf = (geometry, point) => dot(geometry.G, point);

/** The layer whose slice value is nearest to s (ties go to the higher layer). */
export function nearestLayer(geometry, s) {
  const M = geometry.layersPerStep;
  if (M === 1) {
    return Math.round(s / geometry.step);
  }
  const J = Math.floor(s / geometry.step);
  let best = null;
  for (let j = (J - 1) * M; j < (J + 2) * M; j++) {
    const diff = Math.abs(layerS(geometry, j) - s);
    if (!best || diff < best.diff + 1e-9) {
      best = { j, diff };
    }
  }
  return best.j;
}

/** Layer index j of a point. */
export const layerOf = (geometry, point) => nearestLayer(geometry, sliceOf(geometry, point));

/**
 * The layer the panel's plane picks: the typed index for "Occupied layer", otherwise the layer
 * nearest to the plane level c of the (possibly unreduced) indices.
 */
export function layerForState(geometry, state) {
  if (state.location === "layer") {
    return state.layer;
  }
  const c = planeLevel(state.hkl, state.N, state.location, state.c, state.layer);
  return nearestLayer(geometry, c / gcdOf(state.hkl));
}

// ---------------------------------------------------------------------------------- cells

/** The conventional cell at the origin: the unit cube, or the hexagonal prism of HCP. */
function cellShape(structure) {
  if (structure.cell === "cube") {
    const vertices = Array.from({ length: 8 }, (_, c) => [c & 1, (c >> 1) & 1, (c >> 2) & 1]);
    const edges = [];
    for (let from = 0; from < 8; from++) {
      for (let axis = 0; axis < 3; axis++) {
        const to = from ^ (1 << axis);
        if (to > from) edges.push([from, to]);
      }
    }
    const faces = [0, 1, 2].flatMap((axis) => {
      const e = [0, 0, 0];
      e[axis] = 1;
      return [
        { normal: scale(e, -1), offset: 0 },
        { normal: e, offset: 1 },
      ];
    });
    return { vertices, edges, faces };
  }
  // Hexagon of six lattice points around the c axis, and the same hexagon one c higher.
  const c = structure.axes[2];
  const ring = [
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [-1, -1, 0],
    [0, -1, 0],
  ].map((m) => combine(structure.axes, m));
  const edges = [];
  for (let k = 0; k < 6; k++) {
    edges.push([k, (k + 1) % 6], [6 + k, 6 + ((k + 1) % 6)], [k, 6 + k]);
  }
  const faces = [
    { normal: [0, 0, -1], offset: 0 },
    { normal: [0, 0, 1], offset: c[2] },
    ...ring.map((p, k) => {
      const normal = normalize(add(p, ring[(k + 1) % 6]));
      return { normal, offset: dot(normal, p) };
    }),
  ];
  return { vertices: [...ring, ...ring.map((p) => add(p, c))], edges, faces };
}

/** The conventional cell translated to `origin`. */
function placeCell(structure, origin) {
  const shape = cellShape(structure);
  const vertices = shape.vertices.map((v) => add(v, origin));
  const center = scale(vertices.reduce(add, [0, 0, 0]), 1 / vertices.length);
  return {
    kind: structure.cell,
    origin,
    center,
    vertices,
    edges: shape.edges,
    faces: shape.faces.map(({ normal, offset }) => ({
      normal,
      offset: offset + dot(normal, origin),
    })),
    radius: Math.max(...vertices.map((v) => norm(subtract(v, center)))),
  };
}

/** True when a point lies in a closed cell (or any convex region given by its faces). */
export const inCell = (cell, point) =>
  cell.faces.every(({ normal, offset }) => dot(normal, point) < offset + 1e-7);

/** Every atom of the structure inside a region, given a test and points that bound the region. */
function atomsInside(structure, inside, bounds) {
  const coordinates = bounds.map((p) => coordinatesIn(structure.primitive, p));
  const lo = [0, 1, 2].map((i) => Math.floor(Math.min(...coordinates.map((c) => c[i]))) - 1);
  const hi = [0, 1, 2].map((i) => Math.ceil(Math.max(...coordinates.map((c) => c[i]))) + 1);
  const atoms = [];
  for (let m0 = lo[0]; m0 <= hi[0]; m0++) {
    for (let m1 = lo[1]; m1 <= hi[1]; m1++) {
      for (let m2 = lo[2]; m2 <= hi[2]; m2++) {
        const base = combine(structure.primitive, [m0, m1, m2]);
        structure.basisCartesian.forEach((offset, b) => {
          const p = add(base, offset);
          if (inside(p)) atoms.push({ id: `${m0}:${m1}:${m2}:${b}`, p, basis: b });
        });
      }
    }
  }
  return atoms;
}

/** Polygon where the plane s = G·X cuts a cell, ordered around its centroid; [] if it misses. */
export function slicePolygon(cell, G, s) {
  const points = [];
  const addPoint = (point) => {
    if (!points.some((existing) => norm(subtract(point, existing)) < 1e-7)) {
      points.push(point);
    }
  };
  for (const [i, k] of cell.edges) {
    const p = cell.vertices[i];
    const q = cell.vertices[k];
    const dp = dot(G, p) - s;
    const dq = dot(G, q) - s;
    if (Math.abs(dp) < 1e-9) addPoint(p);
    if (Math.abs(dq) < 1e-9) addPoint(q);
    if (dp * dq < -1e-10) addPoint(add(p, scale(subtract(q, p), dp / (dp - dq))));
  }
  if (points.length < 3) {
    return [];
  }
  const centroid = scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
  const [u, v] = orthonormalFrame(G);
  const angle = (p) => Math.atan2(dot(subtract(p, centroid), v), dot(subtract(p, centroid), u));
  return points.sort((first, second) => angle(first) - angle(second));
}

/**
 * A conventional cell (cube, or hexagonal prism for HCP) placed so that layer `layer` cuts
 * through its middle and holds some of its balls: its translation, the balls inside it and the
 * layers they lie on.
 */
export function cellAround(geometry, layer) {
  const S = geometry.structure;
  const n = geometry.hkl;
  const sValues = cellShape(S).vertices.map((v) => dot(geometry.G, v));
  const middle = (Math.min(...sValues) + Math.max(...sValues)) / 2;
  const target = layerS(geometry, layer);
  let shift = Math.round(target - middle);
  // Slice values of the balls of the cell at the origin. When the layer through the middle
  // misses every ball (FCC (332), SC (233), …), use the nearest layer level that has balls.
  const atOrigin = placeCell(S, [0, 0, 0]);
  const levels = atomsInside(S, (p) => inCell(atOrigin, p), atOrigin.vertices).map((atom) =>
    sliceOf(geometry, atom.p),
  );
  if (!levels.some((v) => Math.abs(target - shift - v) < 1e-7)) {
    let best = null;
    for (const v of levels) {
      const k = target - v;
      if (Math.abs(k - Math.round(k)) > 1e-7) continue;
      const distance = Math.abs(v - middle);
      if (
        !best ||
        distance < best.distance - 1e-9 ||
        (distance < best.distance + 1e-9 && v > best.v + 1e-9)
      ) {
        best = { v, distance, shift: Math.round(k) };
      }
    }
    shift = best.shift;
  }
  // Integer cell translation m (conventional axes) with h·m = shift (prefer a single axis).
  let m = null;
  const order = [0, 1, 2].sort((p, q) => Math.abs(n[q]) - Math.abs(n[p]));
  for (const axis of order) {
    if (n[axis] && shift % n[axis] === 0) {
      m = [0, 0, 0];
      m[axis] = shift / n[axis];
      break;
    }
  }
  if (!m) {
    const [g12, x1, y1] = extendedGcd(n[0], n[1]);
    const [, x2, y2] = extendedGcd(g12, n[2]);
    m = [x1 * x2 * shift, y1 * x2 * shift, y2 * shift];
  }
  const origin = combine(S.axes, m).map((value) => value + 0); // normalize -0
  const cell = placeCell(S, origin);
  const balls = atomsInside(S, (p) => inCell(cell, p), cell.vertices).map((atom) => ({
    ...atom,
    layer: layerOf(geometry, atom.p),
  }));
  const layers = [...new Set(balls.map((ball) => ball.layer))].sort((x, y) => x - y);
  const slices = layers.map((j) => ({
    layer: j,
    count: balls.filter((ball) => ball.layer === j).length,
    polygon: slicePolygon(cell, geometry.G, layerS(geometry, j)),
  }));
  return { ...cell, balls, layers, slices };
}

/**
 * The 3D array around a cell: 3 × 3 × 3 cubes, or 7 hexagonal prisms in each of 3 stories for
 * HCP. Returns the cells, every atom inside them (with its layer) and their edges, each once.
 */
export function cellArray(geometry, cell) {
  const S = geometry.structure;
  const steps = [-1, 0, 1];
  const translations =
    S.cell === "cube"
      ? steps.flatMap((i) => steps.flatMap((j) => steps.map((k) => [i, j, k])))
      : [
          [0, 0],
          [2, 1],
          [1, 2],
          [-1, 1],
          [-2, -1],
          [-1, -2],
          [1, -1],
        ].flatMap(([i, j]) => steps.map((k) => [i, j, k]));
  const cells = translations.map((m) => placeCell(S, add(cell.origin, combine(S.axes, m))));
  const vertices = cells.flatMap((c) => c.vertices);
  const atoms = atomsInside(S, (p) => cells.some((c) => inCell(c, p)), vertices).map((atom) => ({
    ...atom,
    layer: layerOf(geometry, atom.p),
    inCell: inCell(cell, atom.p),
  }));
  const key = (p) => p.map((value) => Math.round(value * 1e5) + 0).join(",");
  const seen = new Set();
  const segments = [];
  for (const c of cells) {
    for (const [i, k] of c.edges) {
      const id = [key(c.vertices[i]), key(c.vertices[k])].sort().join("|");
      if (!seen.has(id)) {
        seen.add(id);
        segments.push([c.vertices[i], c.vertices[k]]);
      }
    }
  }
  return {
    cells,
    atoms,
    segments,
    radius: Math.max(...vertices.map((p) => norm(subtract(p, cell.center)))),
    size: S.cell === "cube" ? "3 × 3 × 3" : "7 × 3",
  };
}

/** The primitive cell spanned by the structure's primitive vectors from `origin`, with its atoms. */
export function primitiveCell(geometry, origin) {
  const S = geometry.structure;
  const corners = Array.from({ length: 8 }, (_, c) =>
    add(origin, combine(S.primitive, [c & 1, (c >> 1) & 1, (c >> 2) & 1])),
  );
  const atoms = atomsInside(
    S,
    (p) => coordinatesIn(S.primitive, subtract(p, origin)).every((x) => x > -1e-7 && x < 1 + 1e-7),
    corners,
  );
  return { origin, corners, atoms, center: scale(corners.reduce(add, [0, 0, 0]), 1 / 8) };
}

// ---------------------------------------------------------------------------------- layers

/**
 * Atoms of layer j within in-plane distance `radius` of the normal line through `center`.
 */
export function layerPoints(geometry, layer, center, radius) {
  const { t1, t2, normal } = geometry;
  const width = geometry.area / Math.max(...geometry.lengths);
  const reach = Math.ceil(radius / width) + 2;
  const points = [];
  layerSeeds(geometry, layer).forEach((base, b) => {
    const [alpha, beta] = inBasis(inPlaneOf(normal, subtract(center, base)), t1, t2);
    for (let i = Math.floor(alpha) - reach; i <= Math.ceil(alpha) + reach; i++) {
      for (let k = Math.floor(beta) - reach; k <= Math.ceil(beta) + reach; k++) {
        const p = add(base, add(scale(t1, i), scale(t2, k)));
        const planar = norm(inPlaneOf(normal, subtract(p, center)));
        if (planar <= radius + EPS) {
          points.push({ id: `L${layer}:${b ? `${b}:` : ""}${i}:${k}`, p, layer, planar });
        }
      }
    }
  });
  return points;
}

/**
 * Layers for the "Build" animation: the stack j0 … j0 + N (capped at `maxLayers`) plus every
 * layer the conventional cell needs, each as a patch of radius `radius` around the cell.
 */
export function stackPlan(geometry, layer, { maxLayers = 12, radius } = {}) {
  const cell = cellAround(geometry, layer);
  const shown = Math.min(geometry.period, maxLayers);
  const stack = Array.from({ length: shown + 1 }, (_, i) => layer + i);
  const layers = [...new Set([...stack, ...cell.layers])].sort((x, y) => x - y);
  const reach = Math.max(
    ...cell.vertices.map((v) => norm(inPlaneOf(geometry.normal, subtract(v, cell.center)))),
  );
  const r = radius ?? Math.min(6, Math.max(1.2, 2.2 * Math.max(...geometry.lengths), reach + 0.05));
  const points = layers.flatMap((j) =>
    layerPoints(geometry, j, cell.center, r).map((point) => ({
      ...point,
      inCell: inCell(cell, point.p),
    })),
  );
  return { cell, stack, layers, radius: r, points };
}

/**
 * A finite patch of layer j for the 2D views: every atom of the layer at origin + i·t1 + k·t2
 * (|i|, |k| ≤ repeat, one copy per basis atom in the layer). The origin is the layer's first
 * atom, moved by net translations next to `center` when one is given.
 */
export function layerNet(geometry, layer, repeat, center = null) {
  let seeds = layerSeeds(geometry, layer);
  if (center) {
    const [i, k] = inBasis(
      inPlaneOf(geometry.normal, subtract(center, seeds[0])),
      geometry.t1,
      geometry.t2,
    ).map(Math.round);
    const shift = add(scale(geometry.t1, i), scale(geometry.t2, k));
    seeds = seeds.map((seed) => add(seed, shift));
  }
  const points = [];
  seeds.forEach((seed, b) => {
    for (let i = -repeat; i <= repeat; i++) {
      for (let k = -repeat; k <= repeat; k++) {
        points.push({
          id: `net:${i}:${k}${b ? `:${b}` : ""}`,
          p: add(seed, add(scale(geometry.t1, i), scale(geometry.t2, k))),
          ij: [i, k],
          basis: b,
        });
      }
    }
  });
  return { origin: seeds[0], points };
}

/** The lattice point of layer j closest to the normal line through `center`. */
export function nearestLayerPoint(geometry, layer, center) {
  const points = layerPoints(geometry, layer, center, Math.max(...geometry.lengths) * 2);
  return points.reduce((best, point) => (point.planar < best.planar ? point : best)).p;
}

/** Number of distinct spots when the cell's balls are projected along the normal ("picture B"). */
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

/** In-plane registry of layer j: its atoms' t1, t2 fractions modulo the net, as a key. */
function registryKey(geometry, j) {
  const wrap = (value) => Math.round(fraction(value) * 1e6) % 1e6;
  return layerSeeds(geometry, j)
    .map((p) =>
      inBasis(inPlaneOf(geometry.normal, p), geometry.t1, geometry.t2).map(wrap).join(","),
    )
    .sort()
    .join(";");
}

/**
 * Registry index of layers from, from + 1, …: layers with the same in-plane positions share an
 * index (0 → A, 1 → B, …), counted in the order they first appear from layer `from`.
 */
export function stackingIndices(geometry, from, count) {
  const known = new Map();
  const indices = [];
  for (let i = 0; i < Math.min(count, geometry.period); i++) {
    const key = registryKey(geometry, from + i);
    if (!known.has(key)) known.set(key, known.size);
    indices.push(known.get(key));
  }
  return Array.from({ length: count }, (_, i) => indices[i % geometry.period]);
}

/** Letter of a registry index: A, B, C, … (then A′, B′, … past Z). */
export const registryLetter = letterOf;

/** Registry letters of `count` layers starting at layer `from` (which is A). */
export const stackingLetters = (geometry, from, count) =>
  stackingIndices(geometry, from, count).map(letterOf);

/**
 * Is a cell-cut polygon itself a 2D cell of the net? A cell is a parallelogram, or a centrally
 * symmetric hexagon, whose copies moved by net translations tile the plane. Returns
 * { isCell, atoms, shape } where atoms counts the atoms per cell for valid cells.
 */
export function classifyCut(geometry, polygon) {
  const count = polygon.length;
  let shape =
    ["point", "segment", "line", "triangle", "quadrilateral", "pentagon", "hexagon"][count] ??
    `${count}-gon`;
  const isTranslation = (w) =>
    inBasis(w, geometry.t1, geometry.t2).every((x) => Math.abs(x - Math.round(x)) < 1e-7);
  const atomsIn = (area) => Math.round((area / geometry.area) * geometry.atomsPerCell);
  if (count === 4) {
    const [p0, p1, p2, p3] = polygon;
    const u = subtract(p1, p0);
    const v = subtract(p3, p0);
    const parallelogram = norm(subtract(subtract(p2, p1), v)) < 1e-7;
    if (parallelogram) {
      shape =
        Math.abs(dot(u, v)) < 1e-9
          ? Math.abs(norm(u) - norm(v)) < 1e-9
            ? "square"
            : "rectangle"
          : "parallelogram";
    }
    if (parallelogram && isTranslation(u) && isTranslation(v)) {
      return { isCell: true, atoms: atomsIn(norm(cross(u, v))), shape };
    }
  }
  if (count === 6) {
    const edges = polygon.map((p, i) => subtract(polygon[(i + 1) % 6], p));
    const symmetric = [0, 1, 2].every((i) => norm(add(edges[i], edges[i + 3])) < 1e-7);
    const T1 = add(edges[0], edges[1]);
    const T2 = add(edges[1], edges[2]);
    if (symmetric && isTranslation(T1) && isTranslation(T2)) {
      return { isCell: true, atoms: atomsIn(norm(cross(T1, T2))), shape };
    }
  }
  return { isCell: false, atoms: 0, shape };
}

/**
 * Atoms of layer j counted in the cell origin + [0, 1]·u + [0, 1]·v with corner, edge and
 * interior weights (¼, ½, 1), for captions such as "4 corners × ¼ + 1 center = 2".
 */
export function cellCount(geometry, layer, origin, u, v) {
  const tally = { corner: 0, edge: 0, inside: 0 };
  const radius = norm(u) + norm(v) + Math.max(...geometry.lengths);
  for (const point of layerPoints(geometry, layer, origin, radius)) {
    const [x, y] = inBasis(subtract(point.p, origin), u, v);
    if (x < -1e-7 || x > 1 + 1e-7 || y < -1e-7 || y > 1 + 1e-7) continue;
    const onX = Math.abs(x) < 1e-7 || Math.abs(x - 1) < 1e-7;
    const onY = Math.abs(y) < 1e-7 || Math.abs(y - 1) < 1e-7;
    if (onX && onY) tally.corner++;
    else if (onX || onY) tally.edge++;
    else tally.inside++;
  }
  return { ...tally, total: tally.corner / 4 + tally.edge / 2 + tally.inside };
}
