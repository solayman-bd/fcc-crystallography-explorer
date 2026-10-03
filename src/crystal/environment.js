/**
 * Local environment in the infinite ideal crystal: neighbor shells, interstitial holes
 * and the Wigner–Seitz cell. Neighbors come from lattice translations, so images outside
 * the drawn box are included.
 */

import { isLatticeTranslation } from "./lattice.js";
import { add, dot, norm, subtract } from "./math.js";

/** Squared distances (units of a²) of the first three neighbor shells, indexed by shell. */
const SHELL_SQUARED = [0, 0.5, 1, 1.5];

/**
 * Neighbors of `center` up to `maxShell` (12, 6 and 24 sites at a/√2, a and a√(3/2)),
 * limited to `cutoff` (units of a).
 */
export function neighborShells(center = [0, 0, 0], maxShell = 3, cutoff = 2) {
  const neighbors = [];

  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      for (let k = -3; k <= 3; k++) {
        if ((i + j + k) % 2) {
          continue;
        }

        const vector = [i / 2, j / 2, k / 2];
        const squared = dot(vector, vector);

        if (
          !squared ||
          squared > SHELL_SQUARED[maxShell] + 1e-9 ||
          Math.sqrt(squared) > cutoff + 1e-9
        ) {
          continue;
        }
        neighbors.push({
          id: `n:${i}:${j}:${k}`,
          p: add(center, vector),
          v: vector,
          shell: SHELL_SQUARED.indexOf(squared),
          distance: Math.sqrt(squared),
        });
      }
    }
  }

  return neighbors.sort((first, second) => first.distance - second.distance);
}

/** Octahedral (edge and body centers) and tetrahedral (quarter positions) holes of the supercell. */
export function interstitialSites(kind, cells) {
  const sites = [];

  if (kind === "octa" || kind === "both") {
    for (let i = 0; i <= 2 * cells[0]; i++) {
      for (let j = 0; j <= 2 * cells[1]; j++) {
        for (let k = 0; k <= 2 * cells[2]; k++) {
          if ((i + j + k) % 2) {
            sites.push({
              id: `o:${i}:${j}:${k}`,
              p: [i / 2, j / 2, k / 2],
              type: "octa",
              coordination: 6,
              ratio: Math.SQRT2 - 1,
            });
          }
        }
      }
    }
  }

  if (kind === "tetra" || kind === "both") {
    for (let i = 0; i < 2 * cells[0]; i++) {
      for (let j = 0; j < 2 * cells[1]; j++) {
        for (let k = 0; k < 2 * cells[2]; k++) {
          sites.push({
            id: `t:${i}:${j}:${k}`,
            p: [i / 2 + 0.25, j / 2 + 0.25, k / 2 + 0.25],
            type: "tetra",
            coordination: 4,
            ratio: Math.sqrt(1.5) - 1,
          });
        }
      }
    }
  }

  return sites;
}

/** The 6 or 4 nearest host atoms of a hole. */
export function holeHosts(hole) {
  const hosts = [];

  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      for (let k = -2; k <= 2; k++) {
        const position = [i, j, k].map((offset, axis) => Math.floor(hole.p[axis]) + offset / 2);
        if (isLatticeTranslation(position)) {
          hosts.push({ p: position, distance: norm(subtract(position, hole.p)) });
        }
      }
    }
  }

  return hosts
    .sort((first, second) => first.distance - second.distance)
    .slice(0, hole.coordination);
}

/** Vertices of the FCC Wigner–Seitz cell, a rhombic dodecahedron (units of a). */
export function wignerSeitzVertices() {
  const vertices = [];

  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      vertices.push([0, 1, 2].map((index) => (index === axis ? sign * 0.5 : 0)));
    }
  }

  for (const x of [-0.25, 0.25]) {
    for (const y of [-0.25, 0.25]) {
      for (const z of [-0.25, 0.25]) {
        vertices.push([x, y, z]);
      }
    }
  }

  return vertices;
}
