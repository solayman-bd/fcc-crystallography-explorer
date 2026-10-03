/**
 * Exact 2D primitive surface cells for any (hkl).
 *
 * A translation t = m1·p1 + m2·p2 + m3·p3 lies in the plane when q·m = 0 with
 * q = (k+l, h+l, h+k). An integer kernel built from Bézout identities is reduced with
 * unimodular Gauss steps, so the cell is primitive by construction; area × layer gap = a³/4
 * confirms it independently.
 */

import { PRIMITIVE_VECTORS } from "./lattice.js";
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
import { planeInfo } from "./planes.js";

/** Primitive-basis coefficients m → conventional coordinates (units of a). */
export const primitiveToCubic = (m) =>
  [0, 1, 2].map((axis) =>
    PRIMITIVE_VECTORS.reduce((sum, vector, index) => sum + vector[axis] * m[index], 0),
  );

/** Two integer vectors spanning every integer solution of q·m = 0. */
export function integerKernel(q) {
  if (!q[0] && !q[1]) {
    return [
      [1, 0, 0],
      [0, 1, 0],
    ];
  }

  const [g, x, y] = extendedGcd(q[0], q[1]);
  const gAll = gcdOf(q);
  return [
    [q[1] / g, -q[0] / g, 0],
    [(-x * q[2]) / gAll, (-y * q[2]) / gAll, g / gAll],
  ];
}

/**
 * Lagrange–Gauss reduction of a 2D lattice basis using only unimodular integer steps.
 * The integer coefficients m1, m2 follow along. Returns a right-handed basis about `normal`.
 */
export function gaussReduce(t1, t2, m1, m2, normal) {
  for (let iteration = 0; iteration < 100; iteration++) {
    if (dot(t2, t2) < dot(t1, t1) - 1e-10) {
      [t1, t2] = [t2, t1];
      [m1, m2] = [m2, m1];
    }

    const k = Math.round(dot(t1, t2) / dot(t1, t1));

    if (!k) {
      break;
    }

    t2 = subtract(t2, scale(t1, k));
    m2 = subtract(m2, scale(m1, k));
  }

  if (dot(t1, t2) < -1e-10) {
    t2 = scale(t2, -1);
    m2 = scale(m2, -1);
  }

  if (dot(cross(t1, t2), normal) < 0) {
    [t1, t2] = [t2, t1];
    [m1, m2] = [m2, m1];
  }

  return [t1, t2, m1, m2];
}

/**
 * The reduced primitive surface cell of (hkl): vectors t1, t2 and their integer
 * coefficients, lengths, angle, area, density, in-plane nearest neighbors and the
 * area × layer gap identity (equal to a³/4 for a primitive cell).
 */
export function surfaceCell(hkl, a = 1) {
  const q = [hkl[1] + hkl[2], hkl[0] + hkl[2], hkl[0] + hkl[1]];
  const [k1, k2] = integerKernel(q);
  const [t1, t2, m1, m2] = gaussReduce(primitiveToCubic(k1), primitiveToCubic(k2), k1, k2, hkl);
  const area = norm(cross(t1, t2)) * a * a;
  const ex = normalize(t1);
  const ez = normalize(hkl);
  let shortest = Infinity;
  let neighbors = [];

  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (!i && !j) {
        continue;
      }

      const vector = add(scale(t1, i), scale(t2, j));
      const length = norm(vector);

      if (length < shortest - 1e-8) {
        shortest = length;
        neighbors = [vector];
      } else if (Math.abs(length - shortest) < 1e-8) {
        neighbors.push(vector);
      }
    }
  }

  return {
    n: hkl,
    q,
    g: gcdOf(q),
    t1,
    t2,
    m1,
    m2,
    area,
    lengths: [norm(t1) * a, norm(t2) * a],
    angle: angleBetween(t1, t2),
    density: 1 / area,
    ex,
    ey: cross(ez, ex),
    ez,
    neighbors,
    coordination: neighbors.length,
    identity: area * planeInfo(hkl, a).gap,
  };
}

/** A lattice point on occupied layer `layer`: a Bézout particular solution of q·m = g·layer. */
export function layerOffset(hkl, layer) {
  const q = [hkl[1] + hkl[2], hkl[0] + hkl[2], hkl[0] + hkl[1]];
  const [g12, x1, y1] = extendedGcd(q[0], q[1]);
  const [g, x2, y2] = extendedGcd(g12, q[2]);
  return primitiveToCubic([x1 * x2 * layer, y1 * x2 * layer, y2 * layer]);
}

/** Points of one atomic layer: origin + i·t1 + j·t2 for |i|, |j| ≤ repeat. */
export function surfaceNet(cell, repeat = 3, origin = [0, 0, 0]) {
  const points = [];

  for (let i = -repeat; i <= repeat; i++) {
    for (let j = -repeat; j <= repeat; j++) {
      const position = add(origin, add(scale(cell.t1, i), scale(cell.t2, j)));
      points.push({ id: `net:${i}:${j}`, p: position, ij: [i, j] });
    }
  }

  return points;
}

/** The reduced integer cubic-translation mesh for (hkl), drawn as a dashed comparison cell. */
export function cubicMeshVectors(q) {
  const [k1, k2] = integerKernel(q);
  return gaussReduce(k1, k2, k1, k2, q).slice(0, 2);
}
