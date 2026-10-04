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
 *
 * The crystal view repeats the `unit` cell: the cube for the cubic structures, and for HCP the
 * hexagonal unit cell a₁, a₂, c (a rhombic prism with 2 atoms). `cell`, `cellAtoms` and
 * `ballsInCell` describe the larger cell the Cell ⇄ Net animations cut into layers, which for
 * HCP is the hexagonal prism of three unit cells.
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
    unit: { basis: [[0, 0, 0]], atoms: 1, sites: 8, count: "8 × ⅛ = 1", sitesText: "8 corners" },
    coordination: 6,
    apf: Math.PI / 6,
    formulas: { nearest: "a", radius: "a/2", apf: "π/6", contact: "along a cube edge: 2R = a" },
    primitiveAngle: 90,
    holes: [
      {
        type: "cubic",
        name: "Cubic",
        coordination: 8,
        ratio: Math.sqrt(3) - 1,
        ratioText: "√3 − 1",
        sites: [[0.5, 0.5, 0.5]],
      },
    ],
    slip: { planes: [1, 0, 0], directions: [1, 0, 0], name: "{100}⟨010⟩", burgers: "a⟨100⟩" },
    registryPlane: [1, 1, 1],
    densePlane: [0, 0, 1],
    reciprocalName: "simple cubic",
    reciprocalBox: 1,
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
    unit: {
      basis: [
        [0, 0, 0],
        [0.5, 0.5, 0.5],
      ],
      atoms: 2,
      sites: 9,
      count: "8 × ⅛ + 1 = 2",
      sitesText: "8 corners + 1 body center",
    },
    coordination: 8,
    apf: (Math.PI * Math.sqrt(3)) / 8,
    formulas: {
      nearest: "a√3/2",
      radius: "a√3/4",
      apf: "π√3/8",
      contact: "along a body diagonal: 4R = a√3",
    },
    primitiveAngle: Math.acos(-1 / 3) * (180 / Math.PI),
    holes: [
      {
        type: "octa",
        name: "Octahedral",
        coordination: 6,
        ratio: 2 / Math.sqrt(3) - 1,
        ratioText: "2/√3 − 1",
        // Face centers and edge midpoints (a distorted octahedron: 2 hosts at a/2, 4 at a/√2).
        sites: [
          [0.5, 0.5, 0],
          [0.5, 0, 0.5],
          [0, 0.5, 0.5],
          [0.5, 0, 0],
          [0, 0.5, 0],
          [0, 0, 0.5],
        ],
      },
      {
        type: "tetra",
        name: "Tetrahedral",
        coordination: 4,
        ratio: Math.sqrt(5 / 3) - 1,
        ratioText: "√(5/3) − 1",
        // Four positions on each cube face, e.g. (½, ¼, 0).
        sites: [0, 1, 2].flatMap((axis) =>
          [
            [0.5, 0.25],
            [0.5, 0.75],
            [0.25, 0.5],
            [0.75, 0.5],
          ].map(([u, v]) => {
            const site = [0, 0, 0];
            site[(axis + 1) % 3] = u;
            site[(axis + 2) % 3] = v;
            return site;
          }),
        ),
      },
    ],
    slip: { planes: [1, 1, 0], directions: [1, 1, 1], name: "{110}⟨111⟩", burgers: "(a/2)⟨111⟩" },
    registryPlane: [1, 1, 1],
    densePlane: [1, 1, 0],
    reciprocalName: "FCC",
    reciprocalBox: 2,
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
    unit: {
      basis: [
        [0, 0, 0],
        [0, 0.5, 0.5],
        [0.5, 0, 0.5],
        [0.5, 0.5, 0],
      ],
      atoms: 4,
      sites: 14,
      count: "8 × ⅛ + 6 × ½ = 4",
      sitesText: "8 corners + 6 face centers",
    },
    coordination: 12,
    apf: Math.PI / (3 * Math.SQRT2),
    formulas: {
      nearest: "a/√2",
      radius: "a√2/4",
      apf: "π/(3√2)",
      contact: "along a face diagonal: 4R = a√2",
    },
    primitiveAngle: 60,
    holes: [
      {
        type: "octa",
        name: "Octahedral",
        coordination: 6,
        ratio: Math.SQRT2 - 1,
        ratioText: "√2 − 1",
        sites: [
          [0.5, 0.5, 0.5],
          [0.5, 0, 0],
          [0, 0.5, 0],
          [0, 0, 0.5],
        ],
      },
      {
        type: "tetra",
        name: "Tetrahedral",
        coordination: 4,
        ratio: Math.sqrt(1.5) - 1,
        ratioText: "√(3/2) − 1",
        sites: [0.25, 0.75].flatMap((x) =>
          [0.25, 0.75].flatMap((y) => [0.25, 0.75].map((z) => [x, y, z])),
        ),
      },
    ],
    slip: { planes: [1, 1, 1], directions: [1, 1, 0], name: "{111}⟨110⟩", burgers: "(a/2)⟨110⟩" },
    registryPlane: [1, 1, 1],
    densePlane: [1, 1, 1],
    reciprocalName: "BCC",
    reciprocalBox: 2,
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
    // The seven look-along buttons: [u v w] on a₁, a₂, c and their [u v t w] labels.
    looks: [
      ["1 0 0", "[2−1−10]"],
      ["0 1 0", "[−12−10]"],
      ["1 1 0", "[11−20]"],
      ["2 1 0", "[10−10]"],
      ["1 -1 0", "[1−100]"],
      ["2 1 1", "[10−11]"],
      ["0 0 1", "[0001]"],
    ],
    // [u v w] on a₁, a₂, c and the [u v t w] label of the direction picks.
    directions: [
      ["1 0 0", "[2−1−10]"],
      ["1 1 0", "[11−20]"],
      ["2 1 0", "[10−10]"],
      ["0 0 1", "[0001]"],
      ["2 1 1", "[10−11]"],
      ["1 -1 0", "[1−100]"],
    ],
    unit: {
      basis: [
        [0, 0, 0],
        [1 / 3, 2 / 3, 1 / 2],
      ],
      atoms: 2,
      sites: 9,
      count: "8 × ⅛ + 1 = 2",
      sitesText: "8 corners + 1 inside",
    },
    coordination: 12,
    apf: Math.PI / (3 * Math.SQRT2),
    formulas: {
      nearest: "a",
      radius: "a/2",
      apf: "π/(3√2)",
      contact: "along a₁ in the basal plane: 2R = a",
    },
    primitiveAngle: 120,
    holes: [
      {
        type: "octa",
        name: "Octahedral",
        coordination: 6,
        ratio: Math.SQRT2 - 1,
        ratioText: "√2 − 1",
        sites: [
          [2 / 3, 1 / 3, 1 / 4],
          [2 / 3, 1 / 3, 3 / 4],
        ],
      },
      {
        type: "tetra",
        name: "Tetrahedral",
        coordination: 4,
        ratio: Math.sqrt(1.5) - 1,
        ratioText: "√(3/2) − 1",
        sites: [
          [0, 0, 3 / 8],
          [0, 0, 5 / 8],
          [1 / 3, 2 / 3, 1 / 8],
          [1 / 3, 2 / 3, 7 / 8],
        ],
      },
    ],
    // Basal, prismatic and first-order pyramidal slip, all with ⟨a⟩ = (a/3)⟨11−20⟩.
    slip: {
      families: [
        { planes: [0, 0, 1], directions: [1, 0, 0], name: "basal" },
        { planes: [1, 0, 0], directions: [1, 0, 0], name: "prismatic" },
        { planes: [1, 0, 1], directions: [1, 0, 0], name: "pyramidal" },
      ],
      name: "⟨a⟩ slip: basal (0001), prismatic {10−10}, pyramidal {10−11}",
      burgers: "(a/3)⟨11−20⟩",
    },
    registryPlane: [0, 0, 1],
    densePlane: [0, 0, 1],
    reciprocalName: "hexagonal",
  },
};

/** Structure keys in textbook order (the order of the selector). */
export const STRUCTURE_KEYS = ["sc", "bcc", "fcc", "hcp"];

/**
 * An example element and lattice parameter for each structure (room temperature; HCP uses
 * the ideal c/a, so c differs slightly from the measured value).
 */
export const EXAMPLES = {
  sc: { element: "Po", a: 3.35, name: "α-polonium" },
  bcc: { element: "Fe", a: 2.8665, name: "α-iron" },
  fcc: { element: "Al", a: 4.05, name: "aluminium" },
  hcp: { element: "Mg", a: 3.21, name: "magnesium" },
};

/**
 * Camera direction (target → camera) when the 3D view is fitted: SC and BCC are seen further
 * off the body diagonal, along which BCC atoms line up.
 */
export const VIEW_DIRECTIONS = {
  sc: [1, -1.9, 1],
  bcc: [1, -1.9, 1],
  fcc: [1.15, -1.55, 1.15],
  hcp: [1.15, -1.55, 1.15],
};

/** Expected neighbor-shell counts and slip-system counts, for the Verify checks. */
const SHELLS = { sc: [6, 12, 8], bcc: [8, 6, 12], fcc: [12, 6, 24], hcp: [12, 6, 2] };
const SLIP_SYSTEMS = { sc: 6, bcc: 12, fcc: 12, hcp: 12 };

for (const structure of Object.values(STRUCTURES)) {
  structure.primitive = structure.primitiveFractional.map((m) => combine(structure.axes, m));
  structure.basisCartesian = structure.basis.map((f) => combine(structure.axes, f));
  structure.reciprocal = reciprocalAxes(structure.axes);
  structure.primitiveVolume = Math.abs(
    dot(structure.primitive[0], cross(structure.primitive[1], structure.primitive[2])),
  );
  structure.unitVolume = Math.abs(
    dot(structure.axes[0], cross(structure.axes[1], structure.axes[2])),
  );
  structure.cellVolume =
    structure.cell === "cube" ? 1 : 3 * Math.abs(dot(HEX_AXES[0], cross(HEX_AXES[1], HEX_AXES[2])));
  structure.shells = SHELLS[structure.key];
  structure.slipCount = SLIP_SYSTEMS[structure.key];
  structure.slipFamilies = structure.slip.families ?? [structure.slip];
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

const gcd = (x, y) => (y ? gcd(y, x % y) : Math.abs(x));

/**
 * HCP direction [u v w] on a₁, a₂, c → four-index [u v t w] with t = −(u + v), as the smallest
 * integers along the same direction (e.g. [1 0 0] = a₁ → [2 −1 −1 0]).
 */
export function bravaisDirection([u, v, w]) {
  const four = [2 * u - v, 2 * v - u, -(u + v), 3 * w];
  const g = four.reduce(gcd, 0) || 1;
  return four.map((value) => value / g + 0);
}

/**
 * Read a typed four-index HCP direction [u v t w] (t must be −(u + v)) as three-index
 * [u − t, v − t, w], reduced; null when the text is not four integers.
 */
export function fromBravaisDirection(text) {
  const values = String(text)
    .replace(/[()[\]<>]/g, "")
    .trim()
    .split(/[\s,;]+/)
    .map(Number);
  if (values.length !== 4 || !values.every(Number.isSafeInteger)) {
    return null;
  }
  const [u, v, t, w] = values;
  if (t !== -(u + v)) {
    throw new Error("In [u v t w], t must equal −(u + v).");
  }
  const three = [u - t, v - t, w];
  const g = three.reduce(gcd, 0) || 1;
  return three.map((value) => value / g + 0);
}
