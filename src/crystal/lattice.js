/**
 * The ideal FCC lattice in conventional coordinates X = r/a.
 * Lattice points are (i, j, k)/2 with i + j + k even.
 */

import { angleBetween, gcdOf, mod, norm, scale } from "./math.js";

/** Primitive translations p1 = (a/2)[011], p2 = (a/2)[101], p3 = (a/2)[110], in units of a. */
export const PRIMITIVE_VECTORS = [
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
  [0.5, 0.5, 0],
];

/** True when a point (units of a) is an FCC lattice translation. */
export const isLatticeTranslation = (point) =>
  point.every((value) => Math.abs(2 * value - Math.round(2 * value)) < 1e-8) &&
  mod(Math.round(2 * point.reduce((sum, value) => sum + value, 0)), 2) === 0;

/**
 * Lattice sites of an Nx × Ny × Nz conventional supercell.
 * The closed drawing includes the outer faces; `uniqueOnly` keeps the half-open box
 * (4·Nx·Ny·Nz periodic atoms). Each site records its boundary mask, periodic weight 2^-b
 * and owner cell.
 */
export function latticeSites(cells = [1, 1, 1], uniqueOnly = false) {
  const sites = [];

  for (let i = 0; i <= 2 * cells[0]; i++) {
    for (let j = 0; j <= 2 * cells[1]; j++) {
      for (let k = 0; k <= 2 * cells[2]; k++) {
        if ((i + j + k) % 2) {
          continue;
        }

        const position = [i / 2, j / 2, k / 2];
        const ghost = position.some((value, axis) => value === cells[axis]);

        if (uniqueOnly && ghost) {
          continue;
        }

        const boundary = position.map((value, axis) =>
          value === 0 ? -1 : value === cells[axis] ? 1 : 0,
        );
        sites.push({
          id: `${i}:${j}:${k}`,
          p: position,
          ghost,
          boundary,
          weight: 2 ** -boundary.filter(Boolean).length,
          cell: position.map((value, axis) => Math.min(cells[axis] - 1, Math.floor(value))),
        });
      }
    }
  }

  return sites;
}

/** Length, axis angles, a/2 parity and the shortest FCC translation along [uvw]. */
export function directionInfo(uvw, a = 1) {
  const reduced = scale(uvw, 1 / gcdOf(uvw));
  const shortest = scale(
    reduced,
    mod(
      reduced.reduce((sum, value) => sum + value, 0),
      2,
    ) === 0
      ? 0.5
      : 1,
  );
  return {
    unit: unitVector(uvw),
    length: a * norm(uvw),
    halfValid:
      mod(
        uvw.reduce((sum, value) => sum + value, 0),
        2,
      ) === 0,
    translation: shortest,
    period: a * norm(shortest),
    density: 1 / (a * norm(shortest)),
    angles: [0, 1, 2].map((axis) =>
      angleBetween(
        uvw,
        [0, 1, 2].map((other) => (axis === other ? 1 : 0)),
      ),
    ),
  };
}

export const unitVector = (vector) => scale(vector, 1 / norm(vector));

/** Hard-sphere metrics for lattice parameter a: radius, nearest distance, volumes, packing fraction. */
export function latticeMetrics(a) {
  return {
    radius: a / (2 * Math.sqrt(2)),
    nn: a / Math.sqrt(2),
    volume: a ** 3,
    primitiveVolume: a ** 3 / 4,
    apf: Math.PI / (3 * Math.sqrt(2)),
  };
}

/** The eight corners of the primitive cell spanned by p1, p2, p3 from `origin`. */
export function primitiveCellCorners(origin = [0, 0, 0]) {
  return Array.from({ length: 8 }, (_, corner) =>
    origin.map(
      (value, axis) =>
        value +
        PRIMITIVE_VECTORS.reduce(
          (sum, vector, bit) => sum + ((corner >> bit) & 1) * vector[axis],
          0,
        ),
    ),
  );
}
