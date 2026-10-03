/**
 * {111}⟨110⟩ slip systems and a Shockley partial example.
 */

import { cubicFamily, dot, formatVector, normalize, scale } from "./math.js";

/** The twelve unoriented slip systems with Schmid factors |l̂·n̂||l̂·b̂| for loading direction `load`. */
export function slipSystems(load = [0, 0, 1]) {
  const systems = [];
  const loadDirection = normalize(load);

  for (const normal of cubicFamily([1, 1, 1])) {
    for (const direction of cubicFamily([1, 1, 0])) {
      if (dot(normal, direction) === 0) {
        systems.push({
          n: normal,
          d: direction,
          b: scale(direction, 0.5),
          schmid: Math.abs(
            dot(loadDirection, normalize(normal)) * dot(loadDirection, normalize(direction)),
          ),
          label: `(${formatVector(normal)}) [${formatVector(direction)}]`,
        });
      }
    }
  }

  return systems;
}

/** a/2[1 −1 0] = a/6[2 −1 −1] + a/6[1 −2 1] on (111), in units of a. */
export const SHOCKLEY_EXAMPLE = {
  normal: [1, 1, 1],
  perfect: [0.5, -0.5, 0],
  first: [2 / 6, -1 / 6, -1 / 6],
  second: [1 / 6, -2 / 6, 1 / 6],
};
