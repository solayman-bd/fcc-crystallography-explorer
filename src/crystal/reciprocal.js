/**
 * Reciprocal lattice and diffraction geometry for monatomic FCC (p_i · b_j = 2πδ_ij).
 */

import { PRIMITIVE_VECTORS } from "./lattice.js";
import { cross, mod, norm, scale, tripleProduct } from "./math.js";

/** FCC selection rule: h, k, l all even or all odd. */
export const isAllowedReflection = (hkl) => hkl.every((value) => mod(value, 2) === mod(hkl[0], 2));

/** F/f = 1 + (−1)^(k+l) + (−1)^(h+l) + (−1)^(h+k): 4 when allowed, 0 when absent. */
export const structureFactor = (hkl) =>
  1 + (-1) ** (hkl[1] + hkl[2]) + (-1) ** (hkl[0] + hkl[2]) + (-1) ** (hkl[0] + hkl[1]);

/** d, G, |G| = 2π/d and the first-order Bragg 2θ (null when λ > 2d) for (hkl). */
export function reflectionInfo(hkl, a, lambda) {
  const d = a / norm(hkl);
  const sinTheta = lambda / (2 * d);
  return {
    n: hkl,
    d,
    allowed: isAllowedReflection(hkl),
    factor: structureFactor(hkl),
    magnitude: (2 * Math.PI) / d,
    G: scale(hkl, (2 * Math.PI) / a),
    twoTheta: sinTheta <= 1 ? (2 * Math.asin(sinTheta) * 180) / Math.PI : null,
  };
}

/** Reciprocal grid points in units of 2π/a; forbidden positions only when requested. */
export function reciprocalPoints(extent, includeForbidden) {
  const points = [];

  for (let h = -extent; h <= extent; h++) {
    for (let k = -extent; k <= extent; k++) {
      for (let l = -extent; l <= extent; l++) {
        const hkl = [h, k, l];
        const allowed = isAllowedReflection(hkl);

        if (allowed || includeForbidden) {
          points.push({ id: `G:${hkl}`, p: hkl, hkl, allowed });
        }
      }
    }
  }

  return points;
}

/** Primitive reciprocal vectors b1, b2, b3 for lattice parameter a. */
export function reciprocalBasis(a = 1) {
  const volume = tripleProduct(...PRIMITIVE_VECTORS);
  return [
    cross(PRIMITIVE_VECTORS[1], PRIMITIVE_VECTORS[2]),
    cross(PRIMITIVE_VECTORS[2], PRIMITIVE_VECTORS[0]),
    cross(PRIMITIVE_VECTORS[0], PRIMITIVE_VECTORS[1]),
  ].map((vector) => scale(vector, (2 * Math.PI) / (a * volume)));
}

/** Allowed reflections with 5 ≥ h ≥ k ≥ l, sorted by 2θ. */
export function braggTable(a, lambda) {
  const rows = [];

  for (let h = 0; h <= 5; h++) {
    for (let k = 0; k <= h; k++) {
      for (let l = 0; l <= k; l++) {
        if (!h && !k && !l) {
          continue;
        }

        const info = reflectionInfo([h, k, l], a, lambda);

        if (info.allowed && info.twoTheta !== null) {
          rows.push(info);
        }
      }
    }
  }

  return rows.sort((first, second) => first.twoTheta - second.twoTheta);
}
