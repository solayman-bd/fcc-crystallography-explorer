import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRIMITIVE_VECTORS,
  directionInfo,
  isLatticeTranslation,
  latticeMetrics,
  latticeSites,
} from "../src/crystal/lattice.js";
import {
  angleBetween,
  cubicFamily,
  extendedGcd,
  norm,
  parseIndices,
  tripleProduct,
} from "../src/crystal/math.js";
import { planeInfo } from "../src/crystal/planes.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );

test("one conventional cell: 14 visible sites, 4 periodic atoms", () => {
  const closed = latticeSites();
  assert.equal(closed.length, 14);
  assert.equal(latticeSites([1, 1, 1], true).length, 4);
  close(
    closed.reduce((sum, site) => sum + site.weight, 0),
    4,
  );
  assert.equal(closed.filter((site) => site.weight === 1 / 8).length, 8);
  assert.equal(closed.filter((site) => site.weight === 1 / 2).length, 6);
});

test("supercells keep 4 atoms per conventional cell", () => {
  for (const cells of [
    [2, 1, 1],
    [3, 2, 1],
    [4, 4, 4],
    [10, 10, 10],
  ]) {
    const product = cells[0] * cells[1] * cells[2];
    assert.equal(latticeSites(cells, true).length, 4 * product);
    close(
      latticeSites(cells).reduce((sum, site) => sum + site.weight, 0),
      4 * product,
    );
  }
});

test("every generated site is an FCC lattice point", () => {
  for (const site of latticeSites([2, 2, 2])) assert.ok(isLatticeTranslation(site.p), site.id);
  assert.ok(!isLatticeTranslation([0.5, 0, 0]));
  assert.ok(!isLatticeTranslation([0.5, 0.5, 0.5]));
});

test("primitive cell: a/√2 edges, 60° angles, volume a³/4", () => {
  for (const p of PRIMITIVE_VECTORS) close(norm(p), 1 / Math.SQRT2);
  close(angleBetween(PRIMITIVE_VECTORS[0], PRIMITIVE_VECTORS[1]), 60);
  close(angleBetween(PRIMITIVE_VECTORS[1], PRIMITIVE_VECTORS[2]), 60);
  close(tripleProduct(...PRIMITIVE_VECTORS), 1 / 4);
});

test("hard-sphere metrics", () => {
  const m = latticeMetrics(4.05);
  close(m.nn, 4.05 / Math.SQRT2);
  close(m.radius, (4.05 * Math.SQRT2) / 4);
  close(m.primitiveVolume, 4.05 ** 3 / 4);
  close(m.apf, Math.PI / (3 * Math.SQRT2));
});

test("direction translations: a/2[uvw] needs an even index sum", () => {
  const d110 = directionInfo([1, 1, 0], 4);
  assert.equal(d110.halfValid, true);
  close(d110.period, 4 / Math.SQRT2);
  const d111 = directionInfo([1, 1, 1], 4);
  assert.equal(d111.halfValid, false);
  close(d111.period, 4 * Math.sqrt(3));
  // Unreduced indices describe the same shortest translation.
  assert.deepEqual(directionInfo([2, 2, 0]).translation, d110.translation);
});

test("three different plane spacings", () => {
  const a = 4;
  const p111 = planeInfo([1, 1, 1], a);
  close(p111.d, a / Math.sqrt(3));
  close(p111.gap, a / Math.sqrt(3));
  close(p111.period, Math.sqrt(3) * a);
  const p001 = planeInfo([0, 0, 1], a);
  close(p001.d, a);
  close(p001.gap, a / 2);
  close(p001.period, a);
  // Scaling the indices changes geometric d, not the physical layer gap or repeat.
  const p002 = planeInfo([0, 0, 2], a);
  close(p002.d, a / 2);
  close(p002.gap, p001.gap);
  close(p002.period, p001.period);
});

test("Bézout identity from extendedGcd", () => {
  for (let a = -30; a <= 30; a++) {
    for (let b = -30; b <= 30; b++) {
      const [g, x, y] = extendedGcd(a, b);
      assert.equal(a * x + b * y, g);
      assert.ok(g >= 0);
    }
  }
});

test("cubic symmetry families", () => {
  assert.equal(cubicFamily([1, 1, 1]).length, 4);
  assert.equal(cubicFamily([1, 1, 1], true).length, 8);
  assert.equal(cubicFamily([1, 1, 0]).length, 6);
  assert.equal(cubicFamily([1, 2, 3]).length, 24);
});

test("index parsing accepts common notations and rejects invalid input", () => {
  assert.deepEqual(parseIndices("(1, -1, 0)"), [1, -1, 0]);
  assert.deepEqual(parseIndices("2 0 0"), [2, 0, 0]);
  assert.throws(() => parseIndices("0 0 0"));
  assert.throws(() => parseIndices("1 1"));
  assert.throws(() => parseIndices("25 0 0"));
  assert.throws(() => parseIndices("0.5 1 1"));
});
