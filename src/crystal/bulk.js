/**
 * Bulk geometry of the selected crystal structure (simple cubic, BCC, FCC or HCP): the sites of
 * a unit-cell supercell or of the HCP hexagonal prism, neighbor shells, interstitial holes, the
 * Wigner–Seitz cell, directions, located planes, slip systems, partial vectors, the surface
 * cell and the reciprocal lattice.
 *
 * FCC keeps its original dedicated code (lattice.js, planes.js, surfaces.js, environment.js,
 * slip.js, reciprocal.js), so its results, site IDs and drawing order are unchanged. The other
 * structures use the general lattice + basis versions below.
 *
 * Positions `p` are Cartesian in units of a. Fractional coordinates `f` refer to the unit-cell
 * axes (the cube edges, or a₁, a₂, c for HCP); for the cubic structures they are equal to `p`.
 */

import {
  holeHosts,
  interstitialSites,
  neighborShells,
  wignerSeitzVertices,
} from "./environment.js";
import { layerGeometry, layerS, millerLabel, nearestLayer, slicePolygon } from "./layers.js";
import { directionInfo, isLatticeTranslation, latticeMetrics, latticeSites } from "./lattice.js";
import {
  angleBetween,
  cubicFamily,
  dot,
  gcdOf,
  norm,
  normalize,
  orthonormalFrame,
  scale,
  subtract,
  add,
  cross,
} from "./math.js";
import {
  extendedPlaneQuad,
  planeBoxPolygon,
  planeInfo,
  planeLevel,
  planeLevelsInBox,
} from "./planes.js";
import {
  braggTable,
  reciprocalBasis,
  reciprocalPoints,
  reflectionInfo,
  structureFactor,
} from "./reciprocal.js";
import { SHOCKLEY_EXAMPLE, slipSystems } from "./slip.js";
import {
  bravaisDirection,
  combine,
  coordinatesIn,
  millerBravais,
  reciprocalAxes,
  structureOf,
} from "./structures.js";
import { cubicMeshVectors, gaussReduce, integerKernel, surfaceCell } from "./surfaces.js";

const EPS = 1e-9;

/** The structure object for a key (or the object itself). */
export const structureFor = (structure) =>
  typeof structure === "string" || !structure ? structureOf(structure) : structure;

const isFcc = (S) => S.key === "fcc";

// ------------------------------------------------------------------------------ coordinates

/** Fractional unit-cell coordinates → Cartesian (units of a). */
export const toCartesian = (S, f) => combine(S.axes, f);

/** Cartesian (units of a) → fractional unit-cell coordinates. */
export const toFractional = (S, p) => coordinatesIn(S.axes, p);

/** Fractional coordinates of a site (equal to its position for the cubic structures). */
export const fractionalOf = (site, S = structureFor()) => site.f ?? toFractional(S, site.p);

/** Plane normal G = h b₁ + k b₂ + l b₃ (units of 1/a); the slice value of X is G·X. */
export const planeNormal = (S, hkl) => combine(S.reciprocal, hkl);

/** Direction [u v w] as a Cartesian vector u a₁ + v a₂ + w a₃ (units of a). */
export const directionVector = (S, uvw) => combine(S.axes, uvw);

/** True when a Cartesian vector is a lattice translation of the structure. */
export const isTranslation = (S, p) =>
  isFcc(S)
    ? isLatticeTranslation(p)
    : coordinatesIn(S.primitive, p).every((x) => Math.abs(x - Math.round(x)) < 1e-8);

/** Plane indices for text: (1 −1 0) for cubic, (1 0 −1 0) for HCP. */
export const planeText = (S, hkl) =>
  S.hexagonal ? millerLabel(millerBravais(hkl)) : hkl.join(" ").replaceAll("-", "−");

/** Direction indices for text: [1 1 0] for cubic, [2 −1 −1 0] for HCP. */
export const directionText = (S, uvw) =>
  S.hexagonal ? millerLabel(bravaisDirection(uvw)) : uvw.join(" ").replaceAll("-", "−");

// ------------------------------------------------------------------------------ metrics

/** Hard-sphere radius, nearest distance, volumes, packing fraction and coordination (Å). */
export function metricsOf(S, a) {
  if (isFcc(S)) {
    return { ...latticeMetrics(a), coordination: 12 };
  }
  return {
    radius: a * S.physicalRadius,
    nn: a * S.nearest,
    volume: a ** 3 * S.unitVolume,
    primitiveVolume: a ** 3 * S.primitiveVolume,
    apf: S.apf,
    coordination: S.coordination,
  };
}

// ------------------------------------------------------------------------------ sites

/**
 * Sites of an Nx × Ny × Nz unit-cell supercell (closed drawing, or the half-open box with
 * `uniqueOnly`), with boundary masks, periodic weights 2^-b and owner cells.
 */
export function sitesOf(S, cells = [1, 1, 1], uniqueOnly = false) {
  if (isFcc(S)) {
    return latticeSites(cells, uniqueOnly);
  }
  const sites = [];
  for (let n0 = 0; n0 <= cells[0]; n0++) {
    for (let n1 = 0; n1 <= cells[1]; n1++) {
      for (let n2 = 0; n2 <= cells[2]; n2++) {
        S.unit.basis.forEach((offset, b) => {
          const f = add([n0, n1, n2], offset);
          if (f.some((value, axis) => value > cells[axis] + EPS)) return;
          const boundary = f.map((value, axis) =>
            value < EPS ? -1 : Math.abs(value - cells[axis]) < EPS ? 1 : 0,
          );
          const ghost = boundary.includes(1);
          if (uniqueOnly && ghost) return;
          sites.push({
            id: S.hexagonal
              ? `${n0}:${n1}:${n2}:${"AB"[b]}`
              : f.map((value) => Math.round(2 * value)).join(":"),
            p: toCartesian(S, f),
            f,
            ghost,
            boundary,
            weight: 2 ** -boundary.filter(Boolean).length,
            cell: f.map((value, axis) => Math.min(cells[axis] - 1, Math.floor(value + EPS))),
          });
        });
      }
    }
  }
  return sites;
}

/** Corners of the hexagon of HCP lattice points around the c axis (fractional, z = 0). */
export const HEXAGON = [
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [-1, -1, 0],
  [0, -1, 0],
];

/** Outward unit normals of the six side faces of the hexagonal prism (face k: corners k, k+1). */
export const prismSideNormals = (S) =>
  HEXAGON.map((corner, k) =>
    normalize(add(toCartesian(S, corner), toCartesian(S, HEXAGON[(k + 1) % 6]))),
  );

/**
 * Sites of the HCP hexagonal prism (3 unit cells, 6 atoms per story) stacked `stories` high:
 * 12 corners × ⅙ + 2 face centers × ½ + 3 inside per story. Each boundary site lists the
 * inward normals of the faces it sits on, for capped drawing.
 */
export function prismSites(S, stories = 1) {
  const sides = prismSideNormals(S);
  const inside = [
    [1 / 3, 2 / 3],
    [1 / 3, -1 / 3],
    [-2 / 3, -1 / 3],
  ];
  const sites = [];
  for (let z = 0; z <= stories; z++) {
    const end = z === 0 || z === stories;
    const caps = z === 0 ? [[0, 0, 1]] : z === stories ? [[0, 0, -1]] : [];
    const share = end ? 0.5 : 1;
    const center = [0, 0, z];
    sites.push({
      id: `P:${z}:center`,
      p: toCartesian(S, center),
      f: center,
      ghost: false,
      weight: share,
      clip: caps,
    });
    HEXAGON.forEach((corner, k) => {
      const f = [corner[0], corner[1], z];
      sites.push({
        id: `P:${z}:corner${k}`,
        p: toCartesian(S, f),
        f,
        ghost: false,
        weight: share / 3,
        clip: [scale(sides[(k + 5) % 6], -1), scale(sides[k], -1), ...caps],
      });
    });
    if (z < stories) {
      inside.forEach(([x, y], k) => {
        const f = [x, y, z + 0.5];
        sites.push({
          id: `P:${z}:B${k}`,
          p: toCartesian(S, f),
          f,
          ghost: false,
          weight: 1,
          clip: [],
        });
      });
    }
  }
  return sites;
}

/** Corners (Cartesian) and edges of the hexagonal prism, `stories` high. */
export function prismOutline(S, stories = 1) {
  const bottom = HEXAGON.map((corner) => toCartesian(S, corner));
  const lift = toCartesian(S, [0, 0, stories]);
  const top = bottom.map((p) => add(p, lift));
  const segments = [];
  for (let k = 0; k < 6; k++) {
    segments.push(
      [bottom[k], bottom[(k + 1) % 6]],
      [top[k], top[(k + 1) % 6]],
      [bottom[k], top[k]],
    );
  }
  return segments;
}

/** Every atom within `radius` of a point (Cartesian), with its distance. */
export function atomsNear(S, center, radius) {
  const m = coordinatesIn(S.primitive, center);
  const reach = Math.ceil(radius * Math.max(...reciprocalAxes(S.primitive).map(norm))) + 2;
  const atoms = [];
  for (let i = Math.floor(m[0]) - reach; i <= Math.ceil(m[0]) + reach; i++) {
    for (let j = Math.floor(m[1]) - reach; j <= Math.ceil(m[1]) + reach; j++) {
      for (let k = Math.floor(m[2]) - reach; k <= Math.ceil(m[2]) + reach; k++) {
        const base = combine(S.primitive, [i, j, k]);
        S.basisCartesian.forEach((offset, b) => {
          const p = add(base, offset);
          const distance = norm(subtract(p, center));
          if (distance <= radius + EPS) {
            atoms.push({ p, distance, cell: [i, j, k], basis: b });
          }
        });
      }
    }
  }
  return atoms.sort((first, second) => first.distance - second.distance);
}

// ------------------------------------------------------------------------------ environment

const shellCache = new Map();

/** Distances (units of a) of the first three neighbor shells around an atom. */
export function shellDistances(S) {
  if (!shellCache.has(S.key)) {
    const distances = [];
    for (const atom of atomsNear(S, [0, 0, 0], 2.5)) {
      if (atom.distance < 1e-6) continue;
      if (!distances.some((d) => Math.abs(d - atom.distance) < 1e-6)) {
        distances.push(atom.distance);
      }
    }
    shellCache.set(S.key, distances.slice(0, 3));
  }
  return shellCache.get(S.key);
}

/** Neighbors of the atom at `center` up to shell `maxShell`, limited to `cutoff` (units of a). */
export function neighborsOf(S, center = [0, 0, 0], maxShell = 3, cutoff = 2) {
  if (isFcc(S)) {
    return neighborShells(center, maxShell, cutoff);
  }
  const shells = shellDistances(S);
  const limit = Math.min(shells[maxShell - 1] + 1e-6, cutoff + EPS);
  return atomsNear(S, center, limit)
    .filter((atom) => atom.distance > 1e-6)
    .map((atom) => ({
      id: `n:${atom.cell.join(":")}:${atom.basis}`,
      p: atom.p,
      v: subtract(atom.p, center),
      shell: shells.findIndex((d) => Math.abs(d - atom.distance) < 1e-6) + 1,
      distance: atom.distance,
    }));
}

/** The hole types of `kind` ("octa", "tetra", "cubic" or "both" = every type). */
export const holeTypesOf = (S, kind) =>
  S.holes.filter((hole) => kind === "both" || hole.type === kind);

/** Interstitial holes of the drawn region (the closed supercell, or the HCP prism). */
export function holesOf(S, kind, cells, region = null) {
  const prism = region?.kind === "prism";
  if (isFcc(S)) {
    return interstitialSites(kind, cells);
  }
  // Fractional range to scan: the supercell, or a box around the prism.
  const range = prism
    ? [
        [-2, 1],
        [-2, 1],
        [-1, region.stories],
      ]
    : cells.map((count) => [-1, count]);
  const sites = [];
  for (const hole of holeTypesOf(S, kind)) {
    for (const offset of hole.sites) {
      for (let n0 = range[0][0]; n0 <= range[0][1]; n0++) {
        for (let n1 = range[1][0]; n1 <= range[1][1]; n1++) {
          for (let n2 = range[2][0]; n2 <= range[2][1]; n2++) {
            const f = add([n0, n1, n2], offset);
            if (
              prism
                ? !region.contains(toCartesian(S, f))
                : f.some((value, axis) => value < -EPS || value > cells[axis] + EPS)
            ) {
              continue;
            }
            sites.push({
              id: `${hole.type[0]}:${f.map((value) => Math.round(value * 24)).join(":")}`,
              p: toCartesian(S, f),
              f,
              type: hole.type,
              coordination: hole.coordination,
              ratio: hole.ratio,
            });
          }
        }
      }
    }
  }
  return sites;
}

/** The nearest host atoms of a hole. */
export function hostsOf(S, hole) {
  if (isFcc(S)) {
    return holeHosts(hole);
  }
  return atomsNear(S, hole.p, 1.6)
    .slice(0, hole.coordination)
    .map((atom) => ({ p: atom.p, distance: atom.distance }));
}

const wsCache = new Map();

/** Vertices of the Wigner–Seitz cell of the Bravais lattice around the origin (units of a). */
export function wignerSeitzOf(S) {
  if (isFcc(S)) {
    return wignerSeitzVertices();
  }
  if (!wsCache.has(S.key)) {
    // The 26 shortest lattice vectors contain every face of these cells.
    const vectors = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        for (let k = -2; k <= 2; k++) {
          if (i || j || k) vectors.push(combine(S.primitive, [i, j, k]));
        }
      }
    }
    vectors.sort((u, v) => norm(u) - norm(v));
    const cutoff = norm(vectors[25]) + 1e-6;
    const planes = vectors.filter((v) => norm(v) <= cutoff).map((v) => [v, dot(v, v) / 2]);
    const inside = (p) => planes.every(([v, c]) => dot(v, p) <= c + 1e-7);
    const vertices = [];
    for (let a = 0; a < planes.length; a++) {
      for (let b = a + 1; b < planes.length; b++) {
        for (let c = b + 1; c < planes.length; c++) {
          const [n1, d1] = planes[a];
          const [n2, d2] = planes[b];
          const [n3, d3] = planes[c];
          const det = dot(n1, cross(n2, n3));
          if (Math.abs(det) < 1e-9) continue;
          const p = scale(
            add(add(scale(cross(n2, n3), d1), scale(cross(n3, n1), d2)), scale(cross(n1, n2), d3)),
            1 / det,
          );
          if (inside(p) && !vertices.some((q) => norm(subtract(p, q)) < 1e-6)) {
            vertices.push(p);
          }
        }
      }
    }
    wsCache.set(S.key, vertices);
  }
  return wsCache.get(S.key);
}

// ------------------------------------------------------------------------------ directions & planes

/** Length, unit vector, axis angles and the shortest lattice translation along [uvw]. */
export function directionOf(S, uvw, a = 1) {
  if (isFcc(S)) {
    return directionInfo(uvw, a);
  }
  const v = directionVector(S, uvw);
  const q = scale(uvw, 1 / gcdOf(uvw));
  let translation = q;
  for (const k of [6, 4, 3, 2]) {
    const candidate = scale(q, 1 / k);
    if (isTranslation(S, directionVector(S, candidate))) {
      translation = candidate;
      break;
    }
  }
  const period = a * norm(directionVector(S, translation));
  return {
    unit: normalize(v),
    length: a * norm(v),
    translation,
    period,
    density: 1 / period,
    angles: [0, 1, 2].map((axis) =>
      angleBetween(
        v,
        [0, 1, 2].map((other) => (axis === other ? 1 : 0)),
      ),
    ),
  };
}

/**
 * Orientation data for (hkl): unit normal, geometric d = a/|G|, the occupied layer levels and
 * spacings, and the pure normal repeat.
 */
export function planeOf(S, hkl, a = 1) {
  if (isFcc(S)) {
    return { ...planeInfo(hkl, a), evenlySpaced: true, layersPerStep: 1 };
  }
  const G = planeNormal(S, hkl);
  const layers = layerGeometry(hkl, 1, S);
  const factor = gcdOf(hkl);
  return {
    n: hkl,
    normal: normalize(G),
    d: a / norm(G),
    step: layers.step * factor,
    offsets: layers.offsets.map((offset) => offset * factor),
    layersPerStep: layers.layersPerStep,
    gap: layers.d * a,
    gaps: layers.gaps.map((gap) => gap * a),
    evenlySpaced: layers.evenlySpaced,
    period: layers.repeat * a,
  };
}

/** The level c (in h·f₁ + k·f₂ + l·f₃ = c) of the located plane. */
export function planeLevelOf(S, hkl, cells, location, c, layer) {
  if (isFcc(S) || location !== "layer") {
    return planeLevel(hkl, cells, location, c, layer);
  }
  return layerS(layerGeometry(hkl, 1, S), layer) * gcdOf(hkl);
}

/** Occupied-layer levels c of (hkl) between min and max. */
function occupiedLevels(S, hkl, min, max) {
  const layers = layerGeometry(hkl, 1, S);
  const factor = gcdOf(hkl);
  const levels = [];
  for (
    let j = nearestLayer(layers, min / factor) - 1;
    j <= nearestLayer(layers, max / factor) + 1;
    j++
  ) {
    const level = layerS(layers, j) * factor;
    if (level >= min - EPS && level <= max + EPS) levels.push(level);
  }
  return levels;
}

/** Geometric (integer) or occupied levels c whose planes cross the supercell. */
export function levelsInBoxOf(S, hkl, cells, occupiedOnly) {
  if (isFcc(S) || !occupiedOnly) {
    return planeLevelsInBox(hkl, cells, occupiedOnly);
  }
  const min = hkl.reduce((sum, h, axis) => sum + Math.min(0, h * cells[axis]), 0);
  const max = hkl.reduce((sum, h, axis) => sum + Math.max(0, h * cells[axis]), 0);
  return occupiedLevels(S, hkl, min, max);
}

/** Polygon (Cartesian) where the plane h·f = c meets the supercell; empty if it misses. */
export const planePolygonOf = (S, hkl, c, cells) =>
  S.hexagonal
    ? planeBoxPolygon(hkl, c, cells).map((f) => toCartesian(S, f))
    : planeBoxPolygon(hkl, c, cells);

/**
 * The region the crystal view draws: the unit-cell supercell [0, N], or for HCP with
 * `hexPrism` the hexagonal prism N₃ stories high. It clips planes and holes, and its
 * `levelCells` give the center used by located planes (c = h·f of the center).
 */
export function regionOf(S, state) {
  const cells = state.N;
  if (S.hexagonal && state.hexPrism) {
    const stories = cells[2];
    const bottom = HEXAGON.map((f) => toCartesian(S, f));
    const lift = toCartesian(S, [0, 0, stories]);
    const vertices = [...bottom, ...bottom.map((p) => add(p, lift))];
    const edges = [];
    for (let k = 0; k < 6; k++) {
      edges.push([k, (k + 1) % 6], [6 + k, 6 + ((k + 1) % 6)], [k, 6 + k]);
    }
    const sides = prismSideNormals(S);
    const offset = dot(sides[0], bottom[0]);
    const levelCells = [0, 0, stories];
    return {
      kind: "prism",
      cells,
      stories,
      levelCells,
      fractionalCorners: [...HEXAGON, ...HEXAGON.map(([x, y]) => [x, y, stories])],
      center: toCartesian(S, [0, 0, stories / 2]),
      vertices,
      edges,
      contains: (p) =>
        p[2] > -1e-7 && p[2] < lift[2] + 1e-7 && sides.every((n) => dot(n, p) < offset + 1e-7),
      polygon: (hkl, c) => slicePolygon({ vertices, edges }, planeNormal(S, hkl), c),
      extended: (hkl, c) => extendedQuadOf(S, hkl, c, levelCells, Math.max(1.4, lift[2] * 0.7)),
    };
  }
  return {
    kind: "box",
    cells,
    levelCells: cells,
    fractionalCorners: Array.from({ length: 8 }, (_, corner) =>
      cells.map((count, axis) => ((corner >> axis) & 1) * count),
    ),
    center: toCartesian(S, scale(cells, 0.5)),
    contains: (p) =>
      toFractional(S, p).every((value, axis) => value > -1e-7 && value < cells[axis] + 1e-7),
    polygon: (hkl, c) => planePolygonOf(S, hkl, c, cells),
    extended: (hkl, c) => extendedQuadOf(S, hkl, c, cells),
  };
}

/** Geometric (integer) or occupied levels c whose planes cross the drawn region. */
export function levelsInRegion(S, hkl, region, occupiedOnly) {
  if (region.kind === "box") {
    return levelsInBoxOf(S, hkl, region.cells, occupiedOnly);
  }
  const values = region.fractionalCorners.map((f) => dot(hkl, f));
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (occupiedOnly) {
    return occupiedLevels(S, hkl, min, max);
  }
  return Array.from(
    { length: Math.floor(max + EPS) - Math.ceil(min - EPS) + 1 },
    (_, index) => Math.ceil(min - EPS) + index,
  );
}

/** The foot of the supercell center on the plane h·f = c (Cartesian). */
export function planeFoot(S, hkl, c, cells) {
  const G = planeNormal(S, hkl);
  const center = toCartesian(S, scale(cells, 0.5));
  return add(center, scale(G, (c - dot(G, center)) / dot(G, G)));
}

/** A square patch of the plane near the supercell, for planes drawn beyond it. */
export function extendedQuadOf(S, hkl, c, cells, half = null) {
  if (!S.hexagonal) {
    return extendedPlaneQuad(hkl, c, cells);
  }
  const foot = planeFoot(S, hkl, c, cells);
  const [u, v] = orthonormalFrame(planeNormal(S, hkl));
  half ??= Math.max(...cells.map((count, axis) => count * norm(S.axes[axis]))) * 0.7;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([su, sv]) => add(foot, add(scale(u, su * half), scale(v, sv * half))));
}

/**
 * Symmetry-equivalent indices: the 48 cubic operations, or the 24 hexagonal ones acting on
 * (h k i l) or [u v t w]. Unless `oriented`, v and −v count once.
 */
export function familyOf(S, indices, oriented = false, kind = "plane") {
  if (!S.hexagonal) {
    return cubicFamily(indices, oriented);
  }
  const [x, y, z] = indices;
  // Planes: (h, k, i = −h−k); directions: 3 × [U, V, T] of the four-index form.
  const triple = kind === "plane" ? [x, y, -(x + y)] : [2 * x - y, 2 * y - x, -(x + y)];
  const unique = new Map();
  for (const [p, q, r] of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    for (const sign of [1, -1]) {
      for (const signZ of [1, -1]) {
        const [A, B, C] = [triple[p], triple[q], triple[r]].map((value) => value * sign);
        let variant = kind === "plane" ? [A, B, z * signZ] : [(A - C) / 3, (B - C) / 3, z * signZ];
        variant = variant.map((value) => value + 0);
        if (!oriented && variant.find((value) => value !== 0) < 0) {
          variant = variant.map((value) => -value + 0);
        }
        unique.set(variant.join(","), variant);
      }
    }
  }
  return [...unique.values()];
}

// ------------------------------------------------------------------------------ surface cell

/**
 * The reduced primitive 2D cell of the (hkl) layers (lengths in Å, area in Å²), with the
 * integer kernel, in-plane frame and the area × lattice-layer step identity.
 */
export function surfaceOf(S, hkl, a = 1) {
  if (isFcc(S)) {
    return surfaceCell(hkl, a);
  }
  const layers = layerGeometry(hkl, 1, S);
  const area = layers.area * a * a;
  return {
    n: hkl,
    q: layers.lattice.q,
    g: layers.lattice.g,
    t1: layers.t1,
    t2: layers.t2,
    m1: layers.m1,
    m2: layers.m2,
    area,
    lengths: layers.lengths.map((length) => length * a),
    angle: layers.angle,
    density: layers.atomsPerCell / area,
    atomsPerCell: layers.atomsPerCell,
    ex: layers.frame.e1,
    ey: layers.frame.e2,
    ez: layers.frame.e3,
    coordination: layers.coordination,
    neighborDistance: layers.neighborDistance,
    identity: area * (layers.step / layers.gNorm) * a,
  };
}

/** The reduced integer mesh of unit-cell translations lying in (hkl) (Cartesian). */
export function meshVectorsOf(S, hkl) {
  if (!S.hexagonal) {
    return cubicMeshVectors(hkl);
  }
  const [k1, k2] = integerKernel(hkl);
  return gaussReduce(toCartesian(S, k1), toCartesian(S, k2), k1, k2, planeNormal(S, hkl)).slice(
    0,
    2,
  );
}

// ------------------------------------------------------------------------------ slip

/** Slip systems with Schmid factors |l̂·n̂||l̂·b̂| for loading direction `load` ([u v w]). */
export function slipSystemsOf(S, load = [0, 0, 1]) {
  if (isFcc(S)) {
    return slipSystems(load);
  }
  const loadDirection = normalize(directionVector(S, load));
  const systems = [];
  for (const family of S.slipFamilies) {
    for (const plane of familyOf(S, family.planes, false, "plane")) {
      for (const direction of familyOf(S, family.directions, false, "direction")) {
        if (Math.abs(dot(plane, direction)) > EPS) continue;
        const normal = normalize(planeNormal(S, plane));
        const unit = normalize(directionVector(S, direction));
        systems.push({
          n: plane,
          d: direction,
          b: directionVector(S, directionOf(S, direction).translation),
          normal,
          family: family.name,
          schmid: Math.abs(dot(loadDirection, normal) * dot(loadDirection, unit)),
          label: `(${planeText(S, plane)}) [${directionText(S, direction)}]`,
        });
      }
    }
  }
  return systems;
}

/**
 * A perfect slip vector split into two partials on a close-packed plane: the FCC Shockley
 * example, or the HCP basal one; null for SC and BCC.
 */
export function partialsOf(S) {
  if (isFcc(S)) {
    return {
      ...SHOCKLEY_EXAMPLE,
      origin: [0.15, 0.6, 0.5],
      labels: ["a/6 [2 −1 −1]", "a/6 [1 −2 1]", "a/2 [1 −1 0]"],
      partialLength: 1 / Math.sqrt(6),
      perfectLength: 1 / Math.SQRT2,
    };
  }
  if (S.hexagonal) {
    return {
      normal: [0, 0, 1],
      perfect: toCartesian(S, [1, 1, 0]),
      first: toCartesian(S, [2 / 3, 1 / 3, 0]),
      second: toCartesian(S, [1 / 3, 2 / 3, 0]),
      origin: toCartesian(S, [0.1, 0.1, 0.5]),
      labels: ["a/3 [10−10]", "a/3 [01−10]", "a/3 [11−20]"],
      partialLength: 1 / Math.sqrt(3),
      perfectLength: 1,
    };
  }
  return null;
}

// ------------------------------------------------------------------------------ reciprocal

/** |F/f| for equal scatterers at the unit-cell basis (FCC: the signed 4 or 0). */
export function structureFactorOf(S, hkl) {
  if (isFcc(S)) {
    return structureFactor(hkl);
  }
  let re = 0;
  let im = 0;
  for (const f of S.unit.basis) {
    const phase = 2 * Math.PI * dot(hkl, f);
    re += Math.cos(phase);
    im += Math.sin(phase);
  }
  const magnitude = Math.hypot(re, im);
  return magnitude < 1e-9 ? 0 : Math.round(magnitude * 1e9) / 1e9;
}

/** d, G, |G| = 2π/d, the structure factor and the first-order Bragg 2θ for (hkl). */
export function reflectionOf(S, hkl, a, lambda) {
  if (isFcc(S)) {
    return reflectionInfo(hkl, a, lambda);
  }
  const G = planeNormal(S, hkl);
  const d = a / norm(G);
  const sinTheta = lambda / (2 * d);
  const factor = structureFactorOf(S, hkl);
  return {
    n: hkl,
    d,
    allowed: factor > 0,
    factor,
    magnitude: (2 * Math.PI) / d,
    G: scale(G, (2 * Math.PI) / a),
    twoTheta: sinTheta <= 1 ? (2 * Math.asin(sinTheta) * 180) / Math.PI : null,
  };
}

/** Reciprocal points (units of 2π/a); forbidden positions only when requested. */
export function reciprocalPointsOf(S, extent, includeForbidden) {
  if (isFcc(S)) {
    return reciprocalPoints(extent, includeForbidden);
  }
  const points = [];
  for (let h = -extent; h <= extent; h++) {
    for (let k = -extent; k <= extent; k++) {
      for (let l = -extent; l <= extent; l++) {
        const hkl = [h, k, l];
        const allowed = structureFactorOf(S, hkl) > 0;
        if (allowed || includeForbidden) {
          points.push({ id: `G:${hkl}`, p: planeNormal(S, hkl), hkl, allowed });
        }
      }
    }
  }
  return points;
}

/** Allowed reflections (indices ≤ 5), sorted by 2θ. */
export function braggTableOf(S, a, lambda) {
  if (isFcc(S)) {
    return braggTable(a, lambda);
  }
  const rows = [];
  for (let h = 0; h <= 5; h++) {
    for (let k = 0; k <= h; k++) {
      for (let l = 0; l <= (S.hexagonal ? 5 : k); l++) {
        if (!h && !k && !l) continue;
        const info = reflectionOf(S, [h, k, l], a, lambda);
        if (info.allowed && info.twoTheta !== null) rows.push(info);
      }
    }
  }
  return rows.sort((first, second) => first.twoTheta - second.twoTheta);
}

/** Primitive reciprocal vectors bᵢ with pᵢ·bⱼ = 2πδᵢⱼ, for lattice parameter a. */
export function reciprocalBasisOf(S, a = 1) {
  if (isFcc(S)) {
    return reciprocalBasis(a);
  }
  return reciprocalAxes(S.primitive).map((b) => scale(b, (2 * Math.PI) / a));
}
