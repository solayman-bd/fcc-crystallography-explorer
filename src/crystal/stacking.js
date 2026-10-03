/**
 * Close-packed layer stacking in an orthonormal frame:
 * x ∥ [1 −1 0], y ∥ [1 1 −2], z ∥ [111].
 */

import { add, scale } from "./math.js";

/** Registry sequences for FCC, HCP, AAA and the ideal fault and twin constructions. */
export const STACKINGS = {
  fcc: {
    name: "FCC · ABCABC",
    sequence: "ABCABCABCABC",
    note: "Three distinct registries; the fourth layer repeats A.",
  },
  hcp: {
    name: "Ideal HCP · ABAB",
    sequence: "ABABABABABAB",
    note: "Ideal close-packed HCP comparison; two-layer registry repeat.",
  },
  aaa: {
    name: "AAA · repeated registry",
    sequence: "AAAAAAAAAAAA",
    note: "Non-close-packed simple-hexagonal comparison. Height a/√2 prevents hard-sphere overlap.",
  },
  intrinsic: {
    name: "Intrinsic fault",
    sequence: "ABCABABCABCA",
    note: "Remove C from ABCABCABC… and close the gap. Ideal registry geometry only.",
  },
  extrinsic: {
    name: "Extrinsic fault",
    sequence: "ABCABACABCAB",
    note: "Insert A between B and C: ABCABACABC… . No energetic or relaxation model.",
  },
  twin: {
    name: "Coherent twin",
    sequence: "ABCABACBACBA",
    note: "Reverse cyclic order around B at layer index 4. A coherent {111} twin geometry.",
  },
};

/**
 * Points of a stacked patch of triangular layers. The ideal layer height is a/√3
 * (a/√2 for non-close-packed AAA), multiplied by the display `separation`.
 */
export function buildStack(
  kind = "fcc",
  layerCount = 6,
  repeat = 2,
  separation = 1,
  registries = "ABC",
) {
  const side = 1 / Math.sqrt(2);
  const t1 = [side, 0, 0];
  const t2 = [side / 2, (side * Math.sqrt(3)) / 2, 0];
  const shift = scale(add(t1, t2), -1 / 3);
  const height = kind === "aaa" ? side : 1 / Math.sqrt(3);
  const sequence = STACKINGS[kind].sequence.slice(0, layerCount);
  const points = [];

  for (let layer = 0; layer < layerCount; layer++) {
    const registry = sequence[layer];
    if (registries.includes(registry)) {
      for (let i = -repeat; i <= repeat; i++) {
        for (let j = -repeat; j <= repeat; j++) {
          const position = add(
            add(scale(t1, i), scale(t2, j)),
            scale(shift, "ABC".indexOf(registry)),
          );
          position[2] = layer * height * separation;
          points.push({ id: `stack:${layer}:${i}:${j}`, p: position, layer, registry });
        }
      }
    }
  }

  return { points, sequence, height, displayHeight: height * separation, t1, t2, shift };
}
