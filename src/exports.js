/**
 * Downloads: structure files (XYZ, CIF, POSCAR) and the Markdown calculation report.
 */

import {
  directionOf,
  directionText,
  metricsOf,
  neighborsOf,
  planeLevelOf,
  planeOf,
  planeText,
  reflectionOf,
  sitesOf,
  slipSystemsOf,
  structureFor,
  surfaceOf,
} from "./crystal/bulk.js";
import { directionInfo, latticeMetrics, latticeSites } from "./crystal/lattice.js";
import { formatVector, scale } from "./crystal/math.js";
import { planeInfo, planeLevel } from "./crystal/planes.js";
import { reflectionInfo } from "./crystal/reciprocal.js";
import { slipSystems } from "./crystal/slip.js";
import { STACKINGS, buildStack } from "./crystal/stacking.js";
import { surfaceCell } from "./crystal/surfaces.js";
import { runChecks } from "./crystal/verify.js";
import { REFERENCES } from "./education/concepts.js";

/** Start a browser download for text content or a data URL. */
export function download(filename, content, type = "text/plain") {
  const url =
    typeof content === "string" && content.startsWith("data:")
      ? content
      : URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (url.startsWith("blob:")) {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/**
 * Unique atoms of the configured ideal bulk FCC supercell as XYZ, POSCAR or CIF (P1).
 * Ghost images and display overlays are never exported.
 */
export function structureFile(state, format) {
  if (state.structure !== "fcc") {
    return generalStructureFile(state, format);
  }
  const atoms = latticeSites(state.N, true);
  const lengths = state.N.map((count) => count * state.a);
  const fractional = (atom) => atom.p.map((value, axis) => (value / state.N[axis]).toFixed(10));

  if (format === "xyz") {
    return `${atoms.length}
Ideal bulk FCC; a=${state.a} Angstrom; supercell=${state.N.join("x")}; unique PBC atoms; excludes display ghosts and overlays
${atoms.map(
  (atom) => `${state.element} ${atom.p.map((value) => (value * state.a).toFixed(9)).join(" ")}`,
).join(`
`)}
`;
  }

  if (format === "poscar") {
    return `FCC Explorer ideal ${state.element} bulk supercell
1.0
${lengths.map((length, row) =>
  [0, 1, 2].map((column) => (column === row ? length.toFixed(9) : "0")).join(" "),
).join(`
`)}
${state.element}
${atoms.length}
Direct
${atoms.map((atom) => fractional(atom).join(" ")).join(`
`)}
`;
  }

  if (format === "cif") {
    return `data_FCC_Explorer
_audit_creation_method 'FCC Explorer; ideal bulk unique PBC atoms'
_cell_length_a ${lengths[0].toFixed(9)}
_cell_length_b ${lengths[1].toFixed(9)}
_cell_length_c ${lengths[2].toFixed(9)}
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_space_group_name_H-M_alt 'P 1'
_space_group_IT_number 1
loop_
_space_group_symop_operation_xyz
'x,y,z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
${atoms.map(
  (atom, index) => `${state.element}${index + 1} ${state.element} ${fractional(atom).join(" ")} 1`,
).join(`
`)}
`;
  }

  throw new Error("Unknown structure format");
}

/**
 * Unique atoms of a simple cubic, BCC or HCP unit-cell supercell (the HCP unit cell is
 * a, a, c with γ = 120°), as XYZ, POSCAR or CIF (P1).
 */
function generalStructureFile(state, format) {
  const S = structureFor(state.structure);
  const atoms = sitesOf(S, state.N, true);
  const vectors = S.axes.map((axis, index) => scale(axis, state.N[index] * state.a));
  const fractional = (atom) => atom.f.map((value, axis) => (value / state.N[axis]).toFixed(10));
  const c = S.axes[2][2] * state.a;
  const label = `Ideal bulk ${S.short}; a=${state.a} Angstrom${S.hexagonal ? `; c=${c.toFixed(9)} Angstrom (ideal c/a)` : ""}; supercell=${state.N.join("x")} unit cells; unique PBC atoms; excludes display ghosts and overlays`;

  if (format === "xyz") {
    return `${atoms.length}
${label}
${atoms.map(
  (atom) => `${state.element} ${atom.p.map((value) => (value * state.a).toFixed(9)).join(" ")}`,
).join(`
`)}
`;
  }

  if (format === "poscar") {
    return `FCC Explorer ideal ${state.element} ${S.short} bulk supercell
1.0
${vectors.map((vector) =>
  vector.map((value) => (Math.abs(value) < 1e-12 ? "0" : value.toFixed(9))).join(" "),
).join(`
`)}
${state.element}
${atoms.length}
Direct
${atoms.map((atom) => fractional(atom).join(" ")).join(`
`)}
`;
  }

  if (format === "cif") {
    return `data_FCC_Explorer_${S.short}
_audit_creation_method 'FCC Explorer; ideal bulk ${S.short} unique PBC atoms'
_cell_length_a ${(state.a * state.N[0]).toFixed(9)}
_cell_length_b ${(state.a * state.N[1]).toFixed(9)}
_cell_length_c ${(S.hexagonal ? c * state.N[2] : state.a * state.N[2]).toFixed(9)}
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma ${S.hexagonal ? 120 : 90}
_space_group_name_H-M_alt 'P 1'
_space_group_IT_number 1
loop_
_space_group_symop_operation_xyz
'x,y,z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
${atoms.map(
  (atom, index) => `${state.element}${index + 1} ${state.element} ${fractional(atom).join(" ")} 1`,
).join(`
`)}
`;
  }

  throw new Error("Unknown structure format");
}

/** Markdown report with parameters, equations, derived values, the full state and checks. */
export function calculationReport(state) {
  if (state.structure !== "fcc") {
    return generalReport(state);
  }
  const metrics = latticeMetrics(state.a);
  const plane = planeInfo(state.hkl, state.a);
  const surface = surfaceCell(state.hkl, state.a);
  const direction = directionInfo(state.uvw, state.a);
  const reflection = reflectionInfo(state.reflection, state.a, state.lambda);
  return `# FCC Explorer calculation report

Generated ${new Date().toISOString()}. Ideal monatomic FCC geometry. Lengths in Å.

## Crystal

a=${state.a}, label=${state.element}, N=${state.N.join(" × ")}; unique PBC count=${4 * state.N.reduce((product, count) => product * count, 1)}; closed drawing count=${latticeSites(state.N).length}. R=${metrics.radius}; nearest neighbor=${metrics.nn}; APF=${metrics.apf}; primitive volume=${metrics.primitiveVolume} Å³.

## Plane (${formatVector(state.hkl)})

Equation n·X=${planeLevel(state.hkl, state.N, state.location, state.c, state.layer)}, X=r/a. Geometric d=${plane.d}; adjacent layer gap=${plane.gap}; pure normal translation=${plane.period}. Layer increment in c=${plane.step}.

## Primitive surface

Integer row q=(${formatVector(surface.q)}); kernel coefficients m1=(${formatVector(surface.m1)}), m2=(${formatVector(surface.m2)}). Surface vectors /a: (${formatVector(surface.t1)}), (${formatVector(surface.t2)}). Lengths=${surface.lengths}; angle=${surface.angle}°. Area=${surface.area} Å²; density=${surface.density} Å⁻². Area × layer gap=${surface.identity} Å³ = a³/4. In-plane nearest-neighbor coordination=${surface.coordination}.

## Direction [${formatVector(state.uvw)}]

a[uvw] magnitude=${direction.length}; a/2[uvw] translation=${direction.halfValid}. Shortest translation/a=(${formatVector(direction.translation)}); length=${direction.period}; occupied-row linear density=${direction.density} Å⁻¹.

## Diffraction (${formatVector(state.reflection)})

F/f=${reflection.factor}; allowed=${reflection.allowed}; |G|=${reflection.magnitude} Å⁻¹; d=${reflection.d}; wavelength=${state.lambda}; geometric 2theta=${reflection.twoTheta ?? "inaccessible"}°. A forbidden reflection has no ideal peak even if a geometric Bragg angle exists. No intensity prediction.

## Stacking comparison

${STACKINGS[state.stack].name}: ${buildStack(state.stack, state.layers).sequence}. ${STACKINGS[state.stack].note} Ideal layer gap=${buildStack(state.stack).height * state.a} Å; display separation multiplier=${state.separation}. Coordinates use e1 parallel [1 -1 0], e2 parallel [1 1 -2], e3 parallel [111].

## Slip and local environment

Load=[${formatVector(state.load)}]. Perfect Burgers magnitude=${state.a / Math.sqrt(2)} Å; Shockley magnitude=${state.a / Math.sqrt(6)} Å. Twelve Schmid factors:

${slipSystems(state.load).map(
  (system, index) => `- ${index + 1}. ${system.label}: ${system.schmid}`,
).join(`
`)}

Bulk shells: 12 at a/√2, 6 at a, 24 at a√(3/2). Current inclusion: shells through ${state.shell}, cutoff ${state.cutoff * state.a} Å. Octahedral holes: 4 per periodic cell, 6 hosts, r/R=√2−1. Tetrahedral holes: 8 per periodic cell, 4 hosts, r/R=√(3/2)−1.

## Reproducible configuration

Active workspace: ${state.workspace}. The bulk formulas above always refer to ideal FCC, even in a stacking-comparison workspace.

\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## Verification

${runChecks(state.a, state.hkl, state.load).map(
  (check) =>
    `- ${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.actual}; expected ${check.expected}`,
).join(`
`)}

## Scope

XYZ/CIF/POSCAR contain unique atoms of the configured ideal bulk supercell, never display ghosts, holes, comparison stacks or reciprocal points. Fault/twin/partial views are ideal geometric constructions, not relaxed simulations.

## Learning references

${Object.values(REFERENCES).map((reference) => `- [${reference.title}](${reference.url})`).join(`
`)}
`;
}

/** The calculation report for simple cubic, BCC or HCP. */
function generalReport(state) {
  const S = structureFor(state.structure);
  const metrics = metricsOf(S, state.a);
  const plane = planeOf(S, state.hkl, state.a);
  const surface = surfaceOf(S, state.hkl, state.a);
  const direction = directionOf(S, state.uvw, state.a);
  const reflection = reflectionOf(S, state.reflection, state.a, state.lambda);
  const shells = [1, 2, 3].map((shell) =>
    neighborsOf(S, [0, 0, 0], 3, 3).filter((neighbor) => neighbor.shell === shell),
  );
  const cells = state.N.reduce((product, count) => product * count, 1);
  const list = (values) => values.join(", ");
  return `# FCC Explorer calculation report

Generated ${new Date().toISOString()}. Ideal monatomic ${S.name.toLowerCase()} (${S.short}) geometry${S.hexagonal ? " with ideal c/a = √(8/3)" : ""}. Lengths in Å.

## Crystal

a=${state.a}${S.hexagonal ? `, c=${S.axes[2][2] * state.a}` : ""}, label=${state.element}, N=${state.N.join(" × ")} unit cells; atoms per unit cell ${S.unit.count}; unique PBC count=${S.unit.atoms * cells}; closed drawing count=${sitesOf(S, state.N).length}. R=${metrics.radius}; nearest neighbor=${metrics.nn}; coordination=${S.coordination}; APF=${metrics.apf}; primitive volume=${metrics.primitiveVolume} Å³.

## Plane (${planeText(S, state.hkl)})

Equation h·f₁ + k·f₂ + l·f₃=${planeLevelOf(S, state.hkl, state.N, state.location, state.c, state.layer)} in unit-cell fractions. Geometric d=${plane.d}; adjacent layer gaps=${list(plane.gaps)}; pure normal translation=${plane.period}. Lattice-layer step in c=${plane.step}; layers at c=${list(plane.offsets)} (+ multiples of the step).

## Primitive surface

Integer row q=(${formatVector(surface.q)}); kernel coefficients m1=(${formatVector(surface.m1)}), m2=(${formatVector(surface.m2)}). Surface vectors /a: (${formatVector(surface.t1)}), (${formatVector(surface.t2)}). Lengths=${surface.lengths}; angle=${surface.angle}°. Area=${surface.area} Å²; atoms per cell=${surface.atomsPerCell}; density=${surface.density} Å⁻². Area × lattice-layer step=${surface.identity} Å³ = primitive volume. In-plane nearest-neighbor coordination=${surface.coordination}.

## Direction [${directionText(S, state.uvw)}]

a[uvw] magnitude=${direction.length}. Shortest translation (unit-cell indices)=(${formatVector(direction.translation)}); length=${direction.period}; occupied-row linear density=${direction.density} Å⁻¹.

## Diffraction (${planeText(S, state.reflection)})

|F/f|=${reflection.factor}; allowed=${reflection.allowed}; |G|=${reflection.magnitude} Å⁻¹; d=${reflection.d}; wavelength=${state.lambda}; geometric 2theta=${reflection.twoTheta ?? "inaccessible"}°. A forbidden reflection has no ideal peak even if a geometric Bragg angle exists. No intensity prediction.

## Stacking comparison

${STACKINGS[state.stack].name}: ${buildStack(state.stack, state.layers).sequence}. ${STACKINGS[state.stack].note} This workspace compares close-packed stackings; it is the same for every structure.

## Slip and local environment

Load=[${directionText(S, state.load)}]. Slip: ${S.slip.name}, b=${S.slip.burgers}. Schmid factors:

${slipSystemsOf(S, state.load).map(
  (system, index) => `- ${index + 1}. ${system.label}: ${system.schmid}`,
).join(`
`)}

Bulk shells: ${shells.map((shell) => `${shell.length} at ${shell[0].distance * state.a} Å`).join("; ")}. Current inclusion: shells through ${state.shell}, cutoff ${state.cutoff * state.a} Å. Holes: ${S.holes.map((hole) => `${hole.name.toLowerCase()}: ${hole.sites.length} per unit cell, ${hole.coordination} hosts, r/R=${hole.ratioText}`).join("; ")}.

## Reproducible configuration

Active workspace: ${state.workspace}. The bulk formulas above refer to ideal ${S.short}; the stacking-comparison workspace is a separate close-packed construction.

\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## Verification

${runChecks(state.a, state.hkl, state.load, state.structure).map(
  (check) =>
    `- ${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.actual}; expected ${check.expected}`,
).join(`
`)}

## Scope

XYZ/CIF/POSCAR contain unique atoms of the configured ideal bulk unit-cell supercell, never display ghosts, holes, comparison stacks or reciprocal points. Fault/twin/partial views are ideal geometric constructions, not relaxed simulations.

## Learning references

${Object.values(REFERENCES).map((reference) => `- [${reference.title}](${reference.url})`).join(`
`)}
`;
}
