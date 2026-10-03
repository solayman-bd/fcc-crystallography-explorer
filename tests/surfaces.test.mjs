import assert from "node:assert/strict";
import { test } from "node:test";
import { isLatticeTranslation } from "../src/crystal/lattice.js";
import { dot, gcdOf } from "../src/crystal/math.js";
import { planeBoxPolygon, planeInfo } from "../src/crystal/planes.js";
import { layerOffset, primitiveToCubic, surfaceCell } from "../src/crystal/surfaces.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );

test("low-index surface cells come out of the common algorithm", () => {
  const s001 = surfaceCell([0, 0, 1]);
  close(s001.angle, 90);
  assert.equal(s001.coordination, 4);
  close(s001.lengths[0], 1 / Math.SQRT2);

  const s110 = surfaceCell([1, 1, 0]);
  close(s110.angle, 90);
  assert.equal(s110.coordination, 2);
  close(s110.area, Math.SQRT2 / 2);

  const s111 = surfaceCell([1, 1, 1]);
  close(s111.angle, 60);
  assert.equal(s111.coordination, 6);
  close(s111.area, Math.sqrt(3) / 4);
});

test("every signed index triple within ±6 gives a primitive in-plane cell", () => {
  let count = 0;
  for (let h = -6; h <= 6; h++) {
    for (let k = -6; k <= 6; k++) {
      for (let l = -6; l <= 6; l++) {
        if (!h && !k && !l) continue;
        const hkl = [h, k, l];
        const cell = surfaceCell(hkl, 1);
        // Both vectors lie in the plane and are lattice translations.
        close(dot(cell.t1, hkl), 0, 1e-9);
        close(dot(cell.t2, hkl), 0, 1e-9);
        assert.ok(isLatticeTranslation(cell.t1) && isLatticeTranslation(cell.t2), hkl.join(" "));
        // Integer coefficients map to the vectors.
        assert.deepEqual(
          primitiveToCubic(cell.m1).map((v) => +v.toFixed(9)),
          cell.t1.map((v) => +v.toFixed(9)),
        );
        // Area × layer gap equals the primitive volume a³/4: the cell is primitive.
        close(cell.identity, 1 / 4, 1e-9);
        count++;
      }
    }
  }
  assert.equal(count, 2196);
});

test("unreduced indices keep the same physical surface cell", () => {
  const a = surfaceCell([1, 1, 1]);
  const b = surfaceCell([2, 2, 2]);
  close(a.area, b.area);
  close(a.identity, b.identity);
});

test("layer offsets land on occupied layers", () => {
  for (const hkl of [
    [1, 1, 1],
    [2, 1, 0],
    [1, 2, 3],
    [-3, 1, 4],
  ]) {
    const { g } = surfaceCell(hkl);
    for (let layer = -3; layer <= 3; layer++) {
      const p = layerOffset(hkl, layer);
      assert.ok(isLatticeTranslation(p));
      close(dot(p, hkl), (layer * g) / 2, 1e-9);
    }
    assert.equal(planeInfo(hkl).g, gcdOf([hkl[1] + hkl[2], hkl[0] + hkl[2], hkl[0] + hkl[1]]));
  }
});

test("plane/box intersections", () => {
  assert.equal(planeBoxPolygon([1, 1, 1], 1, [1, 1, 1]).length, 3);
  assert.equal(planeBoxPolygon([0, 0, 1], 0.5, [1, 1, 1]).length, 4);
  assert.equal(planeBoxPolygon([1, 1, 1], 1.5, [1, 1, 1]).length, 6);
  // A negative canonical plane misses the positive box instead of being moved.
  assert.equal(planeBoxPolygon([-1, -1, -1], 1, [1, 1, 1]).length, 0);
});
