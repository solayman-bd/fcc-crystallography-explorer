import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cellArray,
  cellAround,
  layerForState,
  layerGeometry,
  layerPoints,
  planeLabel,
  primitiveCell,
  stackingLetters,
  stackPlan,
} from "../src/crystal/layers.js";
import { add, norm, scale } from "../src/crystal/math.js";
import { planeInfo, planeLevel } from "../src/crystal/planes.js";
import {
  HCP_C,
  STRUCTURES,
  coordinatesIn,
  fromMillerBravais,
  millerBravais,
} from "../src/crystal/structures.js";
import { DEFAULT_STATE } from "../src/state.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );
const sorted = (values) => [...values].sort((x, y) => x - y);
const KEYS = ["sc", "bcc", "fcc", "hcp"];

/** True when a point is an atom of the structure: a lattice point plus a basis vector. */
const isAtom = (structure, point) =>
  structure.basisCartesian.some((offset) =>
    coordinatesIn(structure.primitive, add(point, scale(offset, -1))).every(
      (x) => Math.abs(x - Math.round(x)) < 1e-7,
    ),
  );

const planes = [];
for (let h = -3; h <= 3; h++)
  for (let k = -3; k <= 3; k++)
    for (let l = -3; l <= 3; l++) if (h || k || l) planes.push([h, k, l]);

test("structure data: primitive volumes, atoms per cell and nearest neighbors", () => {
  const expected = {
    sc: [1, 1, 1],
    bcc: [0.5, 2, Math.sqrt(3) / 2],
    fcc: [0.25, 4, 1 / Math.SQRT2],
    hcp: [Math.sqrt(2), 6, 1],
  };
  for (const key of KEYS) {
    const S = STRUCTURES[key];
    const [volume, atoms, nearest] = expected[key];
    close(S.primitiveVolume, volume);
    // Atoms per conventional cell = (cell volume / primitive volume) × atoms per primitive cell.
    close((S.cellVolume / S.primitiveVolume) * S.primitiveAtoms, atoms);
    assert.equal(S.cellAtoms, atoms);
    close(S.nearest, nearest);
  }
  close(HCP_C, Math.sqrt(8 / 3));
  close(STRUCTURES.hcp.primitiveVolume, (Math.sqrt(3) / 2) * HCP_C); // (√3/2)a²c
});

// Acceptance tables (lengths in units of a).
const TABLES = {
  sc: [
    { hkl: [0, 0, 1], d: 1, lengths: [1, 1], angle: [90], N: 1, type: "square" },
    {
      hkl: [1, 1, 0],
      d: 1 / Math.SQRT2,
      lengths: [1, Math.SQRT2],
      angle: [90],
      N: 2,
      type: "rectangular",
    },
    {
      hkl: [1, 1, 1],
      d: 1 / Math.sqrt(3),
      lengths: [Math.SQRT2, Math.SQRT2],
      angle: [60, 120],
      N: 3,
      type: "triangular",
    },
  ],
  bcc: [
    { hkl: [0, 0, 1], d: 1 / 2, lengths: [1, 1], angle: [90], N: 2, type: "square" },
    {
      hkl: [1, 1, 0],
      d: 1 / Math.SQRT2,
      lengths: [Math.sqrt(3) / 2, Math.sqrt(3) / 2],
      angle: [70.5288, 109.4712],
      N: 2,
      type: "centered-rectangular",
    },
    {
      hkl: [1, 1, 1],
      d: 1 / (2 * Math.sqrt(3)),
      lengths: [Math.SQRT2, Math.SQRT2],
      angle: [60, 120],
      N: 3,
      type: "triangular",
    },
    {
      hkl: [1, 1, 2],
      d: 1 / Math.sqrt(6),
      lengths: [Math.sqrt(3) / 2, Math.SQRT2],
      angle: [90],
      N: 6,
      type: "rectangular",
    },
  ],
  hcp: [
    { hkl: [0, 0, 1], d: HCP_C / 2, lengths: [1, 1], angle: [60, 120], N: 2, type: "triangular" },
    {
      hkl: [1, 0, 0],
      d: Math.sqrt(3) / 4,
      lengths: [1, HCP_C],
      angle: [90],
      N: 4,
      type: "rectangular",
    },
    {
      hkl: [1, 1, 0],
      d: 1 / 2,
      lengths: [Math.sqrt(3), HCP_C],
      angle: [90],
      N: 2,
      type: "rectangular",
    },
  ],
};

for (const [key, rows] of Object.entries(TABLES)) {
  for (const row of rows) {
    test(`${key.toUpperCase()} (${row.hkl.join("")}) layer geometry matches the acceptance table`, () => {
      const g = layerGeometry(row.hkl, 1, key);
      close(g.d, row.d);
      assert.deepEqual(
        sorted(g.lengths).map((v) => +v.toFixed(9)),
        sorted(row.lengths).map((v) => +v.toFixed(9)),
      );
      assert.ok(
        row.angle.some((angle) => Math.abs(g.angle - angle) < 1e-3),
        `angle ${g.angle}`,
      );
      assert.equal(g.period, row.N);
      assert.equal(g.type, row.type);
    });
  }
}

test("HCP layers: B atoms form their own layers on (0001) and (10−10), share them on (11−20)", () => {
  const basal = layerGeometry([0, 0, 1], 1, "hcp");
  assert.equal(basal.layersPerStep, 2);
  assert.equal(basal.atomsPerCell, 1);
  assert.equal(stackingLetters(basal, 0, 5).join(""), "ABABA");
  close(norm(basal.shift), 1 / Math.sqrt(3)); // B sits over the triangle centers
  close(basal.repeat, HCP_C);

  const prism = layerGeometry([1, 0, 0], 1, "hcp");
  assert.deepEqual(
    prism.gaps.map((gap) => +gap.toFixed(9)),
    [+(Math.sqrt(3) / 6).toFixed(9), +(Math.sqrt(3) / 3).toFixed(9)],
  );
  assert.equal(stackingLetters(prism, 0, 5).join(""), "ABCDA");
  assert.equal(planeLabel([1, 0, 0], "hcp"), "1 0 −1 0");

  const secondary = layerGeometry([1, 1, 0], 1, "hcp");
  assert.equal(secondary.layersPerStep, 1);
  assert.equal(secondary.atomsPerCell, 2);
  assert.equal(secondary.centered, null);
  assert.equal(planeLabel([1, 1, 0], "hcp"), "1 1 −2 0");
  assert.equal(planeLabel([0, 0, 1], "hcp"), "0001");
});

test("(h k i l) input: i must be −(h + k)", () => {
  assert.deepEqual(fromMillerBravais("1 0 -1 0"), [1, 0, 0]);
  assert.deepEqual(fromMillerBravais("(1 1 -2 2)"), [1, 1, 2]);
  assert.equal(fromMillerBravais("1 1 1"), null);
  assert.throws(() => fromMillerBravais("1 0 0 0"));
  assert.deepEqual(millerBravais([1, 0, 1]), [1, 0, -1, 1]);
});

test("every structure and plane: area × lattice step = primitive volume and N·d = normal repeat", () => {
  for (const key of KEYS) {
    for (const hkl of planes) {
      const g = layerGeometry(hkl, 1, key);
      close((g.area * g.step) / g.gNorm, STRUCTURES[key].primitiveVolume, 1e-9);
      close(g.period * g.d, g.repeat, 1e-7);
      close(
        g.gaps.reduce((sum, gap) => sum + gap, 0),
        g.d * g.layersPerStep,
      );
    }
  }
});

test("every structure and plane: the stack fills one cell with 8, 9, 14 or 17 balls", () => {
  for (const key of KEYS) {
    const S = STRUCTURES[key];
    for (const hkl of planes) {
      const g = layerGeometry(hkl, 1, key);
      for (const layer of [-2, 0, 1, 3]) {
        const cell = cellAround(g, layer);
        assert.equal(cell.balls.length, S.ballsInCell, `${key} ${hkl} ${layer}`);
        // The selected layer holds balls of the cell and cuts it in a real polygon.
        const slice = cell.slices.find((s) => s.layer === layer);
        assert.ok(slice && slice.polygon.length >= 3, `${key} ${hkl} layer ${layer}`);
        const plan = stackPlan(g, layer);
        assert.equal(plan.points.filter((p) => p.inCell).length, S.ballsInCell, `${key} ${hkl}`);
      }
      for (const point of layerPoints(g, 1, [0.5, 0.5, 0.5], 2)) {
        assert.ok(isAtom(S, point.p), `${key} ${hkl} ${point.id}`);
      }
    }
  }
});

test("3D arrays and primitive cells", () => {
  const counts = { sc: [64, 8], bcc: [91, 8], fcc: [172, 8], hcp: [187, 9] };
  for (const key of KEYS) {
    const g = layerGeometry([0, 0, 1], 1, key);
    const cell = cellAround(g, 1);
    const array = cellArray(g, cell);
    assert.equal(array.atoms.length, counts[key][0], key);
    assert.equal(array.atoms.filter((atom) => atom.inCell).length, STRUCTURES[key].ballsInCell);
    const prim = primitiveCell(g, cell.origin);
    assert.equal(prim.atoms.length, counts[key][1], key);
    for (const atom of [...array.atoms, ...prim.atoms]) assert.ok(isAtom(STRUCTURES[key], atom.p));
  }
});

test("FCC: the layer chosen for the panel's plane is the one the Surface net always used", () => {
  for (const hkl of [
    [1, 1, 1],
    [0, 0, 2],
    [2, 1, 0],
    [1, -1, 0],
  ]) {
    const g = layerGeometry(hkl);
    for (const location of ["canonical", "origin", "center", "translated", "layer"]) {
      for (const level of [-2.5, 0, 1, 3.25]) {
        const state = { ...DEFAULT_STATE, hkl, location, c: level, layer: 3, N: [2, 1, 1] };
        const old = Math.round(
          planeLevel(hkl, state.N, location, state.c, state.layer) / planeInfo(hkl).step,
        );
        assert.equal(layerForState(g, state), old, `${hkl} ${location} ${level}`);
      }
    }
  }
});
