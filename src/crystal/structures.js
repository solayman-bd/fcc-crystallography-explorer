/**
 * The crystal structures of the Cell ⇄ Net animations: simple cubic, BCC, FCC and HCP.
 *
 * Each one is a Bravais lattice (primitive vectors) plus a basis, in Cartesian units of a.
 * Miller indices refer to the conventional axes: the cube edges, or a₁, a₂, c for HCP
 * (ideal c/a = √(8/3)), where (h k l) is written (h k i l) with i = −(h + k).
 */

import { PRIMITIVE_VECTORS } from "./lattice.js";
import { cross, dot, scale } from "./math.js";

/** Ideal HCP axial ratio c/a = √(8/3) ≈ 1.633 (touching hard spheres). */
export const HCP_C = Math.sqrt(8 / 3);

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const HEX_AXES = [
  [1, 0, 0],
  [-0.5, Math.sqrt(3) / 2, 0],
  [0, 0, HCP_C],
];

/** Reciprocal axes bᵢ with bᵢ·aⱼ = δᵢⱼ (no 2π). */
export function reciprocalAxes(axes) {
  const [a1, a2, a3] = axes;
  const volume = dot(a1, cross(a2, a3));
  return [cross(a2, a3), cross(a3, a1), cross(a1, a2)].map((b) => scale(b, 1 / volume));
}

/** Coordinates of a Cartesian vector in a (not necessarily orthogonal) basis. */
export function coordinatesIn(axes, vector) {
  return reciprocalAxes(axes).map((b) => dot(b, vector));
}

/** Σ cᵢ·axesᵢ. */
export const combine = (axes, coefficients) =>
  [0, 1, 2].map((k) => axes.reduce((sum, axis, i) => sum + axis[k] * coefficients[i], 0));

/**
 * Structure data. `primitiveFractional` gives the primitive vectors in conventional fractional
 * coordinates; multiplied by `denominator` they turn plane slice values into integers.
 */
export const STRUCTURES = {
  sc: {
    key: "sc",
    name: "Simple cubic",
    short: "SC",
    axes: IDENTITY,
    primitiveFractional: IDENTITY,
    denominator: 1,
    basis: [[0, 0, 0]],
    cell: "cube",
    cellName: "cube",
    cellAtoms: 1,
    primitiveVolumeText: "a³",
    cellVolumeText: "a³",
    ballsInCell: 8,
    ballsText: "8 corners",
    cellCountText: "8 corners × ⅛ = 1 atom",
    primitiveAtoms: 1,
    primitiveCountText: "8 corners × ⅛ = 1 atom",
    vectorLabels: ["a₁", "a₂", "a₃"],
    physicalRadius: 0.5,
    nearest: 1,
  },
  bcc: {
    key: "bcc",
    name: "Body-centered cubic",
    short: "BCC",
    axes: IDENTITY,
    primitiveFractional: [
      [-0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
    denominator: 2,
    basis: [[0, 0, 0]],
    cell: "cube",
    cellName: "cube",
    cellAtoms: 2,
    primitiveVolumeText: "a³/2",
    cellVolumeText: "a³",
    ballsInCell: 9,
    ballsText: "8 corners + 1 body center",
    cellCountText: "8 corners × ⅛ + 1 body center = 2 atoms",
    primitiveAtoms: 1,
    primitiveCountText: "8 corners × ⅛ = 1 atom",
    vectorLabels: ["a₁", "a₂", "a₃"],
    physicalRadius: Math.sqrt(3) / 4,
    nearest: Math.sqrt(3) / 2,
  },
  fcc: {
    key: "fcc",
    name: "Face-centered cubic",
    short: "FCC",
    axes: IDENTITY,
    primitiveFractional: PRIMITIVE_VECTORS,
    denominator: 2,
    basis: [[0, 0, 0]],
    cell: "cube",
    cellName: "cube",
    cellAtoms: 4,
    primitiveVolumeText: "a³/4",
    cellVolumeText: "a³",
    ballsInCell: 14,
    ballsText: "8 corners + 6 face centers",
    cellCountText: "8 corners × ⅛ + 6 face centers × ½ = 4 atoms",
    primitiveAtoms: 1,
    primitiveCountText: "8 corners × ⅛ = 1 atom",
    vectorLabels: ["a₁", "a₂", "a₃"],
    physicalRadius: 1 / (2 * Math.SQRT2),
    nearest: 1 / Math.SQRT2,
  },
  hcp: {
    key: "hcp",
    name: "Hexagonal close-packed",
    short: "HCP",
    axes: HEX_AXES,
    primitiveFractional: IDENTITY,
    denominator: 1,
    basis: [
      [0, 0, 0],
      [1 / 3, 2 / 3, 1 / 2],
    ],
    cell: "prism",
    cellName: "hexagonal prism",
    cellAtoms: 6,
    primitiveVolumeText: "(√3/2)a²c",
    cellVolumeText: "3 × (√3/2)a²c",
    ballsInCell: 17,
    ballsText: "12 corners + 2 face centers + 3 inside",
    cellCountText: "12 corners × ⅙ + 2 face centers × ½ + 3 inside = 6 atoms",
    primitiveAtoms: 2,
    primitiveCountText: "8 corners × ⅛ + 1 inside = 2 atoms",
    vectorLabels: ["a₁", "a₂", "c"],
    physicalRadius: 0.5,
    nearest: 1,
    hexagonal: true,
    // [h k l] of the 3-index input and the (h k i l) label of the quick picks.
    planes: [
      ["0 0 1", "(0001)"],
      ["1 0 0", "(10−10)"],
      ["1 1 0", "(11−20)"],
      ["1 0 1", "(10−11)"],
      ["1 0 2", "(10−12)"],
    ],
  },
};

/** Structure keys in textbook order (the order of the selector). */
export const STRUCTURE_KEYS = ["sc", "bcc", "fcc", "hcp"];

for (const structure of Object.values(STRUCTURES)) {
  structure.primitive = structure.primitiveFractional.map((m) => combine(structure.axes, m));
  structure.basisCartesian = structure.basis.map((f) => combine(structure.axes, f));
  structure.reciprocal = reciprocalAxes(structure.axes);
  structure.primitiveVolume = Math.abs(
    dot(structure.primitive[0], cross(structure.primitive[1], structure.primitive[2])),
  );
  structure.cellVolume =
    structure.cell === "cube" ? 1 : 3 * Math.abs(dot(HEX_AXES[0], cross(HEX_AXES[1], HEX_AXES[2])));
}

/** A structure by key; FCC when the key is missing. */
export const structureOf = (key = "fcc") => STRUCTURES[key] ?? STRUCTURES.fcc;

/** HCP (h k l) → Miller–Bravais (h k i l) with i = −(h + k). */
export const millerBravais = ([h, k, l]) => [h, k, -(h + k), l];

/**
 * Read typed HCP indices: three (h k l) or four (h k i l) integers; with four, i must be
 * −(h + k). Returns the three-index form, or null when the text is not four integers.
 */
export function fromMillerBravais(text) {
  const values = String(text)
    .replace(/[()[\]<>]/g, "")
    .trim()
    .split(/[\s,;]+/)
    .map(Number);
  if (values.length !== 4 || !values.every(Number.isSafeInteger)) {
    return null;
  }
  const [h, k, i, l] = values;
  if (i !== -(h + k)) {
    throw new Error("In (h k i l), i must equal −(h + k).");
  }
  return [h, k, l];
}
