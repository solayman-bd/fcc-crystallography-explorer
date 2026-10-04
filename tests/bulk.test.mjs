import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atomsNear,
  directionOf,
  familyOf,
  holesOf,
  hostsOf,
  neighborsOf,
  partialsOf,
  planeLevelOf,
  prismSites,
  reflectionOf,
  regionOf,
  sitesOf,
  slipSystemsOf,
  structureFactorOf,
  wignerSeitzOf,
} from "../src/crystal/bulk.js";
import { add, dot, norm } from "../src/crystal/math.js";
import { STRUCTURES, bravaisDirection, fromBravaisDirection } from "../src/crystal/structures.js";
import { runChecks } from "../src/crystal/verify.js";
import { DEFAULT_STATE } from "../src/state.js";
import { calculationReport, structureFile } from "../src/exports.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );
const KEYS = ["sc", "bcc", "fcc", "hcp"];
const isAtom = (S, p) => atomsNear(S, p, 1e-6).length === 1;

test("unit cells: closed sites, unique atoms and periodic weights", () => {
  for (const key of KEYS) {
    const S = STRUCTURES[key];
    const closed = sitesOf(S);
    assert.equal(closed.length, S.unit.sites, key);
    assert.equal(sitesOf(S, [1, 1, 1], true).length, S.unit.atoms, key);
    close(
      closed.reduce((sum, site) => sum + site.weight, 0),
      S.unit.atoms,
    );
    // A 2 × 3 × 1 supercell has 6 × as many unique atoms, all of them real atoms.
    const unique = sitesOf(S, [2, 3, 1], true);
    assert.equal(unique.length, 6 * S.unit.atoms, key);
    for (const site of unique) assert.ok(isAtom(S, site.p), `${key} ${site.id}`);
  }
});

test("the HCP hexagonal prism: 17 sites, 12/6 + 2/2 + 3 = 6 atoms per story", () => {
  const S = STRUCTURES.hcp;
  for (const stories of [1, 2, 3]) {
    const sites = prismSites(S, stories);
    assert.equal(sites.length, 7 * (stories + 1) + 3 * stories);
    close(
      sites.reduce((sum, site) => sum + site.weight, 0),
      6 * stories,
    );
    for (const site of sites) assert.ok(isAtom(S, site.p), site.id);
  }
  // Each prism corner is clipped by its two side faces and its top or bottom face.
  const corner = prismSites(S).find((site) => site.id === "P:0:corner0");
  assert.equal(corner.clip.length, 3);
});

test("neighbor shells: SC 6/12/8, BCC 8/6/12, HCP 12/6/2", () => {
  const expected = {
    sc: [1, Math.SQRT2, Math.sqrt(3)],
    bcc: [Math.sqrt(3) / 2, 1, Math.SQRT2],
    hcp: [1, Math.SQRT2, Math.sqrt(8 / 3)],
  };
  for (const key of ["sc", "bcc", "hcp"]) {
    const S = STRUCTURES[key];
    // From an A atom and, for HCP, from a B atom: both have the same shells.
    for (const center of [[0, 0, 0], S.basisCartesian.at(-1)]) {
      const neighbors = neighborsOf(S, center, 3, 3);
      [0, 1, 2].forEach((index) => {
        const shell = neighbors.filter((neighbor) => neighbor.shell === index + 1);
        assert.equal(shell.length, S.shells[index], `${key} shell ${index + 1}`);
        for (const neighbor of shell) close(neighbor.distance, expected[key][index]);
      });
      for (const neighbor of neighbors) assert.ok(isAtom(S, neighbor.p));
    }
    // A cutoff below the second shell keeps only the first.
    assert.equal(neighborsOf(S, [0, 0, 0], 3, S.nearest + 0.01).length, S.coordination);
  }
});

test("interstitial holes: counts per cell and equal-distance hosts", () => {
  const perCell = { sc: { cubic: 1 }, bcc: { octa: 6, tetra: 12 }, hcp: { octa: 2, tetra: 4 } };
  for (const [key, counts] of Object.entries(perCell)) {
    const S = STRUCTURES[key];
    for (const [type, count] of Object.entries(counts)) {
      // Holes of a 2 × 2 × 2 box, counted with periodic weights 2^-b.
      const holes = holesOf(S, type, [2, 2, 2]);
      const weight = holes.reduce(
        (sum, hole) =>
          sum + 2 ** -hole.f.filter((value) => value < 1e-9 || Math.abs(value - 2) < 1e-9).length,
        0,
      );
      close(weight, 8 * count);
      for (const hole of holes.slice(0, 6)) {
        const hosts = hostsOf(S, hole);
        assert.equal(hosts.length, hole.coordination);
        // The radius ratio follows from the nearest host and the hard-sphere radius.
        close(hosts[0].distance / S.physicalRadius - 1, hole.ratio, 1e-7);
        if (key !== "bcc" || type === "tetra") {
          close(hosts.at(-1).distance, hosts[0].distance, 1e-7);
        }
      }
    }
  }
  // BCC octahedral holes are distorted: two hosts at a/2, four at a/√2.
  const [hole] = holesOf(STRUCTURES.bcc, "octa", [1, 1, 1]);
  const distances = hostsOf(STRUCTURES.bcc, hole).map((host) => +host.distance.toFixed(6));
  assert.deepEqual(distances, [0.5, 0.5, 0.707107, 0.707107, 0.707107, 0.707107]);
  // HCP prism region: holes stay inside the prism.
  const region = regionOf(STRUCTURES.hcp, { ...DEFAULT_STATE, structure: "hcp", hexPrism: true });
  for (const prismHole of holesOf(STRUCTURES.hcp, "both", [1, 1, 1], region)) {
    assert.ok(region.contains(prismHole.p));
  }
});

test("Wigner–Seitz cells: cube, truncated octahedron, hexagonal prism", () => {
  const vertexCount = { sc: 8, bcc: 24, hcp: 12 };
  for (const [key, count] of Object.entries(vertexCount)) {
    const S = STRUCTURES[key];
    const vertices = wignerSeitzOf(S);
    assert.equal(vertices.length, count, key);
    // Every vertex is as close to the origin as to its nearest other lattice points.
    for (const vertex of vertices) {
      const nearest = Math.min(
        ...atomsNear(S, vertex, 2)
          .filter((atom) => atom.basis === 0)
          .map((atom) => atom.distance),
      );
      close(norm(vertex), nearest, 1e-7);
    }
  }
});

test("directions: shortest translations", () => {
  const cases = [
    ["sc", [1, 1, 1], Math.sqrt(3)],
    ["sc", [1, 1, 0], Math.SQRT2],
    ["bcc", [1, 1, 1], Math.sqrt(3) / 2],
    ["bcc", [1, 1, 0], Math.SQRT2],
    ["bcc", [1, 0, 0], 1],
    ["hcp", [1, 0, 0], 1],
    ["hcp", [1, 1, 0], 1],
    ["hcp", [2, 1, 0], Math.sqrt(3)],
    ["hcp", [0, 0, 1], Math.sqrt(8 / 3)],
  ];
  for (const [key, uvw, period] of cases) {
    close(directionOf(STRUCTURES[key], uvw, 1).period, period);
  }
  assert.deepEqual(bravaisDirection([1, 0, 0]), [2, -1, -1, 0]);
  assert.deepEqual(bravaisDirection([2, 1, 0]), [1, 0, -1, 0]);
  assert.deepEqual(fromBravaisDirection("[2 -1 -1 0]"), [1, 0, 0]);
  assert.deepEqual(fromBravaisDirection("1 1 -2 0"), [1, 1, 0]);
  assert.throws(() => fromBravaisDirection("1 0 0 0"));
});

test("hexagonal symmetry families", () => {
  const S = STRUCTURES.hcp;
  assert.equal(familyOf(S, [0, 0, 1]).length, 1);
  assert.equal(familyOf(S, [1, 0, 0]).length, 3);
  assert.equal(familyOf(S, [1, 0, 1]).length, 6);
  assert.equal(familyOf(S, [1, 1, 0]).length, 3);
  assert.equal(familyOf(S, [1, 0, 0], true).length, 6);
  // The three ⟨a⟩ directions a₁, a₂, a₃ = −(a₁ + a₂).
  const directions = familyOf(S, [1, 0, 0], false, "direction").map((d) => d.join(","));
  assert.deepEqual(directions.sort(), ["0,1,0", "1,0,0", "1,1,0"]);
});

test("slip systems: SC 6, BCC 12, HCP 3 + 3 + 6, with |b| = nearest-neighbor distance", () => {
  for (const key of ["sc", "bcc", "hcp"]) {
    const S = STRUCTURES[key];
    for (const load of [
      [0, 0, 1],
      [1, 2, 3],
      [1, 0, 0],
    ]) {
      const systems = slipSystemsOf(S, load);
      assert.equal(systems.length, S.slipCount, key);
      for (const system of systems) {
        assert.ok(system.schmid <= 0.5 + 1e-9);
        close(norm(system.b), S.nearest);
        close(dot(system.b, system.normal), 0, 1e-9); // b lies in the slip plane
      }
    }
  }
  const families = slipSystemsOf(STRUCTURES.hcp).map((system) => system.family);
  assert.deepEqual(
    ["basal", "prismatic", "pyramidal"].map((name) => families.filter((f) => f === name).length),
    [3, 3, 6],
  );
  // Loading along c gives no resolved shear on any ⟨a⟩ system.
  for (const system of slipSystemsOf(STRUCTURES.hcp, [0, 0, 1])) close(system.schmid, 0, 1e-9);
});

test("partials: FCC Shockley and HCP basal; none for SC and BCC", () => {
  assert.equal(partialsOf(STRUCTURES.sc), null);
  assert.equal(partialsOf(STRUCTURES.bcc), null);
  for (const key of ["fcc", "hcp"]) {
    const partials = partialsOf(STRUCTURES[key]);
    const sum = add(partials.first, partials.second);
    for (let axis = 0; axis < 3; axis++) close(sum[axis], partials.perfect[axis]);
    close(norm(partials.first), partials.partialLength);
    close(norm(partials.perfect), partials.perfectLength);
  }
});

test("diffraction: structure factors and selection rules", () => {
  const F = (key, hkl) => structureFactorOf(STRUCTURES[key], hkl);
  for (const hkl of [
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ])
    close(F("sc", hkl), 1);
  close(F("bcc", [1, 0, 0]), 0);
  close(F("bcc", [1, 1, 1]), 0);
  close(F("bcc", [1, 1, 0]), 2);
  close(F("bcc", [2, 0, 0]), 2);
  close(F("hcp", [0, 0, 1]), 0);
  close(F("hcp", [0, 0, 2]), 2);
  close(F("hcp", [1, 0, 0]), 1);
  close(F("hcp", [1, 0, 1]), Math.sqrt(3));
  close(F("hcp", [1, 1, 0]), 2);
  // d spacings: HCP 1/d² = 4(h² + hk + k²)/(3a²) + l²/c².
  const reflection = reflectionOf(STRUCTURES.hcp, [1, 0, 1], 3.21, 1.5406);
  close(1 / reflection.d ** 2, 4 / (3 * 3.21 ** 2) + 1 / (3.21 * Math.sqrt(8 / 3)) ** 2);
  close(reflectionOf(STRUCTURES.bcc, [1, 1, 0], 2.8665, 1.5406).d, 2.8665 / Math.SQRT2);
});

test("located planes in HCP: occupied layers and the prism center", () => {
  const S = STRUCTURES.hcp;
  // (0001): layers at c = 0, ½, 1, …; layer 3 is at c = 3/2.
  close(planeLevelOf(S, [0, 0, 1], [1, 1, 1], "layer", 0, 3), 1.5);
  const region = regionOf(S, { ...DEFAULT_STATE, N: [1, 1, 2], structure: "hcp", hexPrism: true });
  close(planeLevelOf(S, [0, 0, 1], region.levelCells, "center", 0, 0), 1);
  // A (10−10) plane through the prism axis cuts the prism in a rectangle.
  assert.equal(region.polygon([1, 0, 0], 0).length, 4);
});

test("exports and Verify for every structure", () => {
  for (const key of KEYS) {
    const S = STRUCTURES[key];
    const state = { ...DEFAULT_STATE, structure: key, N: [2, 1, 1] };
    const xyz = structureFile(state, "xyz").trim().split("\n");
    assert.equal(Number(xyz[0]), 2 * S.unit.atoms, key);
    const cif = structureFile(state, "cif");
    assert.ok(cif.includes(`_cell_angle_gamma ${S.hexagonal ? 120 : 90}`), key);
    assert.ok(calculationReport(state).includes("## Verification"));
    for (const hkl of [
      [1, 1, 1],
      [0, 0, 1],
      [2, 1, 0],
      [1, 0, 1],
    ]) {
      for (const load of [
        [0, 0, 1],
        [1, 2, 3],
      ]) {
        const failed = runChecks(state.a, hkl, load, key).filter((check) => !check.pass);
        assert.deepEqual(
          failed.map((check) => check.name),
          [],
          `${key} ${hkl} ${load}`,
        );
      }
    }
  }
  // HCP fractional atom positions in POSCAR are unit-cell fractions.
  const poscar = structureFile({ ...DEFAULT_STATE, structure: "hcp" }, "poscar").split("\n");
  assert.ok(poscar.some((line) => line === "0.3333333333 0.6666666667 0.5000000000"));
});
