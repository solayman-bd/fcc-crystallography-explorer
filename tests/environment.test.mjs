import assert from "node:assert/strict";
import { test } from "node:test";
import { holeHosts, interstitialSites, neighborShells } from "../src/crystal/environment.js";
import { isLatticeTranslation } from "../src/crystal/lattice.js";
import { add, dot, norm, normalize, scale, subtract } from "../src/crystal/math.js";
import { SHOCKLEY_EXAMPLE, slipSystems } from "../src/crystal/slip.js";
import { buildStack } from "../src/crystal/stacking.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );

test("neighbor shells: 12, 6 and 24", () => {
  const all = neighborShells([0, 0, 0], 3, 2);
  const counts = [1, 2, 3].map((shell) => all.filter((n) => n.shell === shell).length);
  assert.deepEqual(counts, [12, 6, 24]);
  close(all[0].distance, 1 / Math.SQRT2);
  // Images outside the drawn box are included.
  assert.ok(all.some((n) => n.p.some((v) => v < 0)));
  // A cutoff removes part of a shell without redefining it.
  assert.equal(neighborShells([0, 0, 0], 3, 0.9).length, 12);
});

test("interstitial holes and their hosts", () => {
  const octa = interstitialSites("octa", [1, 1, 1]);
  const body = octa.find((s) => s.p.every((v) => v === 0.5));
  const bodyHosts = holeHosts(body);
  assert.equal(bodyHosts.length, 6);
  for (const h of bodyHosts) close(h.distance, 0.5);

  const tetra = interstitialSites("tetra", [1, 1, 1]);
  assert.equal(tetra.length, 8);
  const tetraHosts = holeHosts(tetra[0]);
  assert.equal(tetraHosts.length, 4);
  for (const h of tetraHosts) close(h.distance, Math.sqrt(3) / 4);

  // Hard-sphere radius ratios.
  close(body.ratio, Math.SQRT2 - 1);
  close(tetra[0].ratio, Math.sqrt(1.5) - 1);
  // Holes are never host atoms.
  for (const s of [...octa, ...tetra]) assert.ok(!isLatticeTranslation(s.p));
});

test("twelve slip systems obey the zone law, Schmid factors ≤ 0.5", () => {
  for (const load of [
    [0, 0, 1],
    [1, 1, 1],
    [1, 2, 3],
    [-2, 1, 4],
  ]) {
    const systems = slipSystems(load);
    assert.equal(systems.length, 12);
    assert.equal(new Set(systems.map((s) => s.label)).size, 12);
    for (const s of systems) {
      assert.equal(dot(s.n, s.d), 0);
      close(norm(s.b), 1 / Math.SQRT2);
      assert.ok(s.schmid <= 0.5 + 1e-12);
    }
  }
  const max001 = Math.max(...slipSystems([0, 0, 1]).map((s) => s.schmid));
  close(max001, 1 / Math.sqrt(6));
});

test("Shockley partials add up to the perfect Burgers vector", () => {
  const { normal, perfect, first, second } = SHOCKLEY_EXAMPLE;
  assert.deepEqual(
    add(first, second).map((v) => +v.toFixed(12)),
    perfect.map((v) => +v.toFixed(12)),
  );
  close(dot(first, normal), 0);
  close(dot(second, normal), 0);
  close(norm(first), 1 / Math.sqrt(6));
  close(norm(perfect), 1 / Math.SQRT2);
});

// Stack frame: x ∥ [1 −1 0], y ∥ [1 1 −2], z ∥ [111]
const E = [normalize([1, -1, 0]), normalize([1, 1, -2]), normalize([1, 1, 1])];
const toCubic = (p) => add(add(scale(E[0], p[0]), scale(E[1], p[1])), scale(E[2], p[2]));

test("ABC stacking maps back to the cubic FCC lattice; ABAB does not", () => {
  for (const point of buildStack("fcc", 12, 2).points)
    assert.ok(isLatticeTranslation(toCubic(point.p)), point.id);
  const hcp = buildStack("hcp", 3, 1).points;
  assert.ok(!hcp.every((point) => isLatticeTranslation(toCubic(point.p))));
});

test("stacked hard spheres touch but never overlap", () => {
  for (const kind of ["fcc", "hcp", "aaa"]) {
    const points = buildStack(kind, 4, 1).points.map((point) => point.p);
    let nearest = Infinity;
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        nearest = Math.min(nearest, norm(subtract(points[i], points[j])));
    close(nearest, 1 / Math.SQRT2, 1e-9);
  }
});
