import assert from "node:assert/strict";
import { test } from "node:test";
import { PRIMITIVE_VECTORS } from "../src/crystal/lattice.js";
import { dot, parseIndices, parseTriple, scale } from "../src/crystal/math.js";
import { fromBravaisDirection, fromMillerBravais } from "../src/crystal/structures.js";
import {
  braggTable,
  isAllowedReflection,
  reciprocalBasis,
  reflectionInfo,
  structureFactor,
} from "../src/crystal/reciprocal.js";
import { runChecks } from "../src/crystal/verify.js";
import { CONCEPTS, LESSONS, PRESETS, TOPICS, conceptFor } from "../src/education/concepts.js";
import { calculationReport, structureFile } from "../src/exports.js";
import { DEFAULT_STATE, validateState } from "../src/state.js";

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );

test("reciprocal basis is dual to the primitive basis", () => {
  const a = 3.61;
  const b = reciprocalBasis(a);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      close(dot(scale(PRIMITIVE_VECTORS[i], a), b[j]), i === j ? 2 * Math.PI : 0);
});

test("FCC selection rule and structure factor", () => {
  for (const hkl of [
    [1, 1, 1],
    [2, 0, 0],
    [2, 2, 0],
    [3, 1, 1],
    [2, 2, 2],
  ]) {
    assert.ok(isAllowedReflection(hkl));
    assert.equal(structureFactor(hkl), 4);
  }
  for (const hkl of [
    [1, 0, 0],
    [1, 1, 0],
    [2, 1, 0],
    [2, 1, 1],
  ]) {
    assert.ok(!isAllowedReflection(hkl));
    assert.equal(structureFactor(hkl), 0);
  }
});

test("Bragg geometry: Al (111) with Cu Kα and the λ ≤ 2d limit", () => {
  const r = reflectionInfo([1, 1, 1], 4.05, 1.5406);
  close(r.d, 4.05 / Math.sqrt(3));
  close(r.magnitude, (2 * Math.PI) / r.d);
  assert.ok(Math.abs(r.twoTheta - 38.47) < 0.01);
  assert.equal(reflectionInfo([1, 1, 1], 4.05, 10).twoTheta, null);
  const table = braggTable(4.05, 1.5406);
  assert.deepEqual(
    table.slice(0, 3).map((row) => row.n.join("")),
    ["111", "200", "220"],
  );
});

test("built-in invariant checks all pass", () => {
  for (const [a, hkl, load] of [
    [4.05, [1, 1, 1], [0, 0, 1]],
    [3.61, [2, 1, 0], [1, 2, 3]],
    [1, [-3, 5, 2], [1, 1, 1]],
  ]) {
    const failed = runChecks(a, hkl, load).filter((check) => !check.pass);
    assert.deepEqual(failed, []);
  }
});

test("settings validation", () => {
  assert.deepEqual(validateState(DEFAULT_STATE), DEFAULT_STATE);
  assert.throws(() => validateState({ version: 2 }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, hkl: [0, 0, 0] }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, N: [11, 1, 1] }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, color: "red" }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, mode: "everything" }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, layers: 2.5 }));
  // Unknown keys are ignored; the selected cell is clamped into the supercell.
  const s = validateState({ ...DEFAULT_STATE, unknown: 1, N: [2, 1, 1], cell: [5, 5, 5] });
  assert.equal("unknown" in s, false);
  assert.deepEqual(s.cell, [1, 0, 0]);
});

test("copied negative indices and coordinates accept the displayed Unicode minus", () => {
  assert.deepEqual(parseIndices("(1 −1 0)"), [1, -1, 0]);
  assert.deepEqual(parseTriple("−0.5 0 1"), [-0.5, 0, 1]);
  assert.deepEqual(fromMillerBravais("(1 0 −1 0)"), [1, 0, 0]);
  assert.deepEqual(fromBravaisDirection("[2 −1 −1 0]"), [1, 0, 0]);
  assert.throws(() => fromMillerBravais("(1 0 −2 0)"));
});

test("structure exports contain only unique bulk atoms", () => {
  const state = validateState({ ...DEFAULT_STATE, N: [2, 3, 1], element: "Cu", a: 3.61 });
  const xyz = structureFile(state, "xyz").trim().split("\n");
  assert.equal(Number(xyz[0]), 24);
  assert.equal(xyz.length, 2 + 24);
  assert.ok(xyz[2].startsWith("Cu "));
  const poscar = structureFile(state, "poscar").trim().split("\n");
  assert.equal(poscar[6], "24");
  assert.equal(poscar[7], "Direct");
  const cif = structureFile(state, "cif");
  assert.match(cif, /_space_group_IT_number 1/);
  assert.equal(
    cif
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("Cu")).length,
    24,
  );
  assert.throws(() => structureFile(state, "pdb"));
});

test("calculation report includes the configuration and passing checks", () => {
  const report = calculationReport(DEFAULT_STATE);
  assert.match(report, /^# FCC Explorer calculation report/);
  assert.match(report, /```json/);
  assert.doesNotMatch(report, /FAIL/);
});

test("teaching content is consistent", () => {
  assert.equal(LESSONS.length, 18);
  for (const [concept, , preset] of LESSONS) {
    assert.ok(CONCEPTS[concept], concept);
    assert.ok(PRESETS[preset], preset);
  }
  // Every animation mode has a guided-tour lesson, and BCC and HCP have one each.
  const patches = LESSONS.map(([, , preset]) => PRESETS[preset].patch);
  const modes = [...new Set(patches.map((patch) => patch.animMode).filter(Boolean))];
  assert.deepEqual(modes.sort(), ["build", "deconstruct", "netToPrim", "primToNet", "primitive"]);
  for (const structure of ["bcc", "hcp"]) {
    assert.ok(
      LESSONS.some(([, , preset]) => PRESETS[preset].structure === structure),
      structure,
    );
  }
  // A saved view from before the animation (or before the structure setting) still loads, and
  // a view saved while the structure was an animation-only setting keeps its structure.
  const { animMode, animSpeed, structure, hexPrism, ...older } = DEFAULT_STATE;
  assert.equal(validateState(older).animMode, "deconstruct");
  assert.equal(validateState(older).structure, "fcc");
  assert.equal(validateState({ ...older, animStructure: "bcc" }).structure, "bcc");
  assert.throws(() => validateState({ ...DEFAULT_STATE, animSpeed: 3 }));
  assert.throws(() => validateState({ ...DEFAULT_STATE, structure: "diamond" }));
  for (const [, , concept] of TOPICS) assert.ok(CONCEPTS[concept]);
  for (const [key, concept] of Object.entries(CONCEPTS)) {
    for (const related of concept.related) assert.ok(CONCEPTS[related], `${key} → ${related}`);
  }
  // Every preset is valid for every structure it is offered for, with its variants.
  for (const preset of Object.values(PRESETS)) {
    assert.ok(CONCEPTS[preset.concept]);
    for (const key of preset.structures ?? ["sc", "bcc", "fcc", "hcp"]) {
      validateState({
        ...DEFAULT_STATE,
        structure: key,
        ...preset.patch,
        ...preset.variants?.[key],
      });
    }
  }
  // Every concept has text for every structure.
  for (const key of Object.keys(CONCEPTS)) {
    for (const structureKey of ["sc", "bcc", "fcc", "hcp"]) {
      const text = conceptFor(key, structureKey);
      for (const field of ["title", "question", "intro", "equation", "view", "confusion", "try"]) {
        assert.ok(text[field], `${key} ${structureKey} ${field}`);
      }
    }
  }
});
