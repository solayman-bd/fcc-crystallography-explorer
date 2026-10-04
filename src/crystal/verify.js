/**
 * Live invariant checks, shown in the Verify tab and in the calculation report.
 */

import {
  directionOf,
  isTranslation,
  neighborsOf,
  planeNormal,
  prismSites,
  reciprocalBasisOf,
  sitesOf,
  slipSystemsOf,
  structureFactorOf,
  structureFor,
} from "./bulk.js";
import { neighborShells } from "./environment.js";
import { layerGeometry, stackPlan } from "./layers.js";
import {
  PRIMITIVE_VECTORS,
  directionInfo,
  isLatticeTranslation,
  latticeMetrics,
  latticeSites,
} from "./lattice.js";
import { angleBetween, dot, scale, tripleProduct } from "./math.js";
import { isAllowedReflection, reciprocalBasis } from "./reciprocal.js";
import { slipSystems } from "./slip.js";
import { STRUCTURES } from "./structures.js";
import { surfaceCell } from "./surfaces.js";

/**
 * Recompute the key identities for lattice parameter a, surface (hkl), loading direction and
 * structure. Each check is { name, actual, expected, pass }.
 */
export function runChecks(a = 4.05, hkl = [1, 1, 1], load = [1, -1, 0], structure = "fcc") {
  if (structure !== "fcc") {
    return structureChecks(structureFor(structure), a, hkl, load);
  }
  const surface = surfaceCell(hkl, a);
  const metrics = latticeMetrics(a);
  const checks = [];
  const check = (name, actual, expected) =>
    checks.push({
      name,
      actual,
      expected,
      pass: Math.abs(actual - expected) < 1e-7 * Math.max(1, Math.abs(expected)),
    });
  check("Unique periodic atoms", latticeSites([1, 1, 1], true).length, 4);
  check("Closed-cell visible sites", latticeSites().length, 14);
  check(
    "Boundary-weighted count",
    latticeSites().reduce((sum, site) => sum + site.weight, 0),
    4,
  );
  check("3D primitive determinant", tripleProduct(...PRIMITIVE_VECTORS) * a ** 3, a ** 3 / 4);
  check("3D primitive angle", angleBetween(PRIMITIVE_VECTORS[0], PRIMITIVE_VECTORS[1]), 60);
  check(
    "First-neighbor count",
    neighborShells().filter((neighbor) => neighbor.shell === 1).length,
    12,
  );
  check(
    "Second-neighbor count",
    neighborShells().filter((neighbor) => neighbor.shell === 2).length,
    6,
  );
  check(
    "Third-neighbor count",
    neighborShells().filter((neighbor) => neighbor.shell === 3).length,
    24,
  );
  check("Nearest-neighbor distance", neighborShells()[0].distance * a, metrics.nn);
  check("t₁ · (hkl)", dot(surface.t1, hkl), 0);
  check("t₂ · (hkl)", dot(surface.t2, hkl), 0);
  check("t₁ FCC translation", Number(isLatticeTranslation(surface.t1)), 1);
  check("t₂ FCC translation", Number(isLatticeTranslation(surface.t2)), 1);
  check("Surface area × layer gap", surface.identity, a ** 3 / 4);
  check("Distinct slip systems", slipSystems().length, 12);
  check(
    "Schmid factors ≤ 0.5",
    Number(slipSystems(load).every((system) => system.schmid <= 0.500000001)),
    1,
  );
  check(
    "(111) allowed; (100) absent",
    Number(isAllowedReflection([1, 1, 1]) && !isAllowedReflection([1, 0, 0])),
    1,
  );
  let dualityError = 0;
  const reciprocal = reciprocalBasis(a);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      dualityError = Math.max(
        dualityError,
        Math.abs(dot(scale(PRIMITIVE_VECTORS[i], a), reciprocal[j]) - (i === j ? 2 * Math.PI : 0)),
      );
    }
  }

  check("Reciprocal duality error", dualityError, 0);
  check("[111] pure normal repeat", directionInfo([1, 1, 1], a).period, Math.sqrt(3) * a);

  // Layers of the current plane (Cell ⇄ Net animation).
  const layers = layerGeometry(hkl, a);
  const ballsInCell = (geometry) =>
    stackPlan(geometry, 0).points.filter((point) => point.inCell).length;
  check("Stacking period N × d = normal repeat", layers.period * layers.d, layers.repeat);
  check("Layer density d × 4/a³ = 1 / area", layers.d * 4, layers.density);
  check("Stacked layers fill one cube with 14 balls", ballsInCell(layers), 14);
  // The same plane in the other structures of the animation.
  check(
    "SC: stacked layers fill one cube with 8 balls",
    ballsInCell(layerGeometry(hkl, a, "sc")),
    8,
  );
  check(
    "BCC: stacked layers fill one cube with 9 balls",
    ballsInCell(layerGeometry(hkl, a, "bcc")),
    9,
  );
  const hcp = layerGeometry(hkl, a, "hcp");
  check("HCP: stacked layers fill one prism with 17 balls", ballsInCell(hcp), 17);
  check(
    "HCP: area × lattice-layer step = (√3/2)a²c",
    ((hcp.area * hcp.step) / hcp.gNorm) * a ** 3,
    STRUCTURES.hcp.primitiveVolume * a ** 3,
  );
  return checks;
}

/** The same kinds of identities for simple cubic, BCC or HCP. */
function structureChecks(S, a, hkl, load) {
  const checks = [];
  const check = (name, actual, expected) =>
    checks.push({
      name,
      actual,
      expected,
      pass: Math.abs(actual - expected) < 1e-7 * Math.max(1, Math.abs(expected)),
    });
  const closed = sitesOf(S);
  check("Unique periodic atoms", sitesOf(S, [1, 1, 1], true).length, S.unit.atoms);
  check("Closed-cell visible sites", closed.length, S.unit.sites);
  check(
    "Boundary-weighted count",
    closed.reduce((sum, site) => sum + site.weight, 0),
    S.unit.atoms,
  );
  if (S.hexagonal) {
    check(
      "Hexagonal prism count 12/6 + 2/2 + 3",
      prismSites(S).reduce((sum, site) => sum + site.weight, 0),
      6,
    );
  }
  check(
    "Unit-cell / primitive volume = atoms ratio",
    S.unitVolume / S.primitiveVolume,
    S.unit.atoms / S.primitiveAtoms,
  );
  check("3D primitive volume", tripleProduct(...S.primitive) * a ** 3, S.primitiveVolume * a ** 3);
  check("3D primitive angle", angleBetween(S.primitive[0], S.primitive[1]), S.primitiveAngle);
  const neighbors = neighborsOf(S, [0, 0, 0], 3, 3);
  ["First", "Second", "Third"].forEach((ordinal, index) =>
    check(
      `${ordinal}-neighbor count`,
      neighbors.filter((neighbor) => neighbor.shell === index + 1).length,
      S.shells[index],
    ),
  );
  check("Nearest-neighbor distance", neighbors[0].distance * a, S.nearest * a);
  const normal = planeNormal(S, hkl);
  const layers = layerGeometry(hkl, a, S);
  check("t₁ · G", dot(layers.t1, normal), 0);
  check("t₂ · G", dot(layers.t2, normal), 0);
  check(`t₁ ${S.short} translation`, Number(isTranslation(S, layers.t1)), 1);
  check(`t₂ ${S.short} translation`, Number(isTranslation(S, layers.t2)), 1);
  check(
    "Surface area × lattice-layer step",
    ((layers.area * layers.step) / layers.gNorm) * a ** 3,
    S.primitiveVolume * a ** 3,
  );
  const systems = slipSystemsOf(S, load);
  check("Distinct slip systems", systems.length, S.slipCount);
  check("Schmid factors ≤ 0.5", Number(systems.every((system) => system.schmid <= 0.500000001)), 1);
  const allowed = (indices) => structureFactorOf(S, indices) > 0;
  if (S.key === "sc") {
    check(
      "(100), (110), (111) all allowed",
      Number(allowed([1, 0, 0]) && allowed([1, 1, 0]) && allowed([1, 1, 1])),
      1,
    );
  } else if (S.key === "bcc") {
    check("(110) allowed; (100) absent", Number(allowed([1, 1, 0]) && !allowed([1, 0, 0])), 1);
  } else {
    check("(0002) allowed; (0001) absent", Number(allowed([0, 0, 2]) && !allowed([0, 0, 1])), 1);
  }
  const reciprocal = reciprocalBasisOf(S, a);
  let dualityError = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      dualityError = Math.max(
        dualityError,
        Math.abs(dot(scale(S.primitive[i], a), reciprocal[j]) - (i === j ? 2 * Math.PI : 0)),
      );
    }
  }
  check("Reciprocal duality error", dualityError, 0);
  const [direction, repeat] = {
    sc: [[1, 0, 0], 1],
    bcc: [[1, 1, 1], Math.sqrt(3) / 2],
    hcp: [[0, 0, 1], S.axes[2][2]],
  }[S.key];
  check(
    `[${S.hexagonal ? "0001" : direction.join("")}] pure repeat`,
    directionOf(S, direction, a).period,
    repeat * a,
  );
  check("Stacking period N × d = normal repeat", layers.period * layers.d, layers.repeat);
  check(
    `Stacked layers fill one ${S.cellName} with ${S.ballsInCell} balls`,
    stackPlan(layers, 0).points.filter((point) => point.inCell).length,
    S.ballsInCell,
  );
  return checks;
}
