/**
 * FCC Crystallography Explorer: app entry point.
 * Holds the current settings, renders every panel from them and handles user input.
 */

import {
  braggTableOf,
  directionOf,
  prismSites,
  directionText,
  directionVector,
  familyOf,
  fractionalOf,
  isTranslation,
  metricsOf,
  neighborsOf,
  partialsOf,
  planeLevelOf,
  planeNormal,
  planeOf,
  planeText,
  reflectionOf,
  regionOf,
  shellDistances,
  sitesOf,
  slipSystemsOf,
  surfaceOf,
} from "./crystal/bulk.js";
import {
  cellAround,
  classifyCut,
  layerForState,
  layerGeometry,
  layerS,
  millerLabel,
  stackingLetters,
} from "./crystal/layers.js";
import {
  add,
  angleBetween,
  dot,
  formatNumber,
  formatVector,
  gcdOf,
  mod,
  norm,
  parseIndices,
  parseTriple,
  scale,
  subtract,
} from "./crystal/math.js";
import { STACKINGS, buildStack } from "./crystal/stacking.js";
import {
  EXAMPLES,
  STRUCTURES,
  STRUCTURE_KEYS,
  fromBravaisDirection,
  fromMillerBravais,
} from "./crystal/structures.js";
import { runChecks } from "./crystal/verify.js";
import {
  CONCEPTS,
  CONCEPT_TOPICS,
  LESSONS,
  PRESETS,
  REFERENCES,
  TOPICS,
  conceptFor,
  presetTitle,
} from "./education/concepts.js";
import { calculationReport, download, structureFile } from "./exports.js";
import { DEFAULT_STATE, validateState } from "./state.js";
import { ANIMATION_MODES } from "./visualization/cell-net.js";
import { SurfaceView } from "./visualization/surface-view.js";
import { CrystalViewer } from "./visualization/viewer.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

const fmt = (value, digits = 4) => formatNumber(value, digits);
const fmtVec = (vector) => formatVector(vector);
const formatCount = (value) => Number(value).toLocaleString();
let state = structuredClone(DEFAULT_STATE);
let concept = "crystal";
let selection = null;
let previousSelection = null;
let viewer = null;
let animationTimer = null;

function toast(message, isError = false) {
  $("#toast").textContent = message;
  $("#toast").className = isError ? "error" : "";
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), isError ? 6500 : 3400);
}

function stopAnimation() {
  clearInterval(animationTimer);
  animationTimer = null;
}

/** The selected crystal structure (Crystal & unit cells), as its data object. */
const structure = (s = state) => STRUCTURES[s.structure];

/** Layers of the current plane in that structure. */
const planeLayers = (s = state) => layerGeometry(s.hkl, s.a, s.structure);

/**
 * A look-along direction as a Cartesian vector: [u v w] of the structure in the crystal and
 * animation views; the stacking and reciprocal views take the indices as their own axes.
 */
const lookVector = (uvw) =>
  ["stacking", "reciprocal"].includes(state.workspace) ? uvw : directionVector(structure(), uvw);

/** Plane and direction indices for text: as typed for cubic, (h k i l) / [u v t w] for HCP. */
const planeName = (hkl, s = state) =>
  structure(s).hexagonal ? planeText(structure(s), hkl) : fmtVec(hkl);
const directionName = (uvw, s = state) =>
  structure(s).hexagonal ? directionText(structure(s), uvw) : fmtVec(uvw);

/** The occupied layer the surface net and the animation actually show (nearest to the plane). */
function currentLayer(s = state) {
  return layerForState(planeLayers(s), s);
}

/** Layer spacing for text: d, or the alternating gaps when basis atoms form layers of their own. */
const spacingText = (layers, a) =>
  layers.evenlySpaced
    ? `${fmt(layers.d * a)} Å`
    : `${layers.gaps.map((gap) => fmt(gap * a)).join(" / ")} Å, alternating`;

/** Net type for text, with the atoms per cell when a layer holds more than one per net cell. */
const netText = (layers) =>
  layers.type.replace("-", " ") +
  (layers.atomsPerCell > 1 ? `, ${layers.atomsPerCell} atoms per cell` : "");

/** The heading question; the surface and animation questions follow the current plane. */
function headerQuestion() {
  if (concept === "surface") {
    const layers = planeLayers();
    const type = layers.type.replace("-", " ");
    const plane = state.structure === "fcc" ? millerLabel(state.hkl) : layers.label;
    return `Why is ${structure().short}(${plane}) ${/^[aeiou]/.test(type) ? "an" : "a"} ${type} surface net?`;
  }

  if (concept === "cellnet") {
    const layers = planeLayers();
    const { short, cellName } = layers.structure;
    const plane = layers.label;
    return {
      deconstruct: `How does one ${short} ${cellName} become the (${plane}) net?`,
      build: `How do (${plane}) layers stack into the ${short} ${cellName}?`,
      primitive: "How small can a cell be, in 2D and in 3D?",
      primToNet: `How does one ${short} primitive cell grow into a crystal and a (${plane}) layer?`,
      netToPrim: `How does a (${plane}) layer stack back down to one ${short} primitive cell?`,
    }[state.animMode];
  }

  if (concept === "crystal" && structure().hexagonal && !state.hexPrism) {
    return "Why does the HCP unit cell hold two atoms?";
  }

  return conceptFor(concept, state.structure).question;
}

/** Player bar under the 3D view in the Cell ⇄ Net workspace. */
function renderPlayer() {
  const info = viewer?.cellNet?.info();

  if (!info) {
    $("#player").innerHTML = viewer ? "" : note("The animation needs WebGL2.");
    return;
  }

  $("#player").innerHTML =
    `<div class="player-row"><span class="structure-chip" title="Change the structure in Crystal & unit cells">${structure().short}</span><select data-key="animMode" aria-label="Animation mode">${ANIMATION_MODES.map(([key, title]) => `<option value="${key}" ${state.animMode === key ? "selected" : ""}>${title}</option>`).join("")}</select><span id="anim-step"></span><label class="speed">Speed <select data-key="animSpeed" aria-label="Animation speed">${[0.5, 1, 2].map((speed) => `<option value="${speed}" ${state.animSpeed === speed ? "selected" : ""}>${speed}×</option>`).join("")}</select></label></div>` +
    '<p id="anim-caption" aria-live="polite"></p>' +
    `<div class="player-row"><button data-anim="back" title="Previous step (←)">← Back</button><button data-anim="play" class="primary"></button><button data-anim="next" title="Next step (→)">Next →</button><input id="anim-scrub" type="range" min="0" max="${info.total - 1}" step="0.01" value="${info.position}" aria-label="Animation timeline"><button data-anim="replay" title="Replay from the start">↺ Replay</button><button data-anim="surface" class="handoff" hidden>Open in Surface net</button></div>`;
  updatePlayer(info);
}

function updatePlayer(info) {
  if ($("#player").hidden || !$("#anim-step")) {
    return;
  }

  $("#anim-step").textContent = `Step ${info.step + 1} of ${info.total} · ${info.label}`;
  $("#anim-caption").textContent = info.caption;
  $("#anim-scrub").max = info.total - 1;
  $('[data-anim="play"]').textContent = info.playing ? "❚❚ Pause" : "▶ Play";
  $('[data-anim="back"]').disabled = info.step <= 0;
  $('[data-anim="next"]').disabled = info.step >= info.total - 1;
  $('[data-anim="surface"]').hidden = !info.handoff;
  renderLegend();
}

/** Merge a patch into the settings, validate it and redraw. Returns a copy of the new state. */
function update(patch, { fit = false, controls = true, panel = true } = {}) {
  const next = validateState({ ...state, ...patch });

  if (
    next.workspace !== state.workspace ||
    fmtVec(next.N) !== fmtVec(state.N) ||
    next.stack !== state.stack ||
    next.primitiveOnly !== state.primitiveOnly ||
    next.structure !== state.structure ||
    next.hexPrism !== state.hexPrism
  ) {
    selection = null;
    previousSelection = null;
    fit = true;
  }

  state = next;
  render({ fit, controls, panel });
  return structuredClone(state);
}

/**
 * Settings that follow a structure change: the structure itself, an HCP plane when the current
 * indices mean nothing on a₁, a₂, c, a neighbor cutoff that includes three shells, and a hole
 * type the structure has. FCC gets exactly the defaults.
 */
function structureDefaults(key, s = DEFAULT_STATE) {
  const S = STRUCTURES[key];
  const patch = { structure: key };

  // A lattice parameter and label still at the previous structure's example (Al 4.05 Å for
  // FCC) follow to the new structure's example; values the user typed are kept.
  const previous = EXAMPLES[s.structure];
  if (previous && s.a === previous.a && s.element === previous.element) {
    patch.a = EXAMPLES[key].a;
    patch.element = EXAMPLES[key].element;
  }

  if (key === "fcc") {
    return { ...patch, cutoff: DEFAULT_STATE.cutoff };
  }

  patch.cutoff = Math.ceil((shellDistances(S)[2] + 0.02) * 100) / 100;

  if (S.hexagonal && !S.planes.some(([indices]) => indices === fmtVec(s.hkl))) {
    patch.hkl = [0, 0, 1];
  }

  if (!["none", "both"].includes(s.holes) && !S.holes.some((hole) => hole.type === s.holes)) {
    patch.holes = "both";
  }

  if (s.slipIndex >= S.slipCount) {
    patch.slipIndex = 0;
  }

  return patch;
}

/** Apply a teaching preset (see PRESETS). */
function applyPreset(key, { lesson = false } = {}) {
  $("#toast").hidden = true;

  if (!PRESETS[key]) {
    throw new Error("Unknown preset.");
  }

  stopAnimation();
  const preset = PRESETS[key];
  // Lessons belong to the FCC tour unless they name their own structure; preset buttons keep
  // the structure chosen in Crystal & unit cells.
  const structureKey = preset.structure ?? (lesson ? "fcc" : state.structure);
  const kept = Object.fromEntries(
    [
      "a",
      "element",
      "color",
      "selectedColor",
      "neighborColor",
      "planeColor",
      "dirColor",
      "surfaceColor",
      "colorA",
      "colorB",
      "colorC",
      "quality",
      "pngScale",
    ].map((name) => [name, state[name]]),
  );
  state = validateState({
    ...DEFAULT_STATE,
    ...kept,
    ...structureDefaults(structureKey, { ...DEFAULT_STATE, ...kept, structure: state.structure }),
    ...preset.patch,
    ...preset.variants?.[structureKey],
  });
  concept = preset.concept;
  selection = previousSelection = null;
  surfaceView.fit();
  render({ fit: true });
}

/** Show a concept in the Learn tab, optionally with its matching preset. */
function openConcept(key, withPreset = false) {
  if (!CONCEPTS[key]) {
    return;
  }

  concept = key;
  const topic = CONCEPT_TOPICS[key];
  const workspace =
    key === "cellnet"
      ? "animation"
      : ["surface", "stacking", "reciprocal"].includes(topic)
        ? topic
        : "crystal";

  if (withPreset) {
    const presetKey = {
      crystal: "basic",
      coordinates: "basic",
      primitive: "primitive",
      directions: "directions",
      planes: "planes",
      spacing: "planes",
      surface: "surface111",
      packing: "packing",
      stacking: "stacking",
      neighbors: "neighbors",
      interstitials: "interstitials",
      slip: "slip",
      partials: "partials",
      reciprocal: "diffraction",
      cellnet: "animDeconstruct",
    }[key];
    applyPreset(presetKey);
    concept = key;
  }

  update({ topic, workspace, tab: "learn" });
}

/** Selection callback for both viewers; keeps the previous pick for distance measurement. */
function handlePick(site) {
  previousSelection = selection;
  selection = site;
  render({ controls: false });
}

const surfaceView = new SurfaceView($("#surface"), handlePick);

try {
  viewer = new CrystalViewer($("#viewer"), handlePick);
} catch (error) {
  $("#view-error").hidden = false;
  $("#view-error").textContent =
    "3D needs WebGL2. Enable browser hardware acceleration or try another modern browser. The 2D surface viewer, calculations and exports remain available. " +
    error.message;
}

if (viewer) {
  viewer.onAnimation = updatePlayer;
  viewer.onAnimationPosition = (position) => {
    const scrub = $("#anim-scrub");
    if (scrub && document.activeElement !== scrub) {
      scrub.value = position;
    }
  };
}

function textField(label, key, { type = "text", min, max, step, hint = "", value } = {}) {
  return `<label class="field"><span>${label}${hint ? `<em>${hint}</em>` : ""}</span><input data-key="${key}" type="${type}" value="${escapeHtml(value ?? (Array.isArray(state[key]) ? fmtVec(state[key]) : state[key]))}" ${min !== undefined ? `min="${min}"` : ""} ${max !== undefined ? `max="${max}"` : ""} ${step !== undefined ? `step="${step}"` : ""} aria-label="${escapeHtml(label)}"></label>`;
}

function selectField(label, key, options) {
  return `<label class="field"><span>${label}</span><select data-key="${key}" aria-label="${escapeHtml(label)}">${options
    .map((option) => {
      const [value, text] = Array.isArray(option) ? option : [option, option];
      return `<option value="${value}" ${state[key] === value ? "selected" : ""}>${text}</option>`;
    })
    .join("")}</select></label>`;
}

function checkField(label, key) {
  return `<label class="check"><span>${label}</span><input type="checkbox" data-key="${key}" ${state[key] ? "checked" : ""}></label>`;
}

function rangeField(label, key, min, max, step = 1, suffix = "") {
  return `<label class="field"><span>${label}<em data-value="${key}">${fmt(state[key])}${suffix}</em></span><input data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}" aria-label="${escapeHtml(label)}"></label>`;
}

function colorField(label, key) {
  return `<label class="colors">${label}<input type="color" data-key="${key}" value="${state[key]}" aria-label="${escapeHtml(label)}"></label>`;
}

function section(id, title, content, open = false) {
  return `<details class="control-detail" data-detail="${id}" ${open ? "open" : ""}><summary>${title}</summary>${content}</details>`;
}

function indexButtons(key, values) {
  return `<div class="presets">${values.map((value) => `<button data-pick="${key}" data-value="${value}" class="${fmtVec(state[key]) === value ? "active" : ""}">${key === "uvw" ? "[" : "("}${value.replaceAll(" ", "\u2009")}${key === "uvw" ? "]" : ")"}</button>`).join("")}</div>`;
}

const note = (text) => `<p class="small-note">${text}</p>`;

/** Quick picks with their own labels, e.g. HCP [h k l] values shown as (h k i l). */
function labeledButtons(key, picks) {
  return `<div class="presets">${picks.map(([value, label]) => `<button data-pick="${key}" data-value="${value}" class="${fmtVec(state[key]) === value ? "active" : ""}">${label}</button>`).join("")}</div>`;
}

/** Plane index field and quick picks: (h k l), or (h k l) / (h k i l) on a₁, a₂, c for HCP. */
function planeIndexField(label, key) {
  if (!structure().hexagonal) {
    return textField(label, key, { hint: "integers; spaces" });
  }
  return (
    textField(`${label.replace("(h k l)", "")}(h k l) or (h k i l)`, key, {
      hint: "a₁, a₂, c axes",
    }) + note(`(${fmtVec(state[key])}) on a₁, a₂, c is (${planeName(state[key])}).`)
  );
}

function planeControls() {
  return (
    checkField("Plane sheet", "plane") +
    planeIndexField("Miller indices (h k l)", "hkl") +
    (structure().hexagonal
      ? labeledButtons("hkl", STRUCTURES.hcp.planes)
      : indexButtons("hkl", [
          "0 0 1",
          "0 1 0",
          "1 0 0",
          "1 1 0",
          "1 0 1",
          "0 1 1",
          "1 1 1",
          "1 1 2",
          "2 1 0",
        ])) +
    selectField("Plane location", "location", [
      ["canonical", "Canonical · c = 1"],
      ["origin", "Through origin · c = 0"],
      [
        "center",
        structure().hexagonal && state.hexPrism
          ? "Through prism center"
          : "Through supercell center",
      ],
      ["translated", "Translated · choose c"],
      ["layer", "Occupied layer · choose index"],
    ]) +
    (state.location === "translated"
      ? textField("Plane level c", "c", { type: "number", min: -500, max: 500, step: 0.1 })
      : "") +
    (state.location === "layer"
      ? textField("Atomic layer index", "layer", { type: "number", min: -500, max: 500, step: 1 })
      : "") +
    selectField("Plane set", "planeSet", [
      ["one", "One plane"],
      [
        "symmetry",
        structure().hexagonal ? "Hexagonal symmetry family" : "Cubic symmetry family {hkl}",
      ],
      ["parallel", "Parallel geometric c = integers"],
      ["atomic", "All occupied parallel layers"],
    ]) +
    checkField("Extend outside supercell", "extend") +
    checkField("Highlight atoms on primary plane", "highlight") +
    checkField("Normal vector", "normal") +
    checkField("Geometric spacing d", "spacing") +
    checkField("Plane labels", "planeLabels") +
    rangeField("Sheet opacity", "planeOpacity", 0.03, 0.8, 0.01) +
    `<button data-action="family-animation">${animationTimer ? "Stop animation" : "Animate symmetry family"}</button>` +
    note(
      "Changing indices preserves their scale: (100) and (200) have different geometric d. Family members use distinct colors.",
    )
  );
}

function directionControls() {
  return (
    checkField("Direction arrow", "direction") +
    (structure().hexagonal
      ? textField("Direction [u v w] or [u v t w]", "uvw", { hint: "a₁, a₂, c axes" }) +
        note(`[${fmtVec(state.uvw)}] on a₁, a₂, c is [${directionName(state.uvw)}].`) +
        labeledButtons("uvw", STRUCTURES.hcp.directions)
      : textField("Direction [u v w]", "uvw", { hint: "integers; spaces" }) +
        indexButtons("uvw", [
          "1 0 0",
          "0 1 0",
          "0 0 1",
          "1 1 0",
          "1 -1 0",
          "1 0 1",
          "1 1 1",
          "1 1 -2",
        ])) +
    rangeField("Vector multiplier × a", "scale", 0.05, 4, 0.05) +
    textField(
      structure().hexagonal ? "Arrow origin (unit-cell fractions)" : "Arrow origin / a",
      "arrowOrigin",
      { hint: structure().hexagonal ? "f₁ f₂ f₃" : "X Y Z" },
    ) +
    checkField("Direction family ⟨uvw⟩", "dirFamily") +
    checkField("Repeat this displayed vector", "repeat") +
    note(
      `Repeating an arbitrary scaled arrow does not guarantee ${structure().short} lattice-site endpoints. Calculate tests the actual vector.`,
    )
  );
}

function sharedControls() {
  const S = structure();
  const registryPlane = S.hexagonal ? "(0001)" : "(111)";
  return (
    section(
      "appearance",
      "Atoms & colors",
      checkField("Host atoms", "atoms") +
        selectField("Sphere radius", "radiusMode", [
          ["educational", "Educational · fraction of a"],
          [
            "physical",
            `Touching hard spheres · ${S.key === "fcc" ? "a/(2√2)" : S.formulas.radius}`,
          ],
          ["manual", "Manual · fraction of a"],
        ]) +
        (state.radiusMode !== "physical"
          ? rangeField("Radius / a", "radius", 0.015, 0.49, 0.005)
          : note(`R = ${fmt(metricsOf(S, state.a).radius)} Å · geometric hard-sphere value.`)) +
        rangeField("Host opacity", "opacity", 0.05, 1, 0.01) +
        rangeField("Sphere resolution", "quality", 8, 48, 4) +
        selectField("Host labels", "labels", [
          ["none", "None"],
          ["id", "Site ID"],
          ["fractional", S.hexagonal ? "Unit-cell fractions" : "Conventional fractions"],
          ["cartesian", "Cartesian coordinates (Å)"],
          ["registry", `${registryPlane} ${S.hexagonal ? "A / B" : "A / B / C"} registry`],
        ]) +
        checkField(`Color ${registryPlane} registries`, "registryColor") +
        colorField("Host atoms", "color") +
        colorField("Selected site", "selectedColor") +
        colorField("Neighbors", "neighborColor") +
        colorField("Plane-layer atoms", "layerColor") +
        colorField("Plane sheets", "planeColor") +
        colorField("Direction arrows", "dirColor") +
        colorField("Surface / primitive cell", "surfaceColor") +
        note(
          "Display sizes do not change the physics. Base-atom labels are capped at 180; all sites remain pickable.",
        ),
    ) +
    section(
      "camera",
      "Camera & output",
      selectField("Projection", "camera", [
        ["orthographic", "Orthographic"],
        ["perspective", "Perspective"],
      ]) +
        '<label class="field"><span>Custom look direction</span><input id="custom-look" value="1 1 1" aria-label="Custom look direction"></label><button data-action="custom-look">Look along vector</button>' +
        rangeField("PNG resolution multiplier", "pngScale", 1, 4) +
        note(
          "In stacking mode, view buttons refer to the displayed orthonormal stack frame; use its Normal / Side buttons.",
        ),
    ) +
    section(
      "scale",
      "Scale & element label",
      textField("Lattice parameter a (Å)", "a", {
        type: "number",
        min: 0.1,
        max: 100,
        step: 0.01,
      }) +
        textField("Element label", "element") +
        note(
          "The label is metadata; this app does not fetch element radii, temperature dependence or material properties.",
        ),
    )
  );
}

/** Left panel: the controls of the current topic plus the shared appearance controls. */
function renderControls() {
  const openDetails = new Set(
    $$("#controls details[open]").map((element) => element.dataset.detail),
  );
  let html = "";

  if (state.topic === "crystal") {
    const S = structure();
    const prism = S.hexagonal && state.hexPrism;
    html =
      `<div class="control-title">${S.hexagonal ? `HCP ${prism ? "HEXAGONAL PRISM" : "HEXAGONAL UNIT CELL"}` : `CONVENTIONAL ${S.short} CELL`}</div>` +
      selectField(
        "Crystal structure",
        "structure",
        STRUCTURE_KEYS.map((key) => [key, `${STRUCTURES[key].short} · ${STRUCTURES[key].name}`]),
      ) +
      textField(
        S.hexagonal ? "Lattice parameter a (Å) · c = 1.633 a" : "Lattice parameter a (Å)",
        "a",
        { type: "number", min: 0.1, max: 100, step: 0.01 },
      ) +
      (S.hexagonal ? checkField("Hexagonal prism (3 unit cells)", "hexPrism") : "") +
      `<div class="row">${state.N.map((count, axis) => `<label class="field"><span>N${"xyz"[axis]}</span><input type="number" data-axis="${axis}" value="${count}" min="1" max="10" step="1" aria-label="N${"xyz"[axis]}"></label>`).join("")}</div>` +
      (prism
        ? note(
            `The prism is N${"z"} = ${state.N[2]} ${state.N[2] === 1 ? "story" : "stories"} high: 12 corners × ⅙ + 2 face centers × ½ + 3 inside = 6 atoms per story. Nx and Ny size the unit-cell supercell used without the prism and by the exports.`,
          )
        : "") +
      selectField("Boundary representation", "mode", [
        ["closed", "Closed drawing · all boundary sites"],
        ["ghost", "Unique atoms + periodic ghosts"],
        ["unique", "Unique computational atoms only"],
      ]) +
      note(
        prism
          ? "The prism is always drawn closed: 17 visible sites per story. Unique and ghost drawings apply to the unit-cell supercell."
          : `Default: ${S.unit.sites} visible sites, ${S.unit.atoms} periodic atom${S.unit.atoms === 1 ? "" : "s"}. Unique mode deliberately omits repeated outer faces.`,
      ) +
      checkField("Capped boundary spheres", "clip") +
      selectField(S.hexagonal ? "Cell boundaries" : "Conventional boundaries", "bounds", [
        ["outer", prism ? "Prism outline" : "Outer supercell box"],
        [
          "all",
          prism
            ? "Prism and its 3 unit cells"
            : S.hexagonal
              ? "Every unit cell"
              : "Every conventional cell",
        ],
        ["none", "None"],
      ]) +
      checkField(S.hexagonal ? "Hexagonal axes a₁, a₂, c" : "Cubic axes", "axes") +
      checkField("Global origin", "origin") +
      section(
        "primitive",
        "3D primitive cell",
        checkField("Primitive-cell overlay", "primitive") +
          checkField("Isolate primitive tiling", "primitiveOnly") +
          rangeField("Tiling in each primitive direction", "tiles", 1, 3) +
          checkField("Primitive vectors", "primitiveVectors") +
          checkField("Wigner–Seitz cell", "ws") +
          note(
            `Isolate replaces the ${S.hexagonal ? "unit-cell" : "cubic"} atom drawing. The Wigner–Seitz cell is centered on the selected host or the origin.`,
          ),
        concept === "primitive",
      ) +
      section(
        "selected-cell",
        S.hexagonal ? "Highlight a unit cell" : "Highlight a conventional cell",
        checkField("Selected cell box", "cellOn") +
          textField("Cell index (i j k)", "cell", { hint: "zero based" }) +
          note(
            prism
              ? "In the prism, the highlighted unit cell is the one spanned by a₁, a₂ on story k."
              : "One selected box; indices are clamped to the configured supercell.",
          ),
      ) +
      section(
        "presets",
        "Learning presets",
        `<div class="preset-list">${Object.entries(PRESETS)
          .filter(([, preset]) => !preset.structures || preset.structures.includes(S.key))
          .map(([key, preset]) => `<button data-preset="${key}">${presetTitle(preset, S)}</button>`)
          .join("")}</div>`,
      );
  }

  if (state.topic === "geometry") {
    html =
      '<div class="control-title">ORIENTATION & LOCATION</div>' +
      section("planes", "Miller planes", planeControls(), concept !== "directions") +
      section("directions", "Directions", directionControls(), concept === "directions") +
      section(
        "comparisons",
        "Compare orientations",
        (structure().hexagonal
          ? textField("Second plane (h k l) or (h k i l)", "hkl2")
          : textField("Second plane (h k l)", "hkl2")) +
          checkField("Draw comparison plane", "plane2") +
          (structure().hexagonal
            ? textField("Second direction [u v w] or [u v t w]", "uvw2")
            : textField("Second direction [u v w]", "uvw2")) +
          checkField("Draw comparison direction", "dir2") +
          note(
            "Calculate reports direction–direction, plane–plane and direction–plane angles. Comparison planes use the same location rule.",
          ),
      );
  }

  if (state.topic === "surface") {
    const layers = planeLayers();
    const S = layers.structure;
    const hexagonal = S.hexagonal;
    const layer = currentLayer();
    html =
      '<div class="control-title">A SINGLE ATOMIC LAYER</div>' +
      (hexagonal
        ? textField("HCP plane (h k l) or (h k i l)", "hkl", { hint: "a₁, a₂, c axes" }) +
          labeledButtons("hkl", STRUCTURES.hcp.planes) +
          note(`(${fmtVec(state.hkl)}) on a₁, a₂, c is (${layers.label}) with i = −(h + k).`)
        : textField("Surface normal (h k l)", "hkl") +
          indexButtons("hkl", ["0 0 1", "1 1 0", "1 1 1", "1 1 2", "2 1 0", "1 -1 0"])) +
      textField("Occupied layer index", "layer", {
        type: "number",
        min: -500,
        max: 500,
        step: 1,
        value: layer,
      }) +
      (state.location === "layer"
        ? ""
        : '<button data-action="use-layer">Keep this layer when the plane moves</button>') +
      note(
        `Layer ${layer} at c = ${fmt(layerS(layers, layer) * gcdOf(state.hkl))}${state.location === "layer" ? "." : `, the occupied layer nearest to the ${escapeHtml(state.location)} plane.`}`,
      ) +
      section(
        "animate",
        "Animate: cells, arrays and layers",
        `<div class="anim-launch">${ANIMATION_MODES.map(([key, title]) => `<button data-anim-mode="${key}" class="${state.workspace === "animation" && state.animMode === key ? "active" : ""}">${title}</button>`).join("")}</div>` +
          note(
            "Opens the Cell ⇄ Net 3D view for this structure, plane and layer. Step with the player under the view or the ← / → keys.",
          ),
        true,
      ) +
      checkField("2D primitive surface cell", "surfaceCell") +
      checkField("Surface vectors t₁, t₂", "surfaceVectors") +
      checkField("Primitive-cell tiling", "tiling") +
      checkField(
        hexagonal ? "Integer a₁, a₂, c translation mesh" : "Integer cubic-translation mesh",
        "conventional",
      ) +
      checkField("In-plane nearest-neighbor bonds", "bonds2d") +
      checkField("2D lattice-index labels", "labels2d") +
      rangeField("Surface patch repeats", "netRepeat", 1, 8) +
      checkField("Surface patch in crystal view", "surface") +
      '<button data-action="inspect-surface">Inspect patch in 3D</button>' +
      note(
        `The dashed mesh spans integer ${hexagonal ? "a₁, a₂, c" : "cubic"} translations. It is a comparison cell, not a unique conventional surface-cell convention.`,
      ) +
      `<div class="presets">${[
        ["surface001", hexagonal ? "(0001)" : "(001)"],
        ["surface110", hexagonal ? "(10−10)" : "(110)"],
        ["surface111", hexagonal ? "(11−20)" : "(111)"],
      ]
        .map(([key, label]) => `<button data-preset="${key}">${label}</button>`)
        .join(
          "",
        )}</div><button data-preset="packing">Show ${["fcc", "hcp"].includes(S.key) ? "close-packed" : "touching"} contacts</button>`;
  }

  if (state.topic === "stacking") {
    html =
      '<div class="control-title">REGISTRY & LAYER SEQUENCE</div>' +
      selectField(
        "Stacking construction",
        "stack",
        Object.entries(STACKINGS).map(([key, stack]) => [key, stack.name]),
      ) +
      note(STACKINGS[state.stack].note) +
      rangeField("Number of layers", "layers", 1, 12) +
      rangeField("Patch repeats", "stackRepeat", 1, 6) +
      rangeField("Visual layer separation", "separation", 1, 3, 0.05, "×") +
      `<div class="row"><button data-action="stack-normal">Normal view</button><button data-action="stack-side">Side view</button></div><div class="row">${"ABC"
        .split("")
        .map(
          (registry) =>
            `<label class="check">${registry}<input type="checkbox" data-registry="${registry}" ${state.registries.includes(registry) ? "checked" : ""}></label>`,
        )
        .join("")}</div>` +
      checkField("Layer labels", "stackLabels") +
      checkField("Stack coordinate axes", "axes") +
      checkField("Twin-plane marker", "twinPlane") +
      colorField("A registry", "colorA") +
      colorField("B registry", "colorB") +
      colorField("C registry", "colorC") +
      `<button data-action="stack-animation">${animationTimer ? "Stop animation" : "Animate layer addition"}</button>` +
      note(
        "Stack coordinates use an orthonormal [111] frame. FCC, HCP and fault comparisons share the same in-plane lattice; they do not all represent FCC bulk.",
      ) +
      (["sc", "bcc"].includes(state.structure)
        ? note(
            `${structure().short} has no close-packed layers: this workspace compares FCC and HCP stacking. The layer stacking of any ${structure().short} plane is in the Cell ⇄ Net workspace.`,
          )
        : "");
  }

  if (state.topic === "environment") {
    const S = structure();
    const words = { 2: "two", 6: "six", 8: "eight", 12: "twelve", 24: "twenty-four" };
    html =
      '<div class="control-title">BULK LOCAL ENVIRONMENT</div>' +
      checkField("Neighbors of selected host", "neighbors") +
      selectField("Include shells through", "shell", [
        [1, `1 · ${words[S.shells[0]]} neighbors`],
        [2, `2 · plus ${words[S.shells[1]]}`],
        [3, `3 · plus ${words[S.shells[2]]}`],
      ]) +
      rangeField("Cutoff radius / a", "cutoff", 0.05, 2, 0.01) +
      checkField("Neighbor bonds", "bonds") +
      checkField("First-shell coordination hull", "hull") +
      note(
        `Click a host to move the center. Infinite ${S.short} translations supply neighbors beyond the displayed box.`,
      ) +
      section(
        "holes",
        "Interstitial sites",
        selectField("Empty sites", "holes", [
          ["none", "None"],
          ...S.holes.map((hole) => [hole.type, hole.name]),
          ...(S.holes.length > 1 ? [["both", "Both types"]] : [["both", "All types"]]),
        ]) +
          checkField("Hosts around selected hole", "hosts") +
          note(
            `Click a hole to inspect its ${S.holes.map((hole) => hole.coordination).join(" or ")} nearest hosts. Lower host opacity makes interior markers easier to select.`,
          ),
        true,
      ) +
      '<div class="row"><button data-preset="neighbors">Neighbors</button><button data-preset="interstitials">Holes</button></div>';
  }

  if (state.topic === "slip") {
    const S = structure();
    const systems = slipSystemsOf(S, state.load);
    const words = { 6: "six", 12: "twelve" };
    html =
      `<div class="control-title">${S.hexagonal ? "⟨a⟩ SLIP · BASAL, PRISMATIC, PYRAMIDAL" : `${S.slip.name} SLIP`}</div>` +
      checkField("Slip plane & Burgers vector", "slip") +
      selectField(
        "Slip system",
        "slipIndex",
        systems.map((system, index) => [index, `${index + 1}. ${system.label}`]),
      ) +
      checkField(`All ${words[systems.length] ?? systems.length} slip systems`, "allSlip") +
      (S.hexagonal
        ? textField("Loading direction [u v w] or [u v t w]", "load") +
          labeledButtons("load", [
            ["0 0 1", "[0001]"],
            ["1 0 0", "[2−1−10]"],
            ["2 1 0", "[10−10]"],
          ])
        : textField("Loading direction [u v w]", "load") +
          `<div class="presets">${["0 0 1", "1 1 1", "1 2 3"].map((value) => `<button data-pick="load" data-value="${value}">[${value}]</button>`).join("")}</div>`) +
      (partialsOf(S)
        ? checkField(
            S.hexagonal ? "Basal partial-vector triangle" : "Shockley partial-vector triangle",
            "partials",
          ) +
          note(
            `The partial-vector triangle is a separate fixed ${S.hexagonal ? "(0001)" : "(111)"} example. It does not silently change to match the selected slip system.`,
          )
        : note(
            `Partial-vector triangles are shown for the close-packed planes of FCC and HCP; ${S.short} has none.`,
          )) +
      '<button data-concept="partials">Explain partials</button>';
  }

  if (state.topic === "reciprocal") {
    const S = structure();
    html =
      `<div class="control-title">RECIPROCAL ${S.reciprocalName.toUpperCase()} LATTICE</div>` +
      (S.hexagonal
        ? textField("Selected G indices (h k l) or (h k i l)", "reflection") +
          labeledButtons("reflection", [
            ["0 0 2", "(0002)"],
            ["1 0 0", "(10−10)"],
            ["1 0 1", "(10−11)"],
            ["0 0 1", "(0001)"],
            ["1 1 0", "(11−20)"],
            ["1 0 2", "(10−12)"],
          ])
        : textField("Selected G indices (h k l)", "reflection") +
          indexButtons("reflection", ["1 1 1", "2 0 0", "2 2 0", "1 0 0", "1 1 0", "2 2 2"])) +
      textField("Wavelength λ (Å)", "lambda", { type: "number", min: 0.001, max: 20, step: 0.01 }) +
      rangeField("Reciprocal grid extent", "extent", 1, 4) +
      checkField("Allowed reciprocal nodes", "atoms") +
      checkField("Forbidden comparison markers", "forbidden") +
      checkField("Selected G arrow & marker", "selectedG") +
      checkField("Primitive reciprocal vectors", "basisReciprocal") +
      checkField("Reciprocal axes", "axes") +
      selectField("Reciprocal conventional box", "bounds", [
        [
          "outer",
          S.hexagonal
            ? "Show reciprocal unit cell"
            : `Show edge ${S.reciprocalBox === 1 ? "2π/a" : "4π/a"}`,
        ],
        ["none", "None"],
      ]) +
      note(
        `The displayed coordinate unit is 2π/a Å⁻¹. ${
          {
            sc: "Every integer (hkl) is a node of the reciprocal simple cubic lattice.",
            bcc: "Points with h + k + l odd are not nodes of the reciprocal lattice.",
            fcc: "Mixed-parity points are not nodes of the reciprocal lattice.",
            hcp: "Points with h + 2k a multiple of 3 and l odd are not nodes with intensity.",
          }[S.key]
        } Calculate shows allowed Bragg positions, without intensities.`,
      );
  }

  $("#controls").innerHTML = html + sharedControls();

  for (const id of openDetails) {
    const detail = $(`#controls [data-detail="${id}"]`);
    if (detail) {
      detail.open = true;
    }
  }
}

const valueList = (rows) =>
  `<dl class="calc">${rows.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join("")}</dl>`;

function currentValues() {
  const s = state;
  const S = structure();
  const fcc = S.key === "fcc";
  const metrics = metricsOf(S, s.a);
  const plane = planeOf(S, s.hkl, s.a);
  const surface = surfaceOf(S, s.hkl, s.a);
  const direction = directionOf(S, s.uvw, s.a);
  const reflection = reflectionOf(S, s.reflection, s.a, s.lambda);

  if (concept === "stacking") {
    // The stacking comparison is built from close-packed layers in units of the FCC a.
    const stack = buildStack(s.stack, s.layers, s.stackRepeat, s.separation, s.registries);
    return valueList([
      ["Construction", STACKINGS[s.stack].name],
      ["Ideal layer gap", `${fmt(stack.height * s.a)} Å`],
      ["Displayed gap", `${fmt(stack.displayHeight * s.a)} Å`],
      ["In-plane distance", `${fmt(s.a / Math.SQRT2)} Å`],
      ["Registry sequence", stack.sequence],
      [
        "Ideal repeat",
        s.stack === "fcc"
          ? `${fmt(Math.sqrt(3) * s.a)} Å`
          : s.stack === "hcp"
            ? `${fmt(2 * stack.height * s.a)} Å`
            : s.stack === "aaa"
              ? `${fmt(stack.height * s.a)} Å`
              : "Fault / twin: nonuniform",
      ],
    ]);
  }

  if (concept === "cellnet") {
    const layers = planeLayers(s);
    return valueList([
      ["Structure", `${layers.structure.short} · ${layers.structure.name}`],
      ["Plane", `(${layers.label}) · layer ${currentLayer()}`],
      ["Net", netText(layers)],
      ["Layer spacing d", spacingText(layers, s.a)],
      ["Stacking period N", layers.period],
      ["Primitive cell", `${layers.lengths.map((length) => fmt(length * s.a)).join(" / ")} Å`],
      ["Area per atom", `${fmt((layers.area / layers.atomsPerCell) * s.a * s.a)} Å²`],
    ]);
  }

  if (["planes", "spacing"].includes(concept)) {
    return valueList([
      ["Plane", `(${planeName(s.hkl)})`],
      ["Geometric d", `${fmt(plane.d)} Å`],
      [
        "Adjacent occupied layers",
        plane.evenlySpaced
          ? `${fmt(plane.gap)} Å`
          : `${plane.gaps.map((gap) => fmt(gap)).join(" / ")} Å, alternating`,
      ],
      ["Pure normal repeat", `${fmt(plane.period)} Å`],
    ]);
  } else if (["surface", "packing"].includes(concept)) {
    return valueList([
      ["Surface", `(${planeName(s.hkl)})`],
      ["Primitive-vector lengths", `${surface.lengths.map((length) => fmt(length)).join(" / ")} Å`],
      ["Included angle", `${fmt(surface.angle, 2)}°`],
      ["Area", `${fmt(surface.area)} Å²`],
      ["Planar density", `${fmt(surface.density, 5)} Å⁻²`],
      ["Hard-sphere APF", fmt(metrics.apf, 6)],
    ]);
  } else if (["directions", "slip", "partials"].includes(concept)) {
    const partials = partialsOf(S);
    return valueList(
      fcc
        ? [
            ["Selected arrow length", `${fmt(direction.length * s.scale)} Å`],
            ["a/2[uvw] translation?", direction.halfValid ? "Yes" : "No"],
            ["Perfect |b|", `${fmt(metrics.nn)} Å`],
            ["Shockley |bₚ|", `${fmt(s.a / Math.sqrt(6))} Å`],
          ]
        : [
            ["Selected arrow length", `${fmt(direction.length * s.scale)} Å`],
            [`Shortest translation along [${directionName(s.uvw)}]`, `${fmt(direction.period)} Å`],
            [`Perfect |b| = ${S.slip.burgers}`, `${fmt(metrics.nn)} Å`],
            ...(partials ? [["Partial |bₚ|", `${fmt(partials.partialLength * s.a)} Å`]] : []),
          ],
    );
  } else {
    return valueList(
      concept === "reciprocal"
        ? [
            ["Selected reflection", `(${planeName(s.reflection)})`],
            [fcc ? "F/f" : "|F/f|", fcc ? reflection.factor : fmt(reflection.factor)],
            ["Allowed?", reflection.allowed ? "Yes" : "No"],
            ["d", `${fmt(reflection.d)} Å`],
            ["|G|", `${fmt(reflection.magnitude)} Å⁻¹`],
            [
              "Geometric 2θ",
              reflection.twoTheta === null ? "λ > 2d" : `${fmt(reflection.twoTheta, 3)}°`,
            ],
          ]
        : [
            ["Lattice constant", `${fmt(s.a)} Å`],
            ...(S.hexagonal ? [["Axis c = 1.633 a", `${fmt(S.axes[2][2] * s.a)} Å`]] : []),
            ["Nearest-neighbor distance", `${fmt(metrics.nn)} Å`],
            ["Touching-sphere radius", `${fmt(metrics.radius)} Å`],
            ["3D primitive volume", `${fmt(metrics.primitiveVolume)} Å³`],
            [
              "Periodic atoms",
              formatCount(
                S.hexagonal && s.hexPrism
                  ? 6 * s.N[2]
                  : S.unit.atoms * s.N.reduce((product, count) => product * count),
              ),
            ],
          ],
    );
  }
}

/** Learn tab: the current concept, with live values for the current settings. */
function renderLearn() {
  const info = conceptFor(concept, state.structure);
  return `<article class="learn"><div class="eyebrow">THE IDEA</div><h2>${info.title}</h2><p>${info.intro}</p><div class="equation">${escapeHtml(info.equation)}</div><h3>Read the drawing</h3><p>${info.view}</p><div class="warning"><strong>COMMON CONFUSION</strong><p>${info.confusion}</p></div><h3>With your current values</h3>${currentValues()}<div class="try"><strong>TRY THIS</strong><p>${info.try}</p></div><h3>Connect the ideas</h3><div class="related">${info.related
    .map(
      (key) =>
        `<button data-concept="${key}">${
          {
            crystal: `${structure().short} cell`,
            primitive: "3D primitive cell",
            coordinates: "Coordinates",
            directions: "Directions",
            planes: "Miller planes",
            spacing: "Three spacings",
            surface: "Surface net",
            packing: "Close packing",
            cellnet: "Cell ⇄ net",
            stacking: "Stacking",
            neighbors: "Neighbors",
            interstitials: "Holes",
            slip: "Slip",
            partials: "Partials",
            reciprocal: "Reciprocal space",
          }[key]
        }</button>`,
    )
    .join(
      "",
    )}</div><h3>Learn further</h3>${info.refs.map((key) => `<a class="reference" href="${REFERENCES[key].url}" target="_blank" rel="noopener">${REFERENCES[key].title} ↗</a>`).join("")}</article>`;
}

/** Calculate tab: every derived quantity for the current settings. */
function renderCalculate() {
  const s = state;
  const S = structure();
  const fcc = S.key === "fcc";
  const metrics = metricsOf(S, s.a);
  const plane = planeOf(S, s.hkl, s.a);
  const surface = surfaceOf(S, s.hkl, s.a);
  const direction = directionOf(S, s.uvw, s.a);
  const region = regionOf(S, s);
  const level = planeLevelOf(S, s.hkl, region.levelCells, s.location, s.c, s.layer);
  const stack = buildStack(s.stack, s.layers, s.stackRepeat, s.separation, s.registries);
  const systems = slipSystemsOf(S, s.load);
  const reflection = reflectionOf(S, s.reflection, s.a, s.lambda);
  const atomCount = S.unit.atoms * s.N.reduce((product, count) => product * count);
  const bragg = braggTableOf(S, s.a, s.lambda);
  const neighbors = neighborsOf(
    S,
    selection?.space === "crystal" && !selection.type ? selection.p : [0, 0, 0],
    s.shell,
    s.cutoff,
  );
  let html = '<div class="eyebrow">LIVE MATHEMATICS</div><h2>Calculate the drawing.</h2>';

  if (s.workspace === "stacking") {
    html +=
      `<h3>Current stacking model</h3><div class="equation">${stack.sequence}</div>` +
      valueList([
        ["Frame", "e₁ ∥ [1 −1 0]; e₂ ∥ [1 1 −2]"],
        ["Ideal gap", `${fmt(stack.height * s.a)} Å`],
        ["Display exaggeration", `${fmt(s.separation)}×`],
        ["Displayed gap", `${fmt(stack.displayHeight * s.a)} Å`],
        ["Lateral hollow shift / a", fmtVec(stack.shift)],
        ["Constructed sites", formatCount(stack.points.length)],
      ]) +
      note(STACKINGS[s.stack].note);
  }

  if (s.topic === "reciprocal" || s.workspace === "reciprocal") {
    const rule = {
      sc: ["F/f = 1", "Every (hkl) · allowed", "—"],
      bcc: [
        `F/f = 1 + (−1)^(h+k+l) = ${fmt(reflection.factor)}`,
        "h + k + l even · allowed",
        "h + k + l odd · absent",
      ],
      fcc: [
        `F/f = 1 + (−1)^(k+l) + (−1)^(h+l) + (−1)^(h+k) = ${reflection.factor}`,
        "All same parity · allowed",
        "Mixed parity · absent",
      ],
      hcp: [
        `|F/f| = |1 + e^(2πi(h/3 + 2k/3 + l/2))| = ${fmt(reflection.factor)}`,
        "Phases do not cancel · allowed",
        "h + 2k = 3n and l odd · absent",
      ],
    }[S.key];
    html +=
      `<h3>Selected diffraction geometry</h3><div class="equation">${rule[0]}</div>` +
      valueList([
        ["Reflection", `(${planeName(s.reflection)})`],
        ["Selection rule", reflection.allowed ? rule[1] : rule[2]],
        ["d", `${fmt(reflection.d)} Å`],
        ["G", `${fmtVec(reflection.G)} Å⁻¹`],
        ["|G| = 2π/d", `${fmt(reflection.magnitude)} Å⁻¹`],
        ["Wavelength", `${fmt(s.lambda)} Å`],
        [
          "Geometric 2θ",
          reflection.twoTheta === null ? "Inaccessible: λ > 2d" : `${fmt(reflection.twoTheta, 4)}°`,
        ],
      ]) +
      note(
        "A geometric angle for a forbidden index is not a predicted peak. Equal monatomic scatterers are assumed.",
      ) +
      `<h3>Allowed reflections (h ≤ 5)</h3><table><thead><tr><th>(hkl)</th><th>d (Å)</th><th>2θ</th></tr></thead><tbody>${bragg.map((row) => `<tr><td>(${planeName(row.n)})</td><td>${fmt(row.d)}</td><td>${fmt(row.twoTheta, 3)}°</td></tr>`).join("") || '<tr><td colspan="3">No accessible listed reflections at this λ.</td></tr>'}</tbody></table>`;
  }

  if (s.topic === "slip") {
    const partials = partialsOf(S);
    html +=
      `<h3>Schmid factors · load [${directionName(s.load)}]</h3><div class="equation">m = |l̂·n̂| |l̂·b̂| ≤ 0.5</div><table><thead><tr><th>Slip system</th><th>m</th></tr></thead><tbody>${systems.map((system, index) => `<tr data-slip="${index}" class="${index === s.slipIndex ? "current" : ""}"><td>${system.label}</td><td>${fmt(system.schmid, 4)}</td></tr>`).join("")}</tbody></table>` +
      valueList(
        fcc
          ? [
              ["Perfect |b|", `${fmt(metrics.nn)} Å`],
              ["Shockley |bₚ|", `${fmt(s.a / Math.sqrt(6))} Å`],
              ["Partial sum / a", fmtVec(add(partials.first, partials.second))],
              ["Both partials · [111]", "0; 0"],
            ]
          : [
              [`Perfect |b| = |${S.slip.burgers}|`, `${fmt(metrics.nn)} Å`],
              ...(partials
                ? [
                    ["Partial |bₚ|", `${fmt(partials.partialLength * s.a)} Å`],
                    ["Partial sum / a", fmtVec(add(partials.first, partials.second))],
                    ["Both partials · [0001]", "0; 0"],
                  ]
                : []),
            ],
      ) +
      note(
        "Click a row to view that slip system. This is resolved shear geometry, without a constitutive stress model.",
      );
  }

  html += `<h3>Bulk ${S.short} geometry</h3>${valueList(
    fcc
      ? [
          ["a", `${fmt(s.a)} Å`],
          ["Unique supercell atoms", formatCount(atomCount)],
          ["Closed drawing sites", formatCount(sitesOf(S, s.N).length)],
          ["Nearest neighbors", "12 in ideal bulk"],
          ["dNN = a/√2", `${fmt(metrics.nn)} Å`],
          ["R = a√2/4", `${fmt(metrics.radius)} Å`],
          ["APF = π/(3√2)", fmt(metrics.apf, 6)],
          ["Conventional volume", `${fmt(metrics.volume)} Å³`],
          ["3D primitive volume", `${fmt(metrics.primitiveVolume)} Å³`],
          ["Primitive angles", "60°, 60°, 60°"],
        ]
      : [
          ["a", `${fmt(s.a)} Å`],
          ...(S.hexagonal ? [["c = √(8/3) a", `${fmt(S.axes[2][2] * s.a)} Å`]] : []),
          [`Atoms per ${S.hexagonal ? "unit" : "conventional"} cell`, S.unit.count],
          ...(S.hexagonal
            ? [
                ["Atoms per hexagonal prism", "12 × ⅙ + 2 × ½ + 3 = 6"],
                ["Prism drawing sites", formatCount(prismSites(S, s.N[2]).length)],
              ]
            : []),
          [
            S.hexagonal ? "Unique unit-cell supercell atoms" : "Unique supercell atoms",
            formatCount(atomCount),
          ],
          [
            S.hexagonal ? "Closed unit-cell drawing sites" : "Closed drawing sites",
            formatCount(sitesOf(S, s.N).length),
          ],
          ["Nearest neighbors", `${S.coordination} in ideal bulk`],
          [`dNN = ${S.formulas.nearest}`, `${fmt(metrics.nn)} Å`],
          [`R = ${S.formulas.radius}`, `${fmt(metrics.radius)} Å`],
          [`APF = ${S.formulas.apf}`, fmt(metrics.apf, 6)],
          [S.hexagonal ? "Unit-cell volume" : "Conventional volume", `${fmt(metrics.volume)} Å³`],
          ["3D primitive volume", `${fmt(metrics.primitiveVolume)} Å³`],
          [
            "Primitive angles",
            S.hexagonal
              ? "90°, 90°, 120°"
              : `${fmt(S.primitiveAngle, 2)}°, ${fmt(S.primitiveAngle, 2)}°, ${fmt(S.primitiveAngle, 2)}°`,
          ],
        ],
  )}`;
  const axisNames = S.hexagonal ? ["f₁", "f₂", "f₃"] : ["X", "Y", "Z"];
  const axisLengths = S.hexagonal ? [1, 1, S.axes[2][2]] : [1, 1, 1];
  html +=
    `<h3>Plane (${planeName(s.hkl)})</h3><div class="equation">${s.hkl.map((value, axis) => `${value}${axisNames[axis]}`).join(" + ")} = ${fmt(level)}<br>${S.hexagonal ? "r = f₁a₁ + f₂a₂ + f₃c" : "X=x/a, Y=y/a, Z=z/a"}</div>` +
    valueList([
      ["Location rule", escapeHtml(s.location)],
      [
        S.hexagonal ? "Intercepts on a₁ / a₂ / c (Å)" : "Intercepts (Å)",
        s.hkl
          .map((component, axis) =>
            component ? fmt((s.a * axisLengths[axis] * level) / component) : "∞",
          )
          .join(" / "),
      ],
      ["Unit normal", fmtVec(plane.normal)],
      [S.hexagonal ? "Geometric d = 1/|G|" : "Geometric d = a/|hkl|", `${fmt(plane.d)} Å`],
      ...(fcc
        ? [
            ["g = gcd(k+l, h+l, h+k)", plane.g],
            ["Occupied c levels", `j × ${fmt(plane.step)}; j ∈ ℤ`],
            ["Adjacent layer gap", `${fmt(plane.gap)} Å`],
          ]
        : [
            [
              "Occupied c levels",
              plane.layersPerStep === 1
                ? `j × ${fmt(plane.step)}; j ∈ ℤ`
                : `${plane.offsets.map((offset) => fmt(offset)).join(", ")} + j × ${fmt(plane.step)}; j ∈ ℤ`,
            ],
            [
              "Adjacent layer gap",
              plane.evenlySpaced
                ? `${fmt(plane.gap)} Å`
                : `${plane.gaps.map((gap) => fmt(gap)).join(" / ")} Å, alternating`,
            ],
          ]),
      ["Pure normal repeat", `${fmt(plane.period)} Å`],
    ]) +
    note(
      "Origin planes have zero intercepts on nonparallel axes; reciprocal-intercept form is useful only when c ≠ 0. An axis lying wholly within a plane is not a unique intercept.",
    );
  html +=
    `<h3>Exact 2D primitive surface cell</h3><div class="equation">q = (${fmtVec(surface.q)})<br>q·m = 0<br>m₁ = (${fmtVec(surface.m1)})<br>m₂ = (${fmtVec(surface.m2)})<br>tᵢ = mᵢ₁p₁ + mᵢ₂p₂ + mᵢ₃p₃</div>` +
    valueList([
      ["t₁ / a", fmtVec(surface.t1)],
      ["t₂ / a", fmtVec(surface.t2)],
      ["Lengths", `${surface.lengths.map((length) => fmt(length)).join(" / ")} Å`],
      ["Included angle", `${fmt(surface.angle, 3)}°`],
      ["|t₁ × t₂|", `${fmt(surface.area)} Å²`],
      [`Density = ${fcc ? 1 : surface.atomsPerCell} / area`, `${fmt(surface.density, 6)} Å⁻²`],
      [fcc ? "Area × layer gap" : "Area × lattice-layer step", `${fmt(surface.identity)} Å³`],
      [
        fcc ? "a³ / 4" : `Primitive volume ${S.primitiveVolumeText}`,
        `${fmt(metrics.primitiveVolume)} Å³`,
      ],
      ["Shortest in-plane shell", `${surface.coordination} neighbors`],
    ]) +
    note(
      "A primitive integer kernel is obtained using Bézout identities, then Gauss-reduced by lattice-preserving integer operations. The area identity certifies it is primitive; a bounded shortest-vector guess would not.",
    );

  if (s.topic === "surface" || s.workspace === "animation") {
    const layers = planeLayers(s);
    const uniform = layers.layersPerStep === 1;
    const layer = currentLayer();
    const cell = cellAround(layers, layer);
    const cut = classifyCut(layers, cell.slices.find((slice) => slice.layer === layer).polygon);
    const cellName = S.hexagonal ? "Prism" : "Cube";
    const shiftLengths = [...new Set(layers.shifts.map((shift) => fmt(norm(shift) * s.a)))];
    html +=
      `<h3>Layers of ${S.short} (${layers.label})</h3><div class="equation">${
        S.hexagonal
          ? `s = ${layers.hkl.map((value, axis) => `${value}f${"₁₂₃"[axis]}`).join(" + ")}  (fractions of a₁, a₂, c)`
          : `s = ${layers.hkl.map((value, axis) => `${value}${"XYZ"[axis]}`).join(" + ")}`
      }<br>${uniform ? `layer j: s = j × ${fmt(layers.step)}` : `layers at s = ${layers.offsets.map((offset) => fmt(offset)).join(", ")} (+ multiples of ${fmt(layers.step)})`}<br>${S.hexagonal ? "d = Δs/|G|, G = h b₁ + k b₂ + l b₃" : "d = Δs·a/|hkl|"}</div>` +
      valueList([
        ["Reduced indices", `(${fmtVec(layers.hkl)})${S.hexagonal ? ` = (${layers.label})` : ""}`],
        ["Layer step Δs", fmt(layers.step)],
        ["Layer spacing d", spacingText(layers, s.a)],
        ["Net", netText(layers)],
        [
          "Interlayer shift",
          uniform
            ? `${fmt(norm(layers.shift) * s.a)} Å · (${layers.shiftFractions.map((value) => fmt(value)).join(", ")}) in t₁, t₂`
            : `${shiftLengths.join(" / ")} Å, ${shiftLengths.length > 1 ? "alternating" : "direction alternating"}`,
        ],
        ["Stacking period N", layers.period],
        [
          layers.evenlySpaced
            ? "N·d (shortest lattice vector ∥ n)"
            : "N layers span (shortest lattice vector ∥ n)",
          `${fmt(layers.repeat * s.a)} Å`,
        ],
        [
          "Centered cell",
          layers.centered
            ? `${fmt(norm(layers.centered.u) * s.a)} × ${fmt(norm(layers.centered.v) * s.a)} Å, 2 atoms`
            : "none (net is primitive " + layers.type.replace("-", " ") + ")",
        ],
        [
          `${cellName} cut of layer ${layer}`,
          `${cut.shape}${cut.isCell ? `, a cell with ${cut.atoms} atoms` : ", not a cell"}`,
        ],
        [
          `Layers in one ${cellName.toLowerCase()}`,
          `${cell.layers.length} · balls ${cell.slices.map((slice) => slice.count).join(", ")}`,
        ],
      ]);
  }

  const shownVector = scale(directionVector(S, s.uvw), s.scale);
  html +=
    `<h3>Direction [${directionName(s.uvw)}]</h3>` +
    valueList([
      ["a[uvw] length", `${fmt(direction.length)} Å`],
      ["Shown multiplier", `${fmt(s.scale)} a`],
      ["Shown vector length", `${fmt(direction.length * s.scale)} Å`],
      [
        `Shown vector is ${S.short} translation?`,
        (fcc ? isTranslation(S, scale(s.uvw, s.scale)) : isTranslation(S, shownVector))
          ? "Yes"
          : "No",
      ],
      ["Unit vector", fmtVec(direction.unit)],
      ["Angles to x / y / z", direction.angles.map((angle) => `${fmt(angle, 2)}°`).join(" / ")],
      ...(fcc
        ? [
            [
              "a/2[uvw] valid?",
              `${direction.halfValid ? "Yes" : "No"} · u+v+w=${s.uvw.reduce((sum, value) => sum + value)}`,
            ],
            ["Shortest FCC translation / a", fmtVec(direction.translation)],
          ]
        : [[`Shortest ${S.short} translation (indices)`, fmtVec(direction.translation)]]),
      ["Shortest repeat", `${fmt(direction.period)} Å`],
      ["Occupied-row linear density", `${fmt(direction.density, 5)} Å⁻¹`],
    ]) +
    `<h3>Zone law & angles</h3><div class="equation">h·u + k·v + l·w = ${s.hkl.map((value, axis) => `(${value})(${s.uvw[axis]})`).join(" + ")} = ${dot(s.hkl, s.uvw)}<br>${dot(s.hkl, s.uvw) === 0 ? "Direction lies parallel to the plane." : "Direction is not parallel to the plane."}</div>` +
    valueList(
      fcc
        ? [
            ["Two directions (directed)", `${fmt(angleBetween(s.uvw, s.uvw2), 3)}°`],
            ["Two planes (acute)", `${fmt(angleBetween(s.hkl, s.hkl2, true), 3)}°`],
            ["Direction to plane (acute)", `${fmt(90 - angleBetween(s.hkl, s.uvw, true), 3)}°`],
          ]
        : [
            [
              "Two directions (directed)",
              `${fmt(angleBetween(directionVector(S, s.uvw), directionVector(S, s.uvw2)), 3)}°`,
            ],
            [
              "Two planes (acute)",
              `${fmt(angleBetween(planeNormal(S, s.hkl), planeNormal(S, s.hkl2), true), 3)}°`,
            ],
            [
              "Direction to plane (acute)",
              `${fmt(90 - angleBetween(planeNormal(S, s.hkl), directionVector(S, s.uvw), true), 3)}°`,
            ],
          ],
    );

  if (s.topic === "environment") {
    html += `<h3>Current neighbor inclusion</h3>${valueList([
      ["Included through shell", s.shell],
      ["Cutoff", `${fmt(s.cutoff * s.a)} Å`],
      ["Neighbors included", neighbors.length],
      ...(fcc
        ? [
            ["Octahedral sites per PBC cell", "4 · host coordination 6"],
            ["Tetrahedral sites per PBC cell", "8 · host coordination 4"],
            ["Octahedral r/R", fmt(Math.SQRT2 - 1)],
            ["Tetrahedral r/R", fmt(Math.sqrt(1.5) - 1)],
          ]
        : S.holes.flatMap((hole) => [
            [
              `${hole.name} sites per PBC cell`,
              `${hole.sites.length} · host coordination ${hole.coordination}`,
            ],
            [`${hole.name} r/R = ${hole.ratioText}`, fmt(hole.ratio)],
          ])),
    ])}<table><thead><tr><th>Vector / a</th><th>Shell</th><th>Distance Å</th></tr></thead><tbody>${neighbors.map((neighbor) => `<tr><td>${fmtVec(neighbor.v)}</td><td>${neighbor.shell}</td><td>${fmt(neighbor.distance * s.a)}</td></tr>`).join("")}</tbody></table>`;
  }

  if (s.topic === "surface") {
    const surfaceStart = html.indexOf("<h3>Exact 2D primitive surface cell</h3>");
    const surfaceEnd = html.indexOf("<h3>Direction [", surfaceStart);
    const bulkStart = html.indexOf(`<h3>Bulk ${S.short} geometry</h3>`);

    if (surfaceStart >= 0 && surfaceEnd > surfaceStart && bulkStart >= 0) {
      const surfaceBlock = html.slice(surfaceStart, surfaceEnd);
      html = html.slice(0, surfaceStart) + html.slice(surfaceEnd);
      html = html.slice(0, bulkStart) + surfaceBlock + html.slice(bulkStart);
    }
  }

  return html;
}

/** Verify tab: live invariant checks. */
function renderVerify() {
  const checks = runChecks(state.a, state.hkl, state.load, state.structure);
  return `<div class="eyebrow">CHECK THE CONSTRUCTION</div><h2>Evidence, alongside the image.</h2><div class="pass-summary">${checks.filter((check) => check.pass).length} / ${checks.length} checks pass</div>${note(`${state.structure === "fcc" ? "" : `${structure().short}. `}Current surface (${planeName(state.hkl)}), a = ${fmt(state.a)} Å. These invariants check the mathematical engine; the source bundle adds exhaustive index, mesh and browser tests.`)}${checks.map((check) => `<div class="check-result"><b>${check.pass ? "✓" : "✕"}</b> ${check.name}<small>${fmt(check.actual, 7)} · expected ${fmt(check.expected, 7)}</small></div>`).join("")}`;
}

/** Layers tab: on/off switches, colors and opacities of every drawing group. */
function renderLayers() {
  const S = structure();
  const layers = [
    ["Host atoms", "atoms", "color", "opacity"],
    ["Axes", "axes"],
    ["Origin label", "origin"],
    ["3D primitive cell", "primitive", "surfaceColor"],
    ["Primitive vectors", "primitiveVectors"],
    ["Wigner–Seitz cell", "ws", "surfaceColor"],
    [
      S.hexagonal ? "Selected unit-cell box" : "Selected conventional box",
      "cellOn",
      "selectedColor",
    ],
    ["Primary planes", "plane", "planeColor", "planeOpacity"],
    ["Plane atom highlight", "highlight", "layerColor"],
    ["Plane labels", "planeLabels"],
    ["Plane normal", "normal", "planeColor"],
    ["Geometric d marker", "spacing"],
    ["Direction arrows", "direction", "dirColor"],
    ["Comparison plane", "plane2", "surfaceColor"],
    ["Comparison direction", "dir2", "selectedColor"],
    ["3D surface patch", "surface", "surfaceColor"],
    ["2D primitive surface cell", "surfaceCell", "surfaceColor"],
    ["Surface vectors", "surfaceVectors"],
    ["Surface tiling", "tiling"],
    [S.hexagonal ? "a₁, a₂, c surface mesh" : "Cubic surface mesh", "conventional"],
    ["2D neighbor bonds", "bonds2d"],
    ["Neighbor shell", "neighbors", "neighborColor"],
    ["Neighbor bonds", "bonds"],
    ["Coordination hull", "hull"],
    ["Hole host environment", "hosts"],
    ["Slip systems", "slip"],
    ["Partial-vector triangle", "partials"],
    ["Stack labels", "stackLabels"],
    ["Twin-plane marker", "twinPlane"],
    ["Reciprocal basis", "basisReciprocal"],
    ["Selected G", "selectedG"],
  ];
  return (
    '<div class="eyebrow">INDEPENDENT OVERLAYS</div><h2>Make room for one idea.</h2>' +
    note(
      "Layers apply to their named workspace. Nothing must stay on. Explicit learning presets reset overlays; ordinary controls preserve them.",
    ) +
    `<button data-action="all-off">Turn all drawing layers off</button>${layers.map(([label, key, colorKey, opacityKey]) => `<div class="layer">${checkField(label, key)}${colorKey ? `<input aria-label="${label} color" type="color" data-key="${colorKey}" value="${state[colorKey]}">` : ""}${opacityKey ? `<input aria-label="${label} opacity" type="range" data-key="${opacityKey}" min="${opacityKey === "opacity" ? 0.05 : 0.03}" max="${opacityKey === "opacity" ? 1 : 0.8}" step=".01" value="${state[opacityKey]}">` : ""}</div>`).join("")}` +
    selectField(S.hexagonal ? "Cell boundaries" : "Conventional boundaries", "bounds", [
      ["none", "None"],
      ["outer", "Outer box"],
      ["all", S.hexagonal ? "All unit cells" : "All conventional cells"],
    ]) +
    selectField("Interstitial markers", "holes", [
      ["none", "None"],
      ...S.holes.map((hole) => [hole.type, hole.name]),
      ["both", S.holes.length > 1 ? "Both" : "All"],
    ]) +
    checkField("Primitive isolation", "primitiveOnly") +
    checkField(`${S.hexagonal ? "(0001)" : "(111)"} registry coloring`, "registryColor")
  );
}

/** Statistics strip under the viewer. */
function renderStats() {
  const s = state;
  const S = structure();
  const fcc = S.key === "fcc";
  const metrics = metricsOf(S, s.a);
  const surface = surfaceOf(S, s.hkl, s.a);
  const stack = buildStack(s.stack, s.layers, s.stackRepeat, s.separation, s.registries);
  const reflection = reflectionOf(S, s.reflection, s.a, s.lambda);
  let stats;

  if (s.workspace === "animation") {
    const layers = planeLayers(s);
    const layer = currentLayer();
    const sequence = stackingLetters(layers, layer, Math.min(layers.period + 1, 7)).join("");
    stats = [
      [
        `${layers.structure.short} plane`,
        `(${layers.label})`,
        `${layers.type.replace("-", " ")} net · layer ${layer}`,
      ],
      layers.evenlySpaced
        ? [
            "Layer spacing d",
            fmt(layers.d * s.a),
            `Å · Δs = ${fmt(layers.step / layers.layersPerStep)}`,
          ]
        : [
            "Layer spacings",
            layers.gaps.map((gap) => fmt(gap * s.a, 3)).join(" / "),
            "Å · alternating",
          ],
      [
        "Stacking period",
        `N = ${layers.period}`,
        `${sequence}${layers.period + 1 > 7 ? "…" : ""} · N·d = ${fmt(layers.repeat * s.a, 3)} Å`,
      ],
      [
        "Primitive cell",
        layers.lengths.map((length) => fmt(length * s.a, 2)).join(" / "),
        `Å · ${fmt(layers.angle, 1)}°`,
      ],
    ];
  } else if (s.workspace === "surface") {
    stats = [
      [
        "Surface cell",
        `${fmt(surface.angle, 1)}°`,
        fcc || surface.atomsPerCell === 1
          ? "one lattice site per cell"
          : `${surface.atomsPerCell} atoms per cell`,
      ],
      [
        "Vector lengths",
        surface.lengths.map((length) => fmt(length, 2)).join(" / "),
        "Å · primitive translations",
      ],
      ["Surface area", fmt(surface.area, 3), "Å² · |t₁ × t₂|"],
      ["Planar density", fmt(surface.density, 4), "atoms / Å²"],
    ];
  } else if (s.workspace === "stacking") {
    stats = [
      [
        "Stack sequence",
        stack.sequence.slice(0, 6) + (s.layers > 6 ? "…" : ""),
        STACKINGS[s.stack].name,
      ],
      ["Ideal layer gap", fmt(stack.height * s.a), "Å · before exaggeration"],
      ["Layers shown", s.registries || "None", `${s.layers} constructed layers`],
      // The comparison stacks are built from close-packed layers in units of the FCC a.
      ["In-plane distance", fmt(s.a / Math.SQRT2), "Å · nearest contact"],
    ];
  } else if (s.workspace === "reciprocal") {
    stats = [
      [
        "Reflection",
        `(${planeName(s.reflection)})`,
        fcc
          ? reflection.allowed
            ? "allowed · F/f = 4"
            : "absent · F/f = 0"
          : reflection.allowed
            ? `allowed · |F/f| = ${fmt(reflection.factor, 3)}`
            : "absent · F/f = 0",
      ],
      ["Geometric d", fmt(reflection.d), "Å"],
      ["Wavevector |G|", fmt(reflection.magnitude), "Å⁻¹ · 2π convention"],
      [
        "Geometric 2θ",
        reflection.twoTheta === null ? "—" : `${fmt(reflection.twoTheta, 2)}°`,
        reflection.twoTheta === null
          ? "λ > 2d"
          : reflection.allowed
            ? "first-order Bragg angle"
            : "no ideal diffraction peak",
      ],
    ];
  } else {
    const prism = S.hexagonal && s.hexPrism;
    const cells = s.N.reduce((product, count) => product * count);
    stats = [
      prism
        ? [
            "Periodic atoms",
            formatCount(6 * s.N[2]),
            `hexagonal prism · ${s.N[2]} ${s.N[2] === 1 ? "story" : "stories"} of 3 unit cells`,
          ]
        : [
            "Periodic atoms",
            formatCount(S.unit.atoms * cells),
            `${s.N.join(" × ")} ${S.hexagonal ? "unit" : "conventional"} cell${s.N.every((count) => count === 1) ? "" : "s"}`,
          ],
      [
        "Base drawing",
        s.atoms ? formatCount(viewer?.count ?? sitesOf(S, s.N, s.mode === "unique").length) : "Off",
        s.primitiveOnly
          ? "primitive tiling sites"
          : prism
            ? "closed hexagonal prism"
            : {
                closed: "closed drawing · all boundary sites",
                ghost: "unique atoms + periodic ghosts",
                unique: "unique atoms only",
              }[s.mode],
      ],
      ["Nearest distance", fmt(metrics.nn), fcc ? "Å · a / √2" : `Å · ${S.formulas.nearest}`],
      ["Packing fraction", fmt(metrics.apf, 5), fcc ? "π / (3√2)" : S.formulas.apf],
    ];
  }

  $("#stats").innerHTML = stats
    .map(
      ([label, value, detail]) =>
        `<div class="stat"><small>${label}</small><strong>${value}</strong><span>${detail}</span></div>`,
    )
    .join("");
}

/** Selection inspector: coordinates in every basis and the distance to the previous pick. */
function renderInspector() {
  if (!selection) {
    $("#inspector").innerHTML =
      "<strong>Inspect a site.</strong> Click an atom, surface-net point, interstitial marker or reciprocal point. Select two in sequence to measure their direct distance.";
    return;
  }

  const s = state;
  const S = structure();
  const p = selection.p;
  const space = selection.space;
  const rows = [
    ["Site", escapeHtml(selection.id)],
    ["Space", space],
  ];

  if (space === "reciprocal") {
    rows.push(
      ["Indices", `(${planeName(selection.hkl ?? p)})`],
      ["G (Å⁻¹)", fmtVec(scale(p, (2 * Math.PI) / s.a))],
      [
        "Type",
        norm(p) === 0
          ? "Forward-scattering origin"
          : selection.allowed
            ? "Allowed reciprocal node"
            : "Forbidden comparison position",
      ],
    );
  } else if (space === "stacking") {
    rows.push(
      ["Displayed stack frame / a", fmtVec(p)],
      ["Displayed stack frame (Å)", fmtVec(scale(p, s.a))],
      ["Registry / layer", `${selection.registry} / ${selection.layer}`],
      ["Frame", "x ∥ [1 −1 0], y ∥ [1 1 −2], z ∥ [111]"],
    );
  } else {
    const f = fractionalOf(selection);
    const region = regionOf(S, s);
    const level = planeLevelOf(S, s.hkl, region.levelCells, s.location, s.c, s.layer);
    rows.push(
      [S.hexagonal ? "Unit-cell fractions" : "Conventional fractions", fmtVec(f)],
      ["Cartesian (Å)", fmtVec(scale(p, s.a))],
      ["Supercell fractions", fmtVec(f.map((value, axis) => value / s.N[axis]))],
      ["Periodic wrap / a", fmtVec(f.map((value, axis) => mod(value, s.N[axis])))],
      [
        "Owner cell (floor, clamped)",
        fmtVec(f.map((value, axis) => Math.max(0, Math.min(s.N[axis] - 1, Math.floor(value))))),
      ],
      ["On selected primary plane?", Math.abs(dot(f, s.hkl) - level) < 1e-7 ? "Yes" : "No"],
    );

    if (selection.type) {
      rows.push(
        ["Hole type", selection.type],
        ["Host coordination", selection.coordination],
        ["Maximum r/R", fmt(selection.ratio)],
      );
    } else {
      rows.push(["Bulk host coordination", S.coordination]);
    }

    if (selection.weight !== undefined) {
      rows.push(
        ["Boundary weight", fmt(selection.weight)],
        ["Outer-face periodic image?", selection.ghost ? "Yes" : "No"],
      );
    }

    if (selection.shell) {
      rows.push(["Neighbor shell", selection.shell]);
    }
  }

  if (previousSelection?.space === space) {
    rows.push([
      "Distance to previous (direct)",
      `${fmt(norm(subtract(p, previousSelection.p)) * (space === "reciprocal" ? (2 * Math.PI) / s.a : s.a))} ${space === "reciprocal" ? "Å⁻¹" : "Å"}`,
    ]);
  }

  $("#inspector").innerHTML =
    `<div class="mini-grid">${rows.map(([label, value]) => `<div>${label}: <strong>${value}</strong></div>`).join("")}</div>`;
}

/** Legend of what is currently drawn. */
function renderLegend() {
  const s = state;
  const S = structure();
  const items = [];

  if (s.workspace === "animation") {
    // Only what the current step shows.
    const layers = planeLayers(s);
    const info = viewer?.cellNet?.info();
    const on = new Set(info?.visible ?? []);
    const letters = (info?.letters ?? []).sort(([x], [y]) => x.localeCompare(y));

    if (letters.length) {
      for (const [letter, color] of letters.slice(0, 4)) items.push([color, `Layer ${letter}`]);
      if (letters.length > 4) items.push(["#9fb3bf", `… ${letters.length} registries`]);
    } else {
      items.push(
        on.has("color")
          ? ["linear-gradient(90deg,#3f8fc4,#e08a3c,#8e6bc9,#4aa37c)", "Balls colored by layer (s)"]
          : [s.color, S.key === "fcc" ? `${s.element} atoms` : `${S.short} atoms`],
      );
    }

    if (on.has("plane")) items.push([s.planeColor, `(${layers.label}) plane`]);
    if (on.has("cut")) items.push(["#e4572e", `Cut by the ${S.cellName} walls`]);
    if (on.has("conv") || (on.has("morphCell") && !on.has("morph") && layers.centered)) {
      items.push(["#5185a0", "Centered cell"]);
    }
    if (on.has("prim") || (on.has("morphCell") && on.has("morph")) || on.has("rhombo")) {
      items.push([s.surfaceColor, "Primitive cell"]);
    }
    if (on.has("shift")) items.push([s.dirColor, "Interlayer shift"]);
    if (on.has("dmark")) items.push(["#63879d", "Layer spacing d"]);
    if (on.has("avec")) items.push(["#36ad9c", S.vectorLabels.join(", ")]);
    if (on.has("diag")) items.push(["#d35f73", "[111] long diagonal"]);
    if (on.has("cube")) {
      items.push(["#6c8b9e", S.hexagonal ? "Hexagonal prism" : "Conventional cube"]);
    }
    if (on.has("grid")) items.push(["#9fb3bf", "Cells of the 3D array"]);
  } else if (s.workspace === "stacking") {
    if (s.atoms) {
      for (const registry of s.registries) {
        items.push([s["color" + registry], registry + " registry"]);
      }
    }
    if (s.stack === "twin" && s.twinPlane) {
      items.push([s.surfaceColor, "Coherent twin plane"]);
    }
  } else if (s.workspace === "reciprocal") {
    if (s.atoms) {
      items.push(["#8061b6", "Allowed reciprocal nodes"]);
    }

    if (s.atoms && s.forbidden) {
      items.push(["#c6a694", "Forbidden grid markers"]);
    }

    if (s.selectedG) {
      items.push([s.selectedColor, "Selected G"]);
    }

    if (s.basisReciprocal) {
      items.push(["#36ad9c", "Primitive reciprocal basis b₁,b₂,b₃"]);
    }
  } else {
    if (s.atoms) {
      items.push([s.color, s.element + " host sites"]);
    }

    if (selection) {
      items.push([s.selectedColor, "Selected site"]);
    }

    if (s.workspace === "surface") {
      if (s.surfaceCell || s.surfaceVectors) {
        items.push([s.surfaceColor, "2D primitive cell / t₁,t₂"]);
      }

      if (s.conventional) {
        items.push([
          "#5185a0",
          S.hexagonal ? "Integer a₁, a₂, c translation mesh" : "Integer cubic-translation mesh",
        ]);
      }

      if (s.bonds2d) {
        items.push(["#aec3ce", "In-plane nearest-neighbor bonds"]);
      }
    } else {
      if (s.mode === "ghost" && s.atoms && !(S.hexagonal && s.hexPrism)) {
        items.push(["#b5cbd5", "Periodic boundary images"]);
      }

      if (s.registryColor && s.atoms) {
        for (const registry of S.hexagonal ? "AB" : "ABC") {
          items.push([
            s["color" + registry],
            `${S.hexagonal ? "(0001)" : "(111)"} ${registry} registry`,
          ]);
        }
      }

      // Only list planes that were actually drawn (a plane can miss the box).
      const drawn = viewer?.drawn ?? { highlighted: true, planes: 1, comparison: true };
      const region = regionOf(S, s);

      if (s.plane && drawn.planes) {
        items.push([
          s.planeColor,
          s.planeSet === "symmetry"
            ? "Symmetry family · multiple colors"
            : s.planeSet === "one"
              ? `(${planeName(s.hkl)}) · c=${fmt(planeLevelOf(S, s.hkl, region.levelCells, s.location, s.c, s.layer))}`
              : `${drawn.planes} parallel (${planeName(s.hkl)}) planes`,
        ]);
      }

      if (drawn.highlighted) {
        items.push([s.layerColor, "Atoms on primary plane"]);
      }

      if (s.plane2 && drawn.comparison) {
        items.push([s.surfaceColor, "Comparison plane"]);
      }

      if (s.direction) {
        items.push([s.dirColor, `${fmt(s.scale)}a [${directionName(s.uvw)}]`]);
      }

      if (s.dir2) {
        items.push([s.selectedColor, "Comparison direction"]);
      }

      if (s.primitive || s.primitiveOnly) {
        items.push([s.surfaceColor, "3D primitive cell"]);
      }

      if (s.ws) {
        items.push([s.surfaceColor, "Wigner–Seitz cell"]);
      }

      if (s.surface) {
        items.push([s.surfaceColor, "Selected atomic-layer patch"]);
      }

      if (s.neighbors) {
        items.push([s.neighborColor, "Bulk neighbor shell"]);
      }

      const holeTypes = S.holes
        .map((hole) => hole.type)
        .filter((type) => s.holes === "both" || s.holes === type);

      if (holeTypes.includes("cubic")) {
        items.push(["#5e9fce", "Cubic empty sites"]);
      }

      if (holeTypes.includes("octa")) {
        items.push(["#cc7aae", "Octahedral empty sites"]);
      }

      if (holeTypes.includes("tetra")) {
        items.push(["#c6a139", "Tetrahedral empty sites"]);
      }

      if (s.slip) {
        items.push(
          [
            s.planeColor,
            S.hexagonal ? "⟨a⟩ slip plane" : `${S.slip.name.split("⟨")[0]} slip plane`,
          ],
          [s.dirColor, "Perfect Burgers vector"],
        );
      }

      if (s.partials && partialsOf(S)) {
        items.push(
          ["#da8c48", "First Shockley partial"],
          ["#9665c2", "Second Shockley partial"],
          ["#2c998d", "Perfect-vector sum"],
        );
      }
    }
  }

  $("#legend").innerHTML = items
    .map(
      ([color, label]) =>
        `<div><i class="swatch" style="background:${color}"></i>${escapeHtml(label)}</div>`,
    )
    .join("");
}

/** Redraw the active view and every panel from `state`. */
function render({ fit = false, controls = true, panel = true } = {}) {
  const s = state;
  const isSurface = s.workspace === "surface";
  $(".stage").classList.toggle("surface-stage", isSurface);
  $("#viewer").hidden = isSurface;
  $("#surface").hidden = !isSurface;
  $("#view-error").hidden = isSurface || !!viewer;

  // Leaving the Cell ⇄ Net workspace cancels its timers and frames.
  if (s.workspace !== "animation") {
    viewer?.disposeAnimation();
  }

  if (isSurface) {
    surfaceView.draw(s, selection);
  } else {
    viewer?.draw(s, selection, fit);
  }

  const S = structure();
  const view = { surface: "SINGLE-LAYER NET", animation: "CELL ⇄ NET ANIMATION" }[s.workspace];
  $("#eyebrow").textContent =
    `${S.short} · ${TOPICS.find((topic) => topic[0] === s.topic)[1].toUpperCase()} / ${view ?? s.workspace.toUpperCase() + " VIEW"}`;
  // Look-along buttons and the export note follow the structure ([u v t w] labels for HCP).
  const looks = S.hexagonal
    ? STRUCTURES.hcp.looks
    : ["1 0 0", "0 1 0", "0 0 1", "1 1 0", "1 0 1", "0 1 1", "1 1 1"].map((value) => [
        value,
        `[${value.replaceAll(" ", "")}]`,
      ]);
  $$("[data-look]").forEach((button, index) => {
    [button.dataset.look, button.textContent] = looks[index];
  });
  $("#exports small").textContent =
    `Ideal bulk ${S.short} ${S.hexagonal ? "unit-cell " : ""}supercell`;
  $("#question").textContent = headerQuestion();
  $("#topics").innerHTML = TOPICS.map(
    ([key, title], index) =>
      `<button data-topic="${key}" class="${s.topic === key ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span>${title}</button>`,
  ).join("");
  $$("#workspaces button").forEach((button) =>
    button.classList.toggle("active", button.dataset.space === s.workspace),
  );
  $$("#tabs button").forEach((button) =>
    button.classList.toggle("active", button.dataset.tab === s.tab),
  );

  if (controls) {
    renderControls();
  }

  if (panel) {
    $("#content").innerHTML =
      s.tab === "learn"
        ? renderLearn()
        : s.tab === "calculate"
          ? renderCalculate()
          : s.tab === "verify"
            ? renderVerify()
            : renderLayers();
  }

  renderStats();
  renderInspector();
  renderLegend();
  const messages = isSurface ? [] : viewer?.messages || [];

  if (
    !isSurface &&
    s.workspace === "crystal" &&
    s.N.reduce((product, count) => product * count) > 400
  ) {
    messages.push("Large supercell: small spheres and fewer labels improve interaction.");
  }

  $("#message").hidden = !messages.length;
  $("#message").textContent = [...new Set(messages)].join(" ");
  $("#hint").textContent = isSurface
    ? "One atomic layer · Drag to pan · Scroll to zoom · Click a site"
    : s.workspace === "animation"
      ? "← / → step · Drag to rotate between steps · Scroll to zoom"
      : "Drag to rotate · Scroll to zoom · Right-drag to pan · Click a site";
  $("#player").hidden = s.workspace !== "animation";
  $("#inspector").hidden = s.workspace === "animation";

  if (s.workspace === "animation") {
    renderPlayer();
  }

  $("#sequence").hidden = s.workspace !== "stacking";
  $("#sequence").innerHTML = `<small>REGISTRY SEQUENCE</small>${STACKINGS[s.stack].sequence
    .slice(0, s.layers)
    .split("")
    .map(
      (registry, index) =>
        `<span title="Layer ${index}" style="background:${s["color" + registry]};opacity:${s.registries.includes(registry) ? 1 : 0.25}">${registry}</span>`,
    )
    .join("")}`;
  $("#lessons").innerHTML =
    s.lesson < 0
      ? ""
      : `Lesson ${s.lesson + 1} of ${LESSONS.length}<progress max="${LESSONS.length}" value="${s.lesson + 1}"></progress><strong>${LESSONS[s.lesson][1]}</strong><div class="row"><button data-lesson="${Math.max(0, s.lesson - 1)}">← Back</button><button data-lesson="${Math.min(LESSONS.length - 1, s.lesson + 1)}">${s.lesson === LESSONS.length - 1 ? "Revisit" : "Next →"}</button><button data-action="end-tour">Close</button></div>`;
}

/** Jump to a guided-tour lesson. */
function startLesson(index) {
  const [conceptKey, , presetKey] = LESSONS[index];
  applyPreset(presetKey, { lesson: true });
  concept = conceptKey;
  update({ lesson: index });
}

/** Settings, concept and both cameras, as saved by "Save view". */
function viewSnapshot() {
  return {
    format: "FCC Explorer",
    state: structuredClone(state),
    concept,
    camera: viewer?.cameraState(),
    surfaceCamera: { zoom: surfaceView.zoom, pan: surfaceView.pan },
  };
}

/** Restore a saved view after validating every field. */
function loadView(data) {
  const next = validateState(data.state ?? data);

  if (data.concept && !CONCEPTS[data.concept]) {
    throw new Error("Unknown saved concept.");
  }

  if (
    data.surfaceCamera &&
    (!Number.isFinite(data.surfaceCamera.zoom) ||
      data.surfaceCamera.zoom < 0.25 ||
      data.surfaceCamera.zoom > 8 ||
      !Array.isArray(data.surfaceCamera.pan) ||
      data.surfaceCamera.pan.length !== 2 ||
      !data.surfaceCamera.pan.every((value) => Number.isFinite(value) && Math.abs(value) < 1000000))
  ) {
    throw new Error("Invalid surface camera.");
  }

  if (data.camera) {
    for (const key of ["position", "target", "up"]) {
      if (
        !Array.isArray(data.camera[key]) ||
        data.camera[key].length !== 3 ||
        !data.camera[key].every((value) => Number.isFinite(value) && Math.abs(value) < 10000)
      ) {
        throw new Error("Invalid camera coordinates.");
      }
    }
    if (
      !Number.isFinite(data.camera.zoom) ||
      data.camera.zoom <= 0 ||
      data.camera.zoom > 10000 ||
      !Number.isFinite(data.camera.span) ||
      data.camera.span <= 0.01 ||
      data.camera.span >= 10000
    ) {
      throw new Error("Invalid camera scale.");
    }
  }

  stopAnimation();
  state = next;
  concept = data.concept ?? TOPICS.find((topic) => topic[0] === state.topic)[2];
  selection = previousSelection = null;
  render({ fit: true });

  if (data.camera) {
    viewer?.restore(data.camera);
  }

  if (data.surfaceCamera) {
    surfaceView.zoom = data.surfaceCamera.zoom;
    surfaceView.pan = data.surfaceCamera.pan;

    if (state.workspace === "surface") {
      surfaceView.draw(state, null);
    }
  }

  return viewSnapshot();
}

/** Apply a changed control. `live` is true while a slider or color picker is being dragged. */
function applyInput(input, live = false) {
  try {
    if (input.dataset.axis !== undefined) {
      const cells = state.N.slice();
      cells[+input.dataset.axis] = Number(input.value);
      update({ N: cells }, { fit: true });
      return;
    }

    if (input.dataset.registry) {
      const registries = new Set(state.registries);

      if (input.checked) {
        registries.add(input.dataset.registry);
      } else {
        registries.delete(input.dataset.registry);
      }

      update({
        registries: "ABC"
          .split("")
          .filter((registry) => registries.has(registry))
          .join(""),
      });
      return;
    }

    const key = input.dataset.key;

    if (!key) {
      return;
    }

    let value =
      input.type === "checkbox"
        ? input.checked
        : ["number", "range"].includes(input.type) ||
            ["shell", "slipIndex", "animSpeed"].includes(key)
          ? Number(input.value)
          : input.value;

    if (["hkl", "uvw", "hkl2", "uvw2", "load", "reflection"].includes(key)) {
      // HCP planes may also be typed as (h k i l), and directions as [u v t w].
      const fourIndex = structure().hexagonal
        ? ["uvw", "uvw2", "load"].includes(key)
          ? fromBravaisDirection(value)
          : fromMillerBravais(value)
        : null;
      value = parseIndices(fourIndex || value);
    }

    if (key === "structure") {
      const patch = structureDefaults(value, state);
      update(patch, { fit: true });
      const notes = [];
      if (patch.element) {
        notes.push(
          `${STRUCTURES[value].short}: ${EXAMPLES[value].name}, a = ${EXAMPLES[value].a} Å (change it under Lattice parameter).`,
        );
      }
      if (patch.hkl) {
        notes.push(
          "HCP uses hexagonal axes a₁, a₂, c: the plane starts as the basal plane (0001).",
        );
      }
      if (notes.length) {
        toast(notes.join(" "));
      }
      return;
    }

    if (key === "cell") {
      value = parseTriple(value, 0, 9, true);
    }

    if (key === "arrowOrigin") {
      value = parseTriple(value);
    }

    if (key === "layer" && state.topic === "surface") {
      update({ layer: value, location: "layer" }, { controls: !live });
      return;
    }

    update({ [key]: value }, { controls: !live, panel: !live || !input.closest("#content") });
    $$(`[data-value="${key}"]`).forEach((element) => {
      if (element.tagName === "EM") {
        element.textContent = fmt(value);
      }
    });
    input.removeAttribute("aria-invalid");
  } catch (error) {
    input.setAttribute("aria-invalid", "true");
    toast(error.message, true);
  }
}

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-key],[data-axis],[data-registry]")) {
    applyInput(event.target);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-key][type=range],[data-key][type=color]")) {
    applyInput(event.target, true);
  }

  if (event.target.id === "anim-scrub") {
    viewer?.cellNet?.seek(Number(event.target.value));
  }
});

// ← / → step through the animation (not while typing in a field).
document.addEventListener("keydown", (event) => {
  const animation = viewer?.cellNet;

  if (
    state.workspace !== "animation" ||
    !animation ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.closest?.("input, select, textarea, [contenteditable]")
  ) {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    animation.next();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    animation.back();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    viewer?.cellNet?.pause();
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button,tr[data-slip]");
  if (button) {
    try {
      if (button.dataset.preset) {
        applyPreset(button.dataset.preset);
        return;
      }

      if (button.dataset.concept) {
        openConcept(button.dataset.concept, true);
        return;
      }

      if (button.dataset.animMode) {
        stopAnimation();
        concept = "cellnet";
        update({ workspace: "animation", topic: "surface", animMode: button.dataset.animMode });
        return;
      }

      if (button.dataset.anim) {
        const animation = viewer?.cellNet;

        if (button.dataset.anim === "surface") {
          concept = "surface";
          update({ workspace: "surface", topic: "surface" });
          surfaceView.fit();
        } else if (animation) {
          ({
            back: () => animation.back(),
            next: () => animation.next(),
            play: () => animation.toggle(),
            replay: () => animation.replay(),
          })[button.dataset.anim]?.();
        }
        return;
      }

      if (button.dataset.topic) {
        stopAnimation();
        const topic = TOPICS.find((entry) => entry[0] === button.dataset.topic);
        concept = topic[2];
        update({
          topic: topic[0],
          workspace: ["surface", "stacking", "reciprocal"].includes(topic[0])
            ? topic[0]
            : "crystal",
        });
        return;
      }

      if (button.dataset.space) {
        stopAnimation();
        const space = button.dataset.space;
        const patch = { workspace: space };

        if (["surface", "stacking", "reciprocal"].includes(space)) {
          patch.topic = space;
          concept = space;
        }

        if (space === "animation") {
          patch.topic = "surface";
          concept = "cellnet";
        }

        update(patch, { fit: true });

        if (space === "surface") {
          surfaceView.fit();
        }

        return;
      }

      if (button.dataset.tab) {
        update({ tab: button.dataset.tab }, { controls: false });
        return;
      }

      if (button.dataset.look) {
        if (state.workspace === "surface") {
          toast("The 2D view is already normal to its selected plane.");
        } else {
          viewer?.look(lookVector(parseIndices(button.dataset.look)));
        }
        return;
      }

      if (button.dataset.pick) {
        const key = button.dataset.pick;
        update({ [key]: parseIndices(button.dataset.value) });
        return;
      }

      if (button.dataset.slip !== undefined) {
        update({ slipIndex: +button.dataset.slip, slip: true, allSlip: false });
        return;
      }

      if (button.dataset.lesson !== undefined) {
        startLesson(+button.dataset.lesson);
        return;
      }

      if (button.dataset.export) {
        $("#exports").open = false;
        const format = button.dataset.export;

        if (format === "png") {
          const image =
            state.workspace === "surface"
              ? await surfaceView.png(state.pngScale)
              : viewer?.png(state.pngScale);

          if (!image) {
            throw new Error("3D export needs an available WebGL renderer.");
          }

          download(`${structure().short}-current-view.png`, image);
        } else if (format === "svg") {
          surfaceView.draw(state, selection);
          download(`${structure().short}-surface-net.svg`, surfaceView.svg, "image/svg+xml");
        } else if (format === "report") {
          download(
            `${structure().short}-calculation-report.md`,
            calculationReport(state),
            "text/markdown",
          );
        } else {
          download(
            format === "poscar" ? "POSCAR" : `${structure().short}-bulk.${format}`,
            structureFile(state, format),
            "text/plain",
          );
        }

        toast(
          format === "svg"
            ? "Exported the analytic surface net."
            : ["xyz", "cif", "poscar"].includes(format)
              ? "Exported unique atoms of the configured ideal bulk supercell."
              : "Export ready.",
        );
        return;
      }

      if (button.id === "fit") {
        if (state.workspace === "surface") {
          surfaceView.fit();
        } else {
          viewer?.fit();
        }
        return;
      }

      if (button.id === "look-normal") {
        viewer?.look(
          state.workspace === "stacking"
            ? [0, 0, 1]
            : state.workspace === "reciprocal"
              ? planeNormal(structure(), state.reflection)
              : planeNormal(structure(), state.hkl),
        );
        return;
      }

      if (button.id === "look-dir") {
        viewer?.look(directionVector(structure(), state.uvw));
        return;
      }

      if (button.id === "wide") {
        document.body.classList.toggle("wide");
        requestAnimationFrame(() => viewer?.resize());
        return;
      }

      if (button.id === "reset") {
        stopAnimation();
        state = structuredClone(DEFAULT_STATE);
        concept = "crystal";
        selection = previousSelection = null;
        surfaceView.fit();
        render({ fit: true });
        return;
      }

      if (button.id === "tour") {
        startLesson(0);
        return;
      }

      if (button.id === "save") {
        download("FCC-view.json", JSON.stringify(viewSnapshot(), null, 2), "application/json");
        toast("Saved settings and camera.");
        return;
      }

      if (button.id === "load") {
        $("#load-file").click();
        return;
      }

      switch (button.dataset.action) {
        case "custom-look":
          viewer?.look(lookVector(parseIndices($("#custom-look").value)));
          break;
        case "use-layer":
          update({ location: "layer", layer: currentLayer() });
          break;
        case "inspect-surface":
          update({ workspace: "crystal", surface: true }, { fit: true });
          break;
        case "stack-normal":
          viewer?.look([0, 0, 1]);
          break;
        case "stack-side":
          viewer?.look([0, -1, 0]);
          break;
        case "end-tour":
          update({ lesson: -1 });
          break;
        case "all-off": {
          // The HCP prism choice is a cell shape, not a drawing layer.
          const off = Object.fromEntries(
            Object.entries(DEFAULT_STATE)
              .filter(([key, value]) => typeof value === "boolean" && key !== "hexPrism")
              .map(([key]) => [key, false]),
          );
          update({ ...off, bounds: "none", holes: "none", labels: "none", registries: "" });
          break;
        }
        case "family-animation": {
          if (animationTimer) {
            stopAnimation();
            renderControls();
            break;
          }

          const family = familyOf(structure(), state.hkl);
          let step = 0;
          update({ plane: true, planeSet: "one" });
          animationTimer = setInterval(() => {
            update({ hkl: family[step++ % family.length] }, { controls: false });
          }, 1000);
          renderControls();
          break;
        }
        case "stack-animation": {
          if (animationTimer) {
            stopAnimation();
            renderControls();
            break;
          }

          update({ layers: 1 }, { fit: true });
          animationTimer = setInterval(() => {
            if (state.layers >= 12) {
              stopAnimation();
              renderControls();
              return;
            }
            update({ layers: state.layers + 1 }, { fit: true, controls: true });
          }, 1000);
          renderControls();
          break;
        }
      }
    } catch (error) {
      toast(error.message, true);
    }
  }
});

$("#load-file").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.size > 200000) {
      throw new Error("Configuration is too large (limit 200 kB).");
    }

    loadView(JSON.parse(await file.text()));
    toast("Loaded settings and camera.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    event.target.value = "";
  }
});

$("#search").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  const matches = Object.keys(CONCEPTS)
    .map((key) => [key, conceptFor(key, state.structure)])
    .filter(([key, info]) =>
      (key + " " + info.title + " " + info.question + " " + info.keywords)
        .toLowerCase()
        .includes(query),
    );
  $("#search-results").hidden = !query;
  $("#search-results").innerHTML = matches.length
    ? matches
        .map(([key, info]) => `<button data-concept="${key}">${info.question}</button>`)
        .join("")
    : note("No exact match. Try “surface”, “translation”, “packing” or “diffraction”.");
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) {
    $("#search-results").hidden = true;
  }
  if (event.target.closest("#search-results button")) {
    $("#search-results").hidden = true;
    $("#search").value = "";
  }
});

window.addEventListener("pagehide", stopAnimation);

window.FCC_EXPLORER = {
  getState: () => structuredClone(state),
  getSelection: () => (selection ? structuredClone(selection) : null),
  setState: update,
  preset: applyPreset,
  verify: () => runChecks(state.a, state.hkl, state.load, state.structure),
  viewer,
  surfaceViewer: surfaceView,
  structure: (format) => structureFile(state, format),
  report: () => calculationReport(state),
  exportConfig: viewSnapshot,
  loadConfig: loadView,
  animation: () => viewer?.cellNet?.info() ?? null,
};

render({ fit: true });
