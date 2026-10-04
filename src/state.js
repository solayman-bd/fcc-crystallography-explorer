/**
 * App settings: defaults, allowed values and validation.
 * Every change goes through validateState, so presets, saved views and typed input
 * can never leave the app in an invalid configuration.
 */

import { parseIndices, parseTriple } from "./crystal/math.js";
import { LESSONS } from "./education/concepts.js";

/** Default settings. `version` identifies the saved-view format. */
export const DEFAULT_STATE = {
  version: 1,
  structure: "fcc",
  hexPrism: true,
  topic: "crystal",
  workspace: "crystal",
  tab: "learn",
  a: 4.05,
  element: "Al",
  N: [1, 1, 1],
  atoms: true,
  mode: "closed",
  bounds: "outer",
  axes: true,
  origin: true,
  primitive: false,
  primitiveVectors: true,
  primitiveOnly: false,
  tiles: 1,
  ws: false,
  cellOn: false,
  cell: [0, 0, 0],
  radiusMode: "educational",
  radius: 0.16,
  opacity: 1,
  quality: 24,
  color: "#3986b6",
  selectedColor: "#ee7048",
  neighborColor: "#d4a137",
  layerColor: "#de6994",
  labels: "none",
  registryColor: false,
  clip: false,
  camera: "orthographic",
  plane: false,
  planeLabels: true,
  hkl: [1, 1, 1],
  location: "canonical",
  c: 1,
  layer: 1,
  planeSet: "one",
  extend: false,
  planeColor: "#36a995",
  planeOpacity: 0.25,
  highlight: true,
  normal: false,
  spacing: false,
  direction: false,
  uvw: [1, -1, 0],
  scale: 0.5,
  arrowOrigin: [0, 0, 0],
  dirFamily: false,
  repeat: false,
  dirColor: "#e19531",
  hkl2: [0, 0, 1],
  uvw2: [1, 0, 0],
  plane2: false,
  dir2: false,
  surface: false,
  surfaceCell: true,
  surfaceVectors: true,
  tiling: false,
  conventional: false,
  bonds2d: true,
  labels2d: false,
  netRepeat: 3,
  surfaceColor: "#9168be",
  stack: "fcc",
  layers: 6,
  stackRepeat: 2,
  separation: 1,
  registries: "ABC",
  colorA: "#478abe",
  colorB: "#dc9250",
  colorC: "#956bd0",
  stackLabels: true,
  twinPlane: true,
  neighbors: false,
  shell: 1,
  cutoff: 1.25,
  bonds: true,
  hull: false,
  holes: "none",
  hosts: true,
  slip: false,
  slipIndex: 0,
  allSlip: false,
  load: [0, 0, 1],
  partials: false,
  extent: 2,
  forbidden: false,
  basisReciprocal: true,
  selectedG: true,
  reflection: [1, 1, 1],
  lambda: 1.5406,
  pngScale: 2,
  lesson: -1,
  animMode: "deconstruct",
  animSpeed: 1,
};

/** Allowed values of the enumerated settings. */
export const CHOICES = {
  structure: ["sc", "bcc", "fcc", "hcp"],
  topic: ["crystal", "geometry", "surface", "stacking", "environment", "slip", "reciprocal"],
  workspace: ["crystal", "surface", "animation", "stacking", "reciprocal"],
  tab: ["learn", "calculate", "verify", "layers"],
  mode: ["closed", "ghost", "unique"],
  bounds: ["none", "outer", "all"],
  radiusMode: ["educational", "physical", "manual"],
  labels: ["none", "id", "fractional", "cartesian", "registry"],
  camera: ["orthographic", "perspective"],
  location: ["canonical", "origin", "center", "translated", "layer"],
  planeSet: ["one", "symmetry", "parallel", "atomic"],
  stack: ["fcc", "hcp", "aaa", "intrinsic", "extrinsic", "twin"],
  holes: ["none", "octa", "tetra", "cubic", "both"],
  animMode: ["deconstruct", "build", "primitive", "primToNet", "netToPrim"],
  animSpeed: [0.5, 1, 2],
};

/** Numeric limits of the range and number settings. */
export const RANGES = {
  a: [0.1, 100],
  radius: [0.015, 0.49],
  opacity: [0.05, 1],
  quality: [8, 48],
  tiles: [1, 3],
  c: [-500, 500],
  layer: [-500, 500],
  planeOpacity: [0.03, 0.8],
  scale: [0.05, 4],
  netRepeat: [1, 8],
  layers: [1, 12],
  stackRepeat: [1, 6],
  separation: [1, 3],
  shell: [1, 3],
  cutoff: [0.05, 2],
  slipIndex: [0, 11],
  extent: [1, 4],
  lambda: [0.001, 20],
  pngScale: [1, 4],
  lesson: [-1, LESSONS.length - 1],
};

/**
 * Return a complete, validated copy of `input` merged over the defaults.
 * Throws a readable Error for the first invalid value; unknown keys are ignored.
 */
export function validateState(input) {
  if (!input || input.version !== 1) {
    throw new Error("Choose an FCC Explorer version-1 configuration.");
  }

  const state = structuredClone(DEFAULT_STATE);

  // Views saved while the structure was an animation-only setting.
  if (input.structure === undefined && input.animStructure !== undefined) {
    input = { ...input, structure: input.animStructure };
  }

  for (const [key, value] of Object.entries(input)) {
    if (Object.hasOwn(DEFAULT_STATE, key)) {
      if (CHOICES[key] && !CHOICES[key].includes(value)) {
        throw new Error("Invalid " + key);
      }

      if (RANGES[key]) {
        const [min, max] = RANGES[key];

        if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
          throw new Error(`${key} must be between ${min} and ${max}.`);
        }

        if (
          [
            "quality",
            "tiles",
            "layer",
            "netRepeat",
            "layers",
            "stackRepeat",
            "shell",
            "slipIndex",
            "extent",
            "pngScale",
            "lesson",
          ].includes(key) &&
          !Number.isInteger(value)
        ) {
          throw new Error(key + " must be an integer.");
        }
      }

      if (["hkl", "uvw", "hkl2", "uvw2", "load", "reflection"].includes(key)) {
        state[key] = parseIndices(value);
        continue;
      }

      if (key === "N") {
        state.N = parseTriple(value, 1, 10, true);
        continue;
      }

      if (key === "cell") {
        state.cell = parseTriple(value, 0, 9, true);
        continue;
      }

      if (key === "arrowOrigin") {
        state[key] = parseTriple(value);
        continue;
      }

      if (
        typeof DEFAULT_STATE[key] === "string" &&
        /color/i.test(key) &&
        !/^#[a-f0-9]{6}$/i.test(value)
      ) {
        throw new Error("Invalid color");
      }

      if (key === "element" && !/^[A-Z][a-z]?$/.test(value)) {
        throw new Error("Use an element-style symbol, such as Al, Cu, Ni or X.");
      }

      if (key === "registries" && (typeof value !== "string" || !/^[ABC]{0,3}$/.test(value))) {
        throw new Error("Invalid registry filter.");
      }

      if (typeof DEFAULT_STATE[key] === "boolean" && typeof value !== "boolean") {
        throw new Error("Invalid switch " + key);
      }

      state[key] = value;
    }
  }

  state.cell = state.cell.map((index, axis) => Math.min(index, state.N[axis] - 1));
  return state;
}
