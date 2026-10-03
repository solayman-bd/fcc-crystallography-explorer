import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCut,
  cubeAround,
  layerGeometry,
  projectedSpots,
  reduceIndices,
  stackPlan,
} from "../src/crystal/layers.js";
import { isLatticeTranslation } from "../src/crystal/lattice.js";
import { add, norm, scale } from "../src/crystal/math.js";
import { surfaceCell } from "../src/crystal/surfaces.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );
const sorted = (values) => [...values].sort((x, y) => x - y);

// Acceptance table (lengths in units of a).
const TABLE = [
  {
    hkl: [0, 0, 1],
    d: 1 / 2,
    lengths: [1 / Math.SQRT2, 1 / Math.SQRT2],
    angle: [90],
    area: 1 / 2,
    N: 2,
    type: "square",
  },
  {
    hkl: [1, 1, 0],
    d: 1 / (2 * Math.SQRT2),
    lengths: [1 / Math.SQRT2, 1],
    angle: [90],
    area: 1 / Math.SQRT2,
    N: 2,
    type: "rectangular",
  },
  {
    hkl: [1, 1, 1],
    d: 1 / Math.sqrt(3),
    lengths: [1 / Math.SQRT2, 1 / Math.SQRT2],
    angle: [60, 120],
    area: Math.sqrt(3) / 4,
    N: 3,
    type: "triangular",
  },
  {
    hkl: [1, 1, 2],
    d: 1 / (2 * Math.sqrt(6)),
    lengths: [1 / Math.SQRT2, Math.sqrt(3)],
    angle: [90],
    area: Math.sqrt(1.5),
    N: 6,
    type: "rectangular",
  },
  {
    hkl: [2, 1, 0],
    d: 1 / (2 * Math.sqrt(5)),
    lengths: [1, Math.sqrt(1.5)],
    angle: [65.905],
    area: Math.sqrt(5) / 2,
    N: 10,
    type: "centered-rectangular",
  },
];

for (const row of TABLE) {
  test(`(${row.hkl.join("")}) layer geometry matches the acceptance table`, () => {
    const g = layerGeometry(row.hkl);
    close(g.d, row.d);
    assert.deepEqual(
      sorted(g.lengths).map((v) => +v.toFixed(9)),
      sorted(row.lengths).map((v) => +v.toFixed(9)),
    );
    assert.ok(
      row.angle.some((angle) => Math.abs(g.angle - angle) < 1e-3),
      `angle ${g.angle}`,
    );
    close(g.area, row.area);
    assert.equal(g.period, row.N);
    assert.equal(g.type, row.type);
    // Area per atom is 1 / planar density, and d × 4/a³ is the planar density.
    close(g.area, 1 / surfaceCell(row.hkl).density);
    close(g.d * 4, g.density);
  });
}

test("period N: N interlayer shifts add up to a net vector, fewer do not", () => {
  for (const hkl of [
    [0, 0, 1],
    [1, 1, 0],
    [1, 1, 1],
    [1, 1, 2],
    [2, 1, 0],
    [1, 2, 3],
    [3, 1, 1],
    [4, 3, 1],
  ]) {
    const g = layerGeometry(hkl);
    const integral = (j) =>
      g.shiftFractions.every((f) => Math.abs(j * f - Math.round(j * f)) < 1e-7);
    assert.ok(integral(g.period), hkl.join(" "));
    for (let j = 1; j < g.period; j++) assert.ok(!integral(j), `${hkl.join(" ")} j=${j}`);
    close(g.period * g.d, g.repeat); // N·d is the shortest lattice vector along the normal
  }
});

test("(1 −1 0) behaves like (110); (002) reduces to (001)", () => {
  const a = layerGeometry([1, -1, 0]);
  const b = layerGeometry([1, 1, 0]);
  for (const key of ["d", "area", "period", "angle", "type"]) assert.equal(a[key], b[key], key);
  assert.deepEqual(reduceIndices([0, 0, 2]), [0, 0, 1]);
  const c = layerGeometry([0, 0, 2]);
  assert.deepEqual(c.hkl, [0, 0, 1]);
  close(c.d, 0.5);
  assert.throws(() => reduceIndices([0, 0, 0]));
});

test("centered cells: a × a for (001), a/√2 × a√(3/2) for (111), none for (110)", () => {
  const c001 = layerGeometry([0, 0, 1]).centered;
  assert.deepEqual(
    sorted([norm(c001.u), norm(c001.v)]).map((v) => +v.toFixed(9)),
    [1, 1],
  );
  const c111 = layerGeometry([1, 1, 1]).centered;
  assert.deepEqual(
    sorted([norm(c111.u), norm(c111.v)]).map((v) => +v.toFixed(9)),
    [+(1 / Math.SQRT2).toFixed(9), +Math.sqrt(1.5).toFixed(9)],
  );
  assert.equal(layerGeometry([1, 1, 0]).centered, null);
  assert.ok(layerGeometry([2, 1, 0]).centered);
});

test("the cube cut by the selected layer", () => {
  for (const [hkl, layer, shape, isCell, layers, perLayer, spots] of [
    [[1, 1, 1], 1, "triangle", false, 4, [1, 6, 6, 1], 13],
    [[0, 0, 1], 1, "square", true, 3, [5, 4, 5], 9],
    [[1, 1, 0], 2, "rectangle", true, 5, [2, 2, 6, 2, 2], 8],
  ]) {
    const g = layerGeometry(hkl);
    const cube = cubeAround(g, layer);
    assert.equal(cube.balls.length, 14);
    assert.equal(cube.layers.length, layers);
    assert.deepEqual(
      cube.slices.map((s) => s.count),
      perLayer,
    );
    assert.equal(projectedSpots(g, cube.balls), spots);
    const selected = cube.slices.find((s) => s.layer === layer);
    const cut = classifyCut(g, selected.polygon);
    assert.equal(cut.shape, shape);
    assert.equal(cut.isCell, isCell);
    if (isCell) assert.equal(cut.atoms, 2);
  }
});

test("any selected layer cuts through the cube, including far-away layers", () => {
  for (const hkl of [
    [1, 1, 1],
    [0, 0, 1],
    [2, 1, 0],
    [1, 2, 3],
  ]) {
    const g = layerGeometry(hkl);
    for (const layer of [-7, -1, 0, 1, 2, 9, 40]) {
      const cube = cubeAround(g, layer);
      assert.ok(cube.layers.includes(layer), `${hkl.join(" ")} layer ${layer}`);
      assert.ok(isLatticeTranslation(cube.origin));
      const slice = cube.slices.find((s) => s.layer === layer);
      assert.ok(slice.polygon.length >= 3, `${hkl.join(" ")} layer ${layer} cut is degenerate`);
    }
  }
});

test("Build mode: the stack fills one conventional cube with exactly 14 balls", () => {
  const cases = [
    [0, 0, 1],
    [1, 1, 0],
    [1, 1, 1],
    [1, 1, 2],
    [2, 1, 0],
    [1, -1, 0],
    [0, 0, 2],
    [1, 2, 3],
    [3, 1, 1],
    [3, 3, 1],
    [4, 2, 1],
    [5, 3, 2],
  ];
  for (const hkl of cases) {
    const g = layerGeometry(hkl);
    for (const layer of [0, 1, 3]) {
      const plan = stackPlan(g, layer);
      const inside = plan.points.filter((point) => point.inCube);
      assert.equal(inside.length, 14, `${hkl.join(" ")} layer ${layer}`);
      for (const point of plan.points) assert.ok(isLatticeTranslation(point.p));
    }
  }
});

test("the interlayer shift is the shortest in-plane offset to the next layer", () => {
  for (const hkl of [
    [1, 1, 1],
    [1, 1, 0],
    [0, 0, 1],
    [2, 1, 0],
    [1, 1, 2],
    [3, 1, 1],
  ]) {
    const g = layerGeometry(hkl);
    for (let i = -2; i <= 2; i++) {
      for (let k = -2; k <= 2; k++) {
        const other = add(g.shift, add(scale(g.t1, i), scale(g.t2, k)));
        assert.ok(norm(other) >= norm(g.shift) - 1e-12, `${hkl.join(" ")} ${i},${k}`);
      }
    }
  }
  close(norm(layerGeometry([1, 1, 1]).shift), 1 / Math.sqrt(6)); // a/√6 for ABC stacking
});

test("stacked layers sit d apart along the normal and shift by the interlayer vector", () => {
  for (const hkl of [
    [1, 1, 1],
    [1, 1, 0],
    [2, 1, 0],
  ]) {
    const g = layerGeometry(hkl);
    const plan = stackPlan(g, 0);
    const first = plan.points.find((p) => p.layer === 0);
    // Moving one layer up by d along the normal plus the shift lands on a lattice point.
    const next = add(first.p, add(scale(g.normal, g.d), g.shift));
    assert.ok(isLatticeTranslation(next), hkl.join(" "));
  }
});
