/**
 * Located Miller planes hX + kY + lZ = c and their intersection with the display box.
 */

import { directionInfo } from "./lattice.js";
import { add, dot, gcdOf, norm, normalize, orthonormalFrame, scale, subtract } from "./math.js";

/**
 * Orientation data for (hkl): unit normal, geometric d = a/|hkl|, the occupied-layer step
 * g/2 in c with g = gcd(k+l, h+l, h+k), the adjacent layer gap and the pure normal repeat.
 */
export function planeInfo(hkl, a = 1) {
  const g = gcdOf([hkl[1] + hkl[2], hkl[0] + hkl[2], hkl[0] + hkl[1]]);
  return {
    n: hkl,
    g,
    normal: normalize(hkl),
    d: a / norm(hkl),
    step: g / 2,
    gap: (a * g) / (2 * norm(hkl)),
    period: directionInfo(hkl, a).period,
  };
}

/** The level c for a location rule: canonical (c = 1), origin, box center, translated or occupied layer. */
export function planeLevel(hkl, cells, location, c, layer) {
  if (location === "origin") {
    return 0;
  } else if (location === "center") {
    return dot(hkl, scale(cells, 0.5));
  } else if (location === "layer") {
    return layer * planeInfo(hkl).step;
  } else if (location === "canonical") {
    return 1;
  } else {
    return c;
  }
}

/** Polygon where the plane meets the box [0, size], ordered around its centroid; empty if it misses. */
export function planeBoxPolygon(hkl, c, size) {
  const corners = Array.from({ length: 8 }, (_, corner) =>
    size.map((extent, axis) => ((corner >> axis) & 1) * extent),
  );
  const points = [];
  const addPoint = (point) => {
    if (!points.some((existing) => norm(subtract(point, existing)) < 1e-7)) {
      points.push(point);
    }
  };

  for (let from = 0; from < 8; from++) {
    for (let axis = 0; axis < 3; axis++) {
      const to = from ^ (1 << axis);

      if (to < from) {
        continue;
      }

      const p = corners[from];
      const q = corners[to];
      const dp = dot(hkl, p) - c;
      const dq = dot(hkl, q) - c;

      if (Math.abs(dp) < 1e-9) {
        addPoint(p);
      }

      if (Math.abs(dq) < 1e-9) {
        addPoint(q);
      }

      if (dp * dq < -1e-10) {
        addPoint(add(p, scale(subtract(q, p), dp / (dp - dq))));
      }
    }
  }

  if (points.length < 3) {
    return [];
  }

  const centroid = scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
  const [u, v] = orthonormalFrame(hkl);
  return points.sort(
    (first, second) =>
      Math.atan2(dot(subtract(first, centroid), v), dot(subtract(first, centroid), u)) -
      Math.atan2(dot(subtract(second, centroid), v), dot(subtract(second, centroid), u)),
  );
}

/** A square patch of the plane near the box, for planes drawn beyond it. */
export function extendedPlaneQuad(hkl, c, size) {
  const center = scale(size, 0.5);
  const foot = add(center, scale(hkl, (c - dot(hkl, center)) / dot(hkl, hkl)));
  const [u, v] = orthonormalFrame(hkl);
  const half = Math.max(...size) * 0.7;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([su, sv]) => add(foot, add(scale(u, su * half), scale(v, sv * half))));
}

/** Integer (or occupied-layer) levels c whose planes cross the box. */
export function planeLevelsInBox(hkl, size, occupiedOnly) {
  const min = hkl.reduce((sum, h, axis) => sum + Math.min(0, h * size[axis]), 0);
  const max = hkl.reduce((sum, h, axis) => sum + Math.max(0, h * size[axis]), 0);
  const step = occupiedOnly ? planeInfo(hkl).step : 1;
  return Array.from(
    { length: Math.floor(max / step) - Math.ceil(min / step) + 1 },
    (_, index) => (Math.ceil(min / step) + index) * step,
  );
}
