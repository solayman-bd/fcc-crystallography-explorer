/**
 * Live invariant checks, shown in the Verify tab and in the calculation report.
 */

import { neighborShells } from "./environment.js";
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
import { surfaceCell } from "./surfaces.js";

/**
 * Recompute the key identities for lattice parameter a, surface (hkl) and loading direction.
 * Each check is { name, actual, expected, pass }.
 */
export function runChecks(a = 4.05, hkl = [1, 1, 1], load = [1, -1, 0]) {
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
  return checks;
}
