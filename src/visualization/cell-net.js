/**
 * Cell ⇄ Net: step-by-step animations of how the cells, the 3D array and the atomic layers of a
 * crystal fit together, for simple cubic, BCC, FCC and HCP.
 *
 *   3D cell → 2D net       one conventional cell is cut into the layers of a plane family and
 *                          flattened into the 2D net;
 *   2D net → 3D cell       the net is stacked back into the crystal;
 *   Primitive cells        the smallest cells, in 2D and in 3D;
 *   Primitive → 3D → 2D    primitive cell → conventional cell → 3D array → layers → one 2D array;
 *   2D → 3D → primitive    the same path backwards.
 *
 * It runs inside the CrystalViewer (same renderer, camera, controls, lights and labels) but keeps
 * every object in its own group. Each step is a set of numbers (opacities, layer offsets along the
 * normal, morph and growth amounts) plus a camera view; the engine tweens between them.
 */

import {
  ArrowHelper,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import {
  cellArray,
  cellAround,
  cellCount,
  classifyCut,
  gapAbove,
  inCell,
  layerGeometry,
  layerHeight,
  layerPoints,
  layerS,
  nearestLayerPoint,
  planeCoords,
  planeLabel,
  primitiveCell,
  projectedSpots,
  registryLetter,
  shiftAbove,
  stackingIndices,
  stackPlan,
} from "../crystal/layers.js";
import { add, dot, formatNumber, norm, normalize, scale, subtract } from "../crystal/math.js";
import { structureOf } from "../crystal/structures.js";
import { polygonGeometry } from "./geometry.js";

/** Animation modes, in the order shown in the player. */
export const ANIMATION_MODES = [
  ["deconstruct", "3D cell → 2D net"],
  ["build", "2D net → 3D cell"],
  ["primitive", "Primitive cells"],
  ["primToNet", "Primitive → 3D → 2D"],
  ["netToPrim", "2D → 3D → primitive"],
];

/** The two modes that walk primitive cell ⇄ conventional cell ⇄ 3D array ⇄ 2D layer. */
const JOURNEYS = ["primToNet", "netToPrim"];

const DURATION = 1100;
const OBLIQUE = normalize([1.15, -1.55, 1.15]);
// BCC atoms line up along the body diagonals, which OBLIQUE nearly follows; SC and BCC cells are
// seen from further off the diagonal.
const OBLIQUE_CUBIC = normalize([1, -1.9, 1]);
const LAYER_PALETTE = [
  "#3f8fc4",
  "#e08a3c",
  "#8e6bc9",
  "#4aa37c",
  "#d35f73",
  "#b79a2c",
  "#5b7fd6",
  "#c0763f",
  "#2f9e9a",
  "#a05fb5",
  "#7c9b3a",
  "#d06f9c",
  "#4c86a8",
];
const CUT_COLOR = "#e4572e";
const CENTERED_COLOR = "#5185a0";
const CELL_COLOR = "#6c8b9e";
const GRID_COLOR = "#9fb3bf";
const VECTOR_COLORS = ["#36ad9c", "#a081d1", "#db9151"];
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const f3 = (value) => formatNumber(value, 3).replace("-", "−");
const v3 = (p) => new Vector3(...p);
const pointKey = (p) => p.map((value) => Math.round(value * 1e5) + 0).join(",");

/** Fade every material of an object; hide it when fully transparent. */
function fade(object, alpha, base = 1, solid = false) {
  if (!object) return;
  object.visible = alpha > 0.002;
  object.traverse((child) => {
    if (!child.material) return;
    child.material.transparent = true;
    child.material.opacity = alpha * base;
    if (solid) child.material.depthWrite = alpha > 0.98;
  });
}

/** Camera orientation for a view direction (target → camera) and an up vector. */
function orientation(dir, up) {
  const z = v3(dir).normalize();
  const y = v3(up).sub(z.clone().multiplyScalar(v3(up).dot(z)));
  if (y.lengthSq() < 1e-10) y.set(0, 0, 1).sub(z.clone().multiplyScalar(z.z));
  y.normalize();
  const x = new Vector3().crossVectors(y, z);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

export class CellNetAnimation {
  constructor(viewer, state, layer) {
    this.viewer = viewer;
    this.state = state;
    this.mode = state.animMode;
    this.structure = structureOf(state.structure);
    this.oblique = ["sc", "bcc"].includes(this.structure.key) ? OBLIQUE_CUBIC : OBLIQUE;
    this.layer = layer;
    this.speed = state.animSpeed;
    this.a = state.a;
    this.g = layerGeometry(state.hkl, state.a, this.structure);
    this.cell = cellAround(this.g, layer);
    this.radius = state.radiusMode === "physical" ? this.structure.physicalRadius : state.radius;
    this.group = new Group();
    this.labels = [];
    this.channels = [];
    this.sphere = new SphereGeometry(
      1,
      state.quality,
      Math.max(8, Math.round(state.quality * 0.65)),
    );
    this.reducedMotion =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.listeners = new Set();
    this.position = 0;
    this.playing = false;
    this.frame = null;
    this.timer = null;
    viewer.scene.add(this.group);

    const { e1, e2, e3 } = this.g.frame;
    this.n = e3;
    this.e1 = e1;
    this.e2 = e2;
    // Foot of the cell center on the selected layer, and the layer point nearest to it.
    this.foot = subtract(
      this.cell.center,
      scale(this.n, (dot(this.g.G, this.cell.center) - layerS(this.g, layer)) / this.g.gNorm),
    );
    this.origin = nearestLayerPoint(this.g, layer, this.cell.center);
    this.netRadius = Math.min(6, Math.max(1.7, 3 * Math.max(...this.g.lengths)));
    // Stacking registry (A = 0, B = 1, …) of the layers, counted from the selected one.
    this.registries = stackingIndices(this.g, layer, Math.min(this.g.period, 5000));

    if (JOURNEYS.includes(this.mode)) {
      this.buildJourney();
    } else {
      this.build();
    }
    this.steps = this.makeSteps();
    this.applyAt(0, this.viewAt(0));
  }

  // ------------------------------------------------------------------ scene objects

  registryOf(j) {
    const N = this.g.period;
    const offset = (((j - this.layer) % N) + N) % N;
    return this.registries[offset] ?? offset;
  }

  letterOf(j) {
    return registryLetter(this.registryOf(j));
  }

  colorOf(j) {
    if (this.mode === "deconstruct") {
      return LAYER_PALETTE[this.cell.layers.indexOf(j) % LAYER_PALETTE.length] ?? LAYER_PALETTE[0];
    }
    const index = this.registryOf(j);
    return (
      [this.state.colorA, this.state.colorB, this.state.colorC][index] ??
      LAYER_PALETTE[(index + 3) % LAYER_PALETTE.length]
    );
  }

  spheres(points, color, parent) {
    if (!points.length) return null;
    const mesh = new InstancedMesh(
      this.sphere,
      new MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.08, transparent: true }),
      points.length,
    );
    const dummy = new Object3D();
    points.forEach((point, index) => {
      dummy.position.set(...point.p);
      dummy.scale.setScalar(this.radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.frustumCulled = false;
    mesh.userData.points = points;
    parent.add(mesh);
    return mesh;
  }

  polygon(points, color, parent, { fill = 0.25, dashed = false } = {}) {
    if (points.length < 3) return null;
    const holder = new Group();
    const mesh = new Mesh(
      polygonGeometry(points),
      new MeshStandardMaterial({
        color,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
      }),
    );
    mesh.userData.base = fill;
    const outline = new Line(
      new BufferGeometry().setFromPoints([...points, points[0]].map(v3)),
      dashed
        ? new LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.04, transparent: true })
        : new LineBasicMaterial({ color, transparent: true }),
    );
    if (dashed) outline.computeLineDistances();
    holder.add(mesh, outline);
    parent.add(holder);
    return holder;
  }

  line(points, color, parent) {
    const line = new Line(
      new BufferGeometry().setFromPoints(points.map(v3)),
      new LineBasicMaterial({ color, transparent: true }),
    );
    parent.add(line);
    return line;
  }

  /** Line segments from [from, to] pairs. */
  segments(pairs, color, parent) {
    const lines = new LineSegments(
      new BufferGeometry().setFromPoints(pairs.flat().map(v3)),
      new LineBasicMaterial({ color, transparent: true }),
    );
    parent.add(lines);
    return lines;
  }

  arrow(origin, vector, color, parent) {
    const length = norm(vector);
    if (length < 1e-9) return null;
    const arrow = new ArrowHelper(
      v3(normalize(vector)),
      v3(origin),
      length,
      color,
      Math.min(0.13, length * 0.25),
      Math.min(0.06, length * 0.12),
    );
    parent.add(arrow);
    return arrow;
  }

  label(text, position, color, parent, size = 0.17) {
    const sprite = this.viewer.makeLabel(text, color, size);
    sprite.position.copy(v3(position));
    parent.add(sprite);
    this.labels.push(sprite);
    return sprite;
  }

  /** Fade a polygon built by polygon(): the fill uses its own base opacity. */
  fadePolygon(holder, alpha) {
    if (!holder) return;
    holder.visible = alpha > 0.002;
    const [mesh, outline] = holder.children;
    mesh.material.opacity = alpha * mesh.userData.base;
    outline.material.opacity = alpha;
  }

  /** Edges of the conventional cell (cube or hexagonal prism). */
  cellEdges(color = CELL_COLOR) {
    const { vertices, edges } = this.cell;
    return this.segments(
      edges.map(([i, k]) => [vertices[i], vertices[k]]),
      color,
      this.group,
    );
  }

  /** The plane of the selected layer, as a translucent square sheet around the foot point. */
  planeSheet(half) {
    return this.polygon(
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => add(this.foot, add(scale(this.e1, x * half), scale(this.e2, y * half)))),
      this.state.planeColor,
      this.group,
      { fill: 0.22 },
    );
  }

  /** a₁, a₂, a₃ (a₁, a₂, c for HCP) from the cell origin. */
  primitiveVectors() {
    const group = new Group();
    const S = this.structure;
    VECTOR_COLORS.forEach((color, i) => {
      this.arrow(this.cell.origin, S.primitive[i], color, group);
      this.label(
        S.vectorLabels[i],
        add(add(this.cell.origin, scale(S.primitive[i], 0.62)), [0, 0, 0.1]),
        color,
        group,
        0.22,
      );
    });
    this.group.add(group);
    return group;
  }

  /** The primitive cell as a translucent solid; returns a setter for its opacity. */
  primitiveSolid(corners) {
    const geometry = new ConvexGeometry(corners.map(v3));
    const solid = new Group();
    const fill = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: this.state.surfaceColor,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    solid.add(
      fill,
      new LineSegments(
        new EdgesGeometry(geometry, 12),
        new LineBasicMaterial({ color: this.state.surfaceColor, transparent: true }),
      ),
    );
    this.group.add(solid);
    return (alpha) => {
      solid.visible = alpha > 0.002;
      fill.material.opacity = alpha * 0.22;
      solid.children[1].material.opacity = alpha;
    };
  }

  /** The primitive 2D cell t₁ × t₂ and its vectors on the selected layer. */
  netCell(o, corners) {
    const { g, state } = this;
    const prim = this.polygon(corners, state.surfaceColor, this.selectedHolder, { fill: 0.3 });
    // Vectors float just above the balls so their heads are not hidden inside them.
    const vectors = new Group();
    const top = add(o, scale(this.n, this.radius + 0.02));
    this.arrow(top, g.t1, state.surfaceColor, vectors);
    this.arrow(top, g.t2, "#b777a6", vectors);
    this.label(
      "t₁",
      add(add(top, scale(g.t1, 0.55)), scale(this.n, 0.12)),
      state.surfaceColor,
      vectors,
      0.22,
    );
    this.label(
      "t₂",
      add(add(top, scale(g.t2, 0.55)), scale(this.n, 0.12)),
      "#b777a6",
      vectors,
      0.22,
    );
    this.selectedHolder.add(vectors);
    return { prim, vectors };
  }

  build() {
    const { g, cell, state } = this;
    const lift = (p, h = 0.004) => add(p, scale(this.n, h));

    // Layers: Deconstruct/Primitive use the cell's balls plus the selected layer's net; Build uses
    // the stack plan.
    let points;
    if (this.mode === "build") {
      this.plan = stackPlan(g, this.layer);
      points = this.plan.points;
      this.layers = this.plan.layers;
    } else {
      const net = layerPoints(g, this.layer, cell.center, this.netRadius)
        .filter((point) => !inCell(cell, point.p))
        .map((point) => ({ ...point, inCell: false }));
      points = [...cell.balls.map((ball) => ({ ...ball, inCell: true })), ...net];
      this.layers = cell.layers;
    }

    const hostColor = new Color(state.color);
    for (const j of this.layers) {
      const holder = new Group();
      this.group.add(holder);
      const layerColor = new Color(this.colorOf(j));
      const inside = this.spheres(
        points.filter((p) => p.layer === j && p.inCell),
        layerColor,
        holder,
      );
      const outsidePoints = points.filter((p) => p.layer === j && !p.inCell);
      const outside = this.spheres(outsidePoints, layerColor, holder);
      const sliceData = cell.slices.find((slice) => slice.layer === j);
      const slice = sliceData
        ? this.polygon(sliceData.polygon, this.colorOf(j), holder, { fill: 0.3 })
        : null;
      const planar = outsidePoints.map((p) =>
        Math.hypot(...planeCoords(g, subtract(p.p, this.foot))),
      );
      let lastGrow = null;
      let letter = null;

      // Letter tags; for long periods or close layers only the two A layers that bracket one
      // repeat, so tags on closely spaced layers do not pile up.
      const tagged =
        (g.period <= 4 && Math.min(...g.gaps) > 0.33) ||
        j === this.layer ||
        j === this.layer + g.period;
      if (this.mode === "build" && this.plan.stack.includes(j) && tagged) {
        const side = add(
          add(this.foot, scale(this.n, layerHeight(g, j) - layerHeight(g, this.layer))),
          scale(this.e2, -(this.plan.radius + 0.3)),
        );
        letter = this.label(this.letterOf(j), side, this.colorOf(j), holder, 0.24);
      }

      this.channels.push((v) => {
        holder.position.copy(v3(scale(this.n, v[`off:${j}`] ?? 0)));
        const tint = hostColor.clone().lerp(layerColor, v.color);
        for (const mesh of [inside, outside]) mesh?.material.color.copy(tint);
        fade(inside, v[`in:${j}`] ?? 0, 1, true);
        fade(outside, (v[`out:${j}`] ?? 0) * (1 - 0.95 * v.focus), 1, true);
        this.fadePolygon(slice, v[`slice:${j}`] ?? 0);
        fade(letter, v.letters * Math.max(v[`in:${j}`] ?? 0, v[`out:${j}`] ?? 0));

        // The selected layer grows outward from the cell (Deconstruct).
        if (outside && j === this.layer && this.mode !== "build" && v.grow !== lastGrow) {
          lastGrow = v.grow;
          const reach = lerp(0.9, this.netRadius + 0.3, v.grow);
          const dummy = new Object3D();
          outsidePoints.forEach((point, index) => {
            const t = clamp01((reach - planar[index]) / 0.3 + 1);
            dummy.position.set(...point.p);
            dummy.scale.setScalar(this.radius * t);
            dummy.updateMatrix();
            outside.setMatrixAt(index, dummy.matrix);
          });
          outside.instanceMatrix.needsUpdate = true;
        }
      });
    }
    this.selectedHolder = this.group.children[this.layers.indexOf(this.layer)];

    const edges = this.cellEdges();

    // The selected plane, as a translucent sheet larger than the cell, and its cell cut.
    const sheet = this.planeSheet((1.15 * cell.radius) / (Math.sqrt(3) / 2));
    const cutPolygon = cell.slices.find((slice) => slice.layer === this.layer)?.polygon ?? [];
    const cut = this.polygon(
      cutPolygon.map((p) => lift(p, 0.006)),
      CUT_COLOR,
      this.selectedHolder,
      { fill: 0.18 },
    );

    // 2D cells on the selected layer.
    const o = lift(this.origin);
    const cellCorners = (u, v) => [o, add(o, u), add(add(o, u), v), add(o, v)];
    const primitiveCorners = cellCorners(g.t1, g.t2);
    const { prim, vectors } = this.netCell(o, primitiveCorners);
    const conv = g.centered
      ? this.polygon(cellCorners(g.centered.u, g.centered.v), CENTERED_COLOR, this.selectedHolder, {
          fill: 0.08,
          dashed: true,
        })
      : null;

    // Morphing cell (Primitive mode): centered cell → primitive cell.
    const from = g.centered ? cellCorners(g.centered.u, g.centered.v) : primitiveCorners;
    const morphFill = new BufferGeometry();
    morphFill.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
    morphFill.setIndex([0, 1, 2, 0, 2, 3]);
    const morphLine = new BufferGeometry();
    morphLine.setAttribute("position", new Float32BufferAttribute(new Float32Array(15), 3));
    const morph = new Group();
    morph.add(
      new Mesh(
        morphFill,
        new MeshBasicMaterial({
          color: state.surfaceColor,
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      ),
      new Line(morphLine, new LineBasicMaterial({ color: state.surfaceColor, transparent: true })),
    );
    const centeredColor = new Color(g.centered ? CENTERED_COLOR : state.surfaceColor);
    const primitiveColor = new Color(state.surfaceColor);
    this.selectedHolder.add(morph);
    let lastMorph = null;

    // Build mode: interlayer shift and spacing marker.
    const shiftGroup = new Group();
    const up = shiftAbove(g, this.layer);
    const gap = gapAbove(g, this.layer);
    if (norm(up) > 1e-9) {
      this.arrow(o, up, state.dirColor, shiftGroup);
      this.line([add(o, up), add(add(o, up), scale(this.n, gap))], state.dirColor, shiftGroup);
      this.label(
        "shift",
        add(add(o, scale(up, 0.5)), scale(this.n, 0.09)),
        state.dirColor,
        shiftGroup,
        0.15,
      );
    }
    this.selectedHolder.add(shiftGroup);
    const dGroup = new Group();
    const dBase = add(this.foot, scale(this.e2, (this.plan?.radius ?? 1) + 0.15));
    this.arrow(dBase, scale(this.n, gap), "#63879d", dGroup);
    this.label(
      `d = ${f3(gap * this.a)} Å`,
      add(dBase, add(scale(this.n, gap / 2), scale(this.e2, 0.35))),
      "#63879d",
      dGroup,
      0.15,
    );
    this.group.add(dGroup);

    // Primitive mode: a₁, a₂, a₃, the primitive cell, its atoms outside the conventional cell
    // (BCC) and the long diagonal (FCC).
    const aGroup = this.primitiveVectors();
    const primCell = primitiveCell(g, cell.origin);
    const setRhombo = this.primitiveSolid(primCell.corners);
    const extra = new Group();
    this.spheres(
      primCell.atoms.filter((atom) => !inCell(cell, atom.p)),
      state.color,
      extra,
    );
    this.group.add(extra);
    let diagonal = null;
    if (this.structure.key === "fcc") {
      diagonal = new Group();
      this.line([cell.origin, add(cell.origin, [1, 1, 1])], "#d35f73", diagonal);
      this.label("[111]", add(cell.origin, [1.06, 1.06, 1.1]), "#d35f73", diagonal);
      this.group.add(diagonal);
    }

    this.channels.push((v) => {
      fade(edges, v.cube);
      this.fadePolygon(sheet, v.plane);
      this.fadePolygon(cut, v.cut);
      this.fadePolygon(prim, v.prim);
      this.fadePolygon(conv, v.conv);
      fade(vectors, v.vec);
      fade(shiftGroup, v.shift);
      fade(dGroup, v.dmark);
      fade(aGroup, v.avec);
      setRhombo(v.rhombo);
      fade(extra, v.rhombo, 1, true);
      fade(diagonal, v.diag);
      morph.visible = v.morphCell > 0.002;
      morph.children[0].material.opacity = v.morphCell * 0.3;
      morph.children[1].material.opacity = v.morphCell;
      if (v.morph !== lastMorph) {
        lastMorph = v.morph;
        const corners = from.map((p, i) =>
          add(scale(p, 1 - v.morph), scale(primitiveCorners[i], v.morph)),
        );
        morphFill.attributes.position.array.set(corners.flat());
        morphFill.attributes.position.needsUpdate = true;
        morphLine.attributes.position.array.set([...corners, corners[0]].flat());
        morphLine.attributes.position.needsUpdate = true;
        const tint = centeredColor.clone().lerp(primitiveColor, v.morph);
        morph.children.forEach((child) => child.material.color.copy(tint));
      }
    });
  }

  /**
   * Scene of the two journey modes: the primitive cell, the conventional cell, the 3D array of
   * cells around it (split into layers that can be pulled apart along the normal) and the
   * selected layer grown into a 2D array beyond the block.
   */
  buildJourney() {
    const { g, cell, state } = this;
    const array = cellArray(g, cell);
    const prim = primitiveCell(g, cell.origin);
    const primKeys = new Set(prim.atoms.map((atom) => pointKey(atom.p)));
    // 0: primitive-cell atoms in the conventional cell, 1: the cell's other atoms, 2: the rest of
    // the array, 3: primitive-cell atoms outside the conventional cell (BCC).
    const atoms = array.atoms.map((atom) => ({
      ...atom,
      set: primKeys.has(pointKey(atom.p)) ? (atom.inCell ? 0 : 3) : atom.inCell ? 1 : 2,
    }));
    const planarOf = (point) => Math.hypot(...planeCoords(g, subtract(point.p, this.foot)));
    const onLayer = atoms.filter((atom) => atom.layer === this.layer);
    const inner = Math.max(0.5, ...onLayer.map(planarOf));
    const outer = Math.min(9, Math.max(inner + 0.6, 1.8 * this.netRadius));
    const net = layerPoints(g, this.layer, this.foot, outer).filter(
      (point) => !array.cells.some((c) => inCell(c, point.p)),
    );

    this.layers = [...new Set(atoms.map((atom) => atom.layer))].sort((x, y) => x - y);
    const selected = this.layers.indexOf(this.layer);
    const spread = Math.min(0.6, Math.max(0.25, 2.4 / this.layers.length));
    this.explode = new Map(this.layers.map((j, i) => [j, (i - selected) * spread]));
    this.journey = {
      array,
      prim,
      atoms: atoms.length,
      // Atom positions with the layers pulled apart, and the selected layer, for framing.
      apart: atoms.map((atom) => add(atom.p, scale(this.n, this.explode.get(atom.layer)))),
      selected: onLayer.map((atom) => atom.p),
    };

    const hostColor = new Color(state.color);
    for (const j of this.layers) {
      const holder = new Group();
      this.group.add(holder);
      const layerColor = new Color(this.colorOf(j));
      const sets = [0, 1, 2, 3].map((set) =>
        this.spheres(
          atoms.filter((atom) => atom.layer === j && atom.set === set),
          layerColor,
          holder,
        ),
      );
      const netPoints = j === this.layer ? net : [];
      const grown = this.spheres(netPoints, layerColor, holder);
      const planar = netPoints.map(planarOf);
      let lastGrow = null;

      this.channels.push((v) => {
        holder.position.copy(v3(scale(this.n, v[`off:${j}`] ?? 0)));
        const alpha = v[`lay:${j}`] ?? 0;
        const tint = hostColor.clone().lerp(layerColor, v.color);
        for (const mesh of [...sets, grown]) mesh?.material.color.copy(tint);
        fade(sets[0], v.pAtoms * alpha, 1, true);
        fade(sets[1], v.cAtoms * alpha, 1, true);
        fade(sets[2], v.bAtoms * alpha, 1, true);
        // Outside the conventional cell, primitive-cell atoms show with that cell or the array.
        fade(sets[3], Math.max(v.pAtoms * v.rhombo, v.bAtoms) * alpha, 1, true);
        fade(grown, v.nAtoms * alpha, 1, true);

        // The selected layer grows beyond the array into the 2D net.
        if (grown && v.grow !== lastGrow) {
          lastGrow = v.grow;
          const reach = lerp(inner, outer + 0.3, v.grow);
          const dummy = new Object3D();
          netPoints.forEach((point, index) => {
            const t = clamp01((reach - planar[index]) / 0.3 + 1);
            dummy.position.set(...point.p);
            dummy.scale.setScalar(this.radius * t);
            dummy.updateMatrix();
            grown.setMatrixAt(index, dummy.matrix);
          });
          grown.instanceMatrix.needsUpdate = true;
        }
      });
    }
    this.selectedHolder = this.group.children[selected];

    const edges = this.cellEdges("#4f6f82");
    const grid = this.segments(array.segments, GRID_COLOR, this.group);
    const sheet = this.planeSheet(0.8 * array.radius);
    const setRhombo = this.primitiveSolid(prim.corners);
    const aGroup = this.primitiveVectors();
    const o = add(this.origin, scale(this.n, 0.004));
    const { prim: prim2d, vectors } = this.netCell(o, [
      o,
      add(o, g.t1),
      add(add(o, g.t1), g.t2),
      add(o, g.t2),
    ]);

    this.channels.push((v) => {
      fade(edges, v.cube);
      fade(grid, v.grid, 0.6);
      this.fadePolygon(sheet, v.plane);
      setRhombo(v.rhombo);
      fade(aGroup, v.avec);
      this.fadePolygon(prim2d, v.prim);
      fade(vectors, v.vec);
    });
  }

  // ------------------------------------------------------------------ steps

  base() {
    const values = {
      cube: 0,
      plane: 0,
      cut: 0,
      grow: 0,
      conv: 0,
      prim: 0,
      vec: 0,
      morph: 0,
      morphCell: 0,
      shift: 0,
      dmark: 0,
      letters: 0,
      avec: 0,
      rhombo: 0,
      diag: 0,
      focus: 0,
      color: 0,
      grid: 0,
      pAtoms: 0,
      cAtoms: 0,
      bAtoms: 0,
      nAtoms: 0,
    };
    for (const j of this.layers)
      Object.assign(values, {
        [`in:${j}`]: 0,
        [`out:${j}`]: 0,
        [`off:${j}`]: 0,
        [`slice:${j}`]: 0,
        [`lay:${j}`]: 0,
      });
    return values;
  }

  view(target, dir, up, span) {
    return { target, quaternion: orientation(dir, up), span };
  }

  /** A view from `dir` (target → camera) framed to fit `points`, with `pad` added to the span. */
  fitView(points, dir, up, pad = 2 * this.radius + 0.7) {
    const quaternion = orientation(dir, up);
    const x = new Vector3(1, 0, 0).applyQuaternion(quaternion).toArray();
    const y = new Vector3(0, 1, 0).applyQuaternion(quaternion).toArray();
    const range = (axis) => {
      const values = points.map((p) => dot(p, axis));
      return [Math.min(...values), Math.max(...values)];
    };
    const [x0, x1] = range(x);
    const [y0, y1] = range(y);
    const center = scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
    const target = add(
      center,
      add(scale(x, (x0 + x1) / 2 - dot(center, x)), scale(y, (y0 + y1) / 2 - dot(center, y))),
    );
    // The stage is wider than tall; 1.5 keeps the width inside narrower windows too.
    return { target, quaternion, span: Math.max(y1 - y0, (x1 - x0) / 1.5) + pad };
  }

  makeSteps() {
    const { g, a, cell, layer } = this;
    const S = this.structure;
    const fcc = S.key === "fcc";
    const H = g.label;
    const inputLabel = planeLabel(g.input, S);
    const reducedNote = inputLabel === H ? "" : ` (${inputLabel} reduces to (${H}))`;
    const along = S.hexagonal ? "the plane normal" : `[${H}]`;
    const len = (x) => f3(x * a);
    const vol = (x) => f3(x * a ** 3);
    const typeName = g.type.replace("-", " ");
    const perCell = g.atomsPerCell === 1 ? "1 atom" : `${g.atomsPerCell} atoms`;
    // One shift repeats from layer to layer only when every layer is a lattice translate.
    const uniform = g.layersPerStep === 1;
    const spacing = g.evenlySpaced
      ? `d = ${len(g.d)} Å apart`
      : `alternately ${g.gaps.map(len).join(" and ")} Å apart`;
    const netView = (span) => this.view(this.foot, this.n, this.e2, span);
    const cellSpan = (2.5 * cell.radius) / (Math.sqrt(3) / 2);
    const cubeView = this.view(cell.center, this.oblique, [0, 0, 1], cellSpan);
    const cellText = `|t₁| = ${len(g.lengths[0])} Å, |t₂| = ${len(g.lengths[1])} Å, angle ${f3(g.angle)}°`;
    const cellName = S.cellName;
    const letters = (count) =>
      Array.from({ length: count }, (_, i) => this.letterOf(layer + i)).join("");
    const sequence = `${letters(Math.min(g.period + 1, 7))}${g.period + 1 > 7 ? "…" : ""}`;
    const primitiveNote = {
      sc: "For simple cubic it is the cube itself.",
      bcc: `|aᵢ| = (√3/2)a = ${len(Math.sqrt(3) / 2)} Å, 109.47° between each pair.`,
      fcc: `|aᵢ| = a/√2 = ${len(1 / Math.SQRT2)} Å, 60° between each pair.`,
      hcp: "HCP is a hexagonal lattice with 2 atoms per lattice point: A at the corners, B inside.",
    }[S.key];
    const steps = [];
    const step = (label, caption, values, view, flags = {}) =>
      steps.push({ label, caption, values, view, ...flags });

    if (this.mode === "deconstruct") {
      const all = (key, value, except = null) =>
        Object.fromEntries(
          this.layers.filter((j) => j !== except).map((j) => [`${key}:${j}`, value]),
        );
      const slice = cell.slices.find((s) => s.layer === layer);
      const cut = classifyCut(g, slice.polygon);
      const spots = projectedSpots(g, cell.balls);
      const sValues = cell.slices.map((s) => f3(layerS(g, s.layer))).join(", ");
      const counts = cell.slices.map((s) => s.count).join(", ");
      const s1 = { ...this.base(), cube: 1, ...all("in", 1) };
      step(
        `The ${cellName}`,
        S.hexagonal
          ? `One HCP hexagonal prism: ${S.ballsText} = ${S.ballsInCell} balls; a = ${f3(a)} Å, c = 1.633a = ${len(S.axes[2][2])} Å.`
          : `One conventional ${S.short} cube: ${S.ballsInCell === 8 ? "8 corner balls" : `${S.ballsText} = ${S.ballsInCell} balls`}, edge a = ${f3(a)} Å.`,
        s1,
        cubeView,
      );
      step(
        `Cut by (${H})`,
        `The (${H}) plane at layer ${layer} (s = ${f3(layerS(g, layer))}) cuts the ${cellName} in a ${cut.shape}.${reducedNote}`,
        { ...s1, plane: 1, cut: 1 },
        cubeView,
      );
      const s3 = { ...s1, color: 1, cut: 0.5, ...all("slice", 1) };
      step(
        "All layers",
        `(${H}) cuts the ${cellName} into ${cell.layers.length} layers, s = ${sValues}. Balls per layer: ${counts}. Neighboring layers are ${spacing}.`,
        s3,
        cubeView,
      );
      step(
        S.hexagonal ? "Look down the normal" : `Look along [${H}]`,
        `Looking along ${along} stacks every layer into one picture: ${spots} spots for ${S.ballsInCell} balls. Balls that overlap lie on different layers (picture B).`,
        { ...s3, cut: 0, ...all("slice", 0.45) },
        netView(2.3 * (cell.radius / (Math.sqrt(3) / 2))),
      );
      const s5 = {
        ...s1,
        color: 1,
        cube: 0.35,
        ...all("in", 0.06, layer),
        [`slice:${layer}`]: 0.6,
      };
      step(
        "One layer",
        `Keep only layer ${layer}: now every distance is true (picture A). Each atom has ${g.coordination} nearest neighbors in the layer, ${len(g.neighborDistance)} Å away.`,
        s5,
        netView(2.3 * (cell.radius / (Math.sqrt(3) / 2))),
      );
      const near = this.view(
        this.foot,
        normalize(add(this.n, scale(this.e2, -0.45))),
        this.e2,
        2.1 * this.netRadius,
      );
      const s6 = { ...this.base(), color: 1, grow: 1, [`in:${layer}`]: 1, [`out:${layer}`]: 1 };
      step(
        "Grow the net",
        `Repeat the layer beyond the ${cellName} walls: an infinite ${typeName} net${g.atomsPerCell > 1 ? ` with ${perCell} per cell` : ""}.`,
        s6,
        near,
      );
      const walls = `The ${cut.shape} cut by the ${cellName} walls`;
      step(
        "Cut vs. cell",
        !cut.isCell
          ? `${walls} is not a cell: copies of it moved by net translations cannot tile the plane.`
          : cut.atoms === g.atomsPerCell
            ? `${walls} is itself a primitive cell of this net: ${perCell}.`
            : `${walls} is a cell of this net, but it holds ${cut.atoms} atoms, so it is not the smallest cell.`,
        { ...s6, cut: 1 },
        near,
      );
      const s7 = { ...s6, prim: 1, vec: 1, conv: g.centered ? 1 : 0 };
      const centered = g.centered
        ? ` Centered cell (dashed): ${len(norm(g.centered.u))} × ${len(norm(g.centered.v))} Å, 2 atoms.`
        : "";
      step(
        "2D cells",
        `Primitive cell t₁, t₂: ${cellText}, area ${f3(g.area * a * a)} Å², ${perCell}; planar density ${f3(g.density / (a * a))} Å⁻².${centered}`,
        s7,
        near,
      );
      step(
        "Flatten to 2D",
        `This is the Surface net 2D view of layer ${layer}: same orientation, e₁ along t₁. Open it to measure, label and export.`,
        s7,
        netView(2.1 * this.netRadius),
        { handoff: true },
      );
    }

    if (this.mode === "build") {
      const { plan } = this;
      const enter = g.d * 4 + 0.6;
      const stackLayers = plan.stack;
      const waiting = Object.fromEntries(
        this.layers.filter((j) => j !== layer).map((j) => [`off:${j}`, enter]),
      );
      const show = (j) => ({ [`in:${j}`]: 1, [`out:${j}`]: 1, [`off:${j}`]: 0 });
      const stackHeight =
        layerHeight(g, stackLayers[stackLayers.length - 1]) - layerHeight(g, stackLayers[0]);
      const stackCenter = add(this.foot, scale(this.n, stackHeight / 2));
      // Seen from the −e₁ side, like the side view later on, so the A/B/C letters stay on the right.
      const tilt = this.view(
        stackCenter,
        normalize(add(add(scale(this.n, 0.6), scale(this.e1, -0.75)), scale(this.e2, 0.25))),
        this.n,
        Math.max(2.4 * plan.radius + 0.8, stackHeight * 1.8),
      );
      const gap = (j) => len(gapAbove(g, j));
      const shift = (j) => len(norm(shiftAbove(g, j)));
      let values = { ...this.base(), ...waiting, color: 1, ...show(layer), prim: 1, vec: 1 };
      step(
        "One layer",
        `Start from one layer of ${S.short} (${H}): a ${typeName} net with ${cellText}${g.atomsPerCell > 1 ? `, ${perCell} per cell` : ""}.${reducedNote}`,
        values,
        this.view(this.foot, this.n, this.e2, 2.4 * plan.radius),
      );
      const groups =
        stackLayers.length - 1 <= 5
          ? stackLayers.slice(1).map((j) => [j])
          : [...stackLayers.slice(1, 4).map((j) => [j]), stackLayers.slice(4)];
      groups.forEach((group, index) => {
        values = {
          ...values,
          ...Object.assign({}, ...group.map(show)),
          shift: 1,
          letters: 1,
          prim: 0.6,
          vec: 0.4,
        };
        const last = group[group.length - 1];
        const count = last - layer;
        const L = this.letterOf(last);
        const repeat = g.evenlySpaced
          ? `N·d = ${len(g.repeat)} Å, the shortest lattice vector along ${along}.`
          : `Together these ${g.period} layers span ${len(g.repeat)} Å, the shortest lattice vector along ${along}.`;
        let caption;
        if (g.period === 1) {
          caption = `Layer 2 sits d = ${len(g.d)} Å straight above layer A, with no in-plane shift: the stacking is AAA… (N = 1). ${repeat}`;
        } else if (count === g.period) {
          caption = `Layer ${count + 1} returns to A: the stacking repeats every N = ${g.period} layers (${letters(count + 1)}). ${repeat}`;
        } else if (index === 0) {
          caption = `Layer ${L} sits ${g.evenlySpaced ? "d = " : ""}${gap(layer)} Å higher and is shifted in-plane by ${shift(layer)} Å, so its atoms sit over the gaps of layer A.`;
        } else if (group.length > 1) {
          caption = `Layers ${group.map((j) => this.letterOf(j)).join(", ")} follow ${uniform ? "with the same shift" : "the same way"}: ${letters(count + 1)}…${g.period > 12 ? ` Showing the first 13 of the N = ${g.period}-layer repeat.` : ""}`;
        } else if (uniform) {
          caption = `Layer ${L} repeats the same shift: ${letters(count + 1)}.`;
        } else {
          caption = `Layer ${L} sits ${gap(last - 1)} Å above the previous one, shifted by ${shift(last - 1)} Å: ${letters(count + 1)}.`;
        }
        step(group.length > 1 ? "More layers" : `Layer ${L}`, caption, values, tilt);
      });
      step(
        "Side view",
        uniform
          ? `Seen from the side along e₁: layers are d = ${len(g.d)} Å apart, and each one is shifted by ${len(norm(g.shift))} Å along the layer.`
          : `Seen from the side along e₁: the layers are ${spacing}, and each one is shifted along the layer.`,
        { ...values, dmark: 1, prim: 0, vec: 0 },
        this.view(
          stackCenter,
          scale(this.e1, -1),
          this.n,
          Math.max(2.4 * plan.radius, stackHeight * 1.6),
        ),
      );
      const allLayers = Object.assign({}, ...this.layers.map(show));
      const inside = plan.points.filter((p) => p.inCell).length;
      const cubeValues = {
        ...values,
        ...allLayers,
        cube: 1,
        focus: 1,
        shift: 0,
        letters: 0,
        prim: 0,
        vec: 0,
      };
      step(
        S.hexagonal ? "Back to the prism" : "Back to the cube",
        S.hexagonal
          ? `Turn back to the hexagonal axes: exactly ${inside} balls of the stack fall inside one hexagonal prism (${S.ballsText}).`
          : `Turn back to the cube axes: exactly ${inside} balls of the stack fall inside one conventional cube (${S.ballsText}).`,
        cubeValues,
        cubeView,
      );
      step(
        "Explore",
        `The stacked layers are the ${S.short} crystal. Drag to explore.`,
        cubeValues,
        cubeView,
        { autoRotate: true },
      );
      this.ballsInCell = inside;
    }

    if (this.mode === "primitive") {
      const all = (key, value) =>
        Object.fromEntries(this.layers.map((j) => [`${key}:${j}`, value]));
      const net = { [`in:${layer}`]: 1, [`out:${layer}`]: 1, grow: 1, morphCell: 1 };
      const view2d = this.view(this.foot, this.n, this.e2, 2.1 * this.netRadius);
      const countText = (count, inside) =>
        [
          `${count.corner} corners × ¼`,
          count.edge && `${count.edge} edge atoms × ½`,
          count.inside && `${count.inside} ${inside}`,
        ]
          .filter(Boolean)
          .join(" + ") + ` = ${count.total} ${count.total === 1 ? "atom" : "atoms"}`;
      if (g.centered) {
        const count = cellCount(g, layer, this.origin, g.centered.u, g.centered.v);
        step(
          "Centered 2D cell",
          `Centered cell of the (${H}) net: ${len(norm(g.centered.u))} × ${len(norm(g.centered.v))} Å, area ${f3(2 * g.area * a * a)} Å², ${countText(count, "center")}.`,
          { ...this.base(), ...net, morph: 0 },
          view2d,
        );
        step(
          "Primitive 2D cell",
          `Morph to the primitive cell t₁ × t₂: the area halves to ${f3(g.area * a * a)} Å² and the cell holds 4 corners × ¼ = 1 atom.`,
          { ...this.base(), ...net, morph: 1, vec: 1 },
          view2d,
        );
      } else {
        const count = cellCount(g, layer, this.origin, g.t1, g.t2);
        step(
          "Primitive 2D cell",
          g.atomsPerCell > 1
            ? `The (${H}) layer is a ${typeName} net whose smallest cell t₁ × t₂ holds ${countText(count, "inside")}: the 2-atom basis of HCP shows up in this layer. ${cellText}, area ${f3(g.area * a * a)} Å².`
            : `The (${H}) net is ${typeName}: its smallest cell t₁ × t₂ is already primitive. ${cellText}, area ${f3(g.area * a * a)} Å², ${countText(count, "inside")}.`,
          { ...this.base(), ...net, morph: 1, vec: 1 },
          view2d,
        );
      }
      const cubeBase = { ...this.base(), ...all("in", 1), cube: 1 };
      step(
        `The ${cellName}`,
        `In 3D the conventional ${cellName} holds ${S.cellCountText} in ${S.cellVolumeText} = ${vol(S.cellVolume)} Å³.`,
        cubeBase,
        cubeView,
      );
      step(
        S.vectorLabels.join(", "),
        {
          sc: "From one corner, a₁ = a[100], a₂ = a[010] and a₃ = a[001] run along the cube edges.",
          bcc: "From one corner, a₁ = a/2[−111], a₂ = a/2[1−11] and a₃ = a/2[11−1] reach the body centers of three neighboring cubes.",
          fcc: "From one corner, a₁ = a/2[011], a₂ = a/2[101] and a₃ = a/2[110] reach three face centers.",
          hcp: `From the center of the bottom hexagon, a₁ and a₂ (length a, 120° apart) lie in the basal plane and c = ${len(S.axes[2][2])} Å points up the hexagonal axis.`,
        }[S.key],
        { ...cubeBase, avec: 1 },
        cubeView,
      );
      const rh = { ...cubeBase, ...all("in", 0.55), avec: 1, rhombo: 1 };
      step(
        "Primitive cell",
        {
          sc: `The cube itself is the primitive cell: |aᵢ| = a, 90° between each pair, volume a³ = ${vol(1)} Å³ with 8 corners × ⅛ = 1 atom.`,
          bcc: `The primitive rhombohedron: |aᵢ| = (√3/2)a = ${len(Math.sqrt(3) / 2)} Å, 109.47° between each pair, volume a³/2 = ${vol(0.5)} Å³: 1 atom instead of 2. Part of it sticks out of the cube: a primitive cell need not fit inside the conventional one.`,
          fcc: `The primitive rhombohedron: |aᵢ| = a/√2 = ${len(1 / Math.SQRT2)} Å, 60° between each pair, volume a³/4 = ${vol(0.25)} Å³: 1 atom instead of 4. Its corners are one cube corner, the six face centers and the opposite corner.`,
          hcp: `The primitive cell is the rhombic prism a₁, a₂, c: volume (√3/2)a²c = ${vol(S.primitiveVolume)} Å³ with 8 corners × ⅛ + 1 inside = 2 atoms. Three of them make the hexagonal prism.`,
        }[S.key],
        rh,
        cubeView,
        { autoRotate: !fcc },
      );
      if (fcc) {
        step(
          "Long diagonal",
          "Its long diagonal runs along [111], from one cube corner to the opposite corner (1, 1, 1).",
          { ...rh, diag: 1 },
          cubeView,
          { autoRotate: true },
        );
      }
    }

    if (JOURNEYS.includes(this.mode)) {
      const { array, prim } = this.journey;
      const lay = (value, keep = null) =>
        Object.fromEntries(this.layers.map((j) => [`lay:${j}`, j === keep ? 1 : value]));
      const apart = Object.fromEntries(this.layers.map((j) => [`off:${j}`, this.explode.get(j)]));
      const ratio = S.cellAtoms / S.primitiveAtoms;
      const arrayText =
        S.cell === "cube" ? "a 3 × 3 × 3 block of cubes" : "a honeycomb of 7 prisms in 3 stories";
      const up = [0, 0, 1];
      const primView = this.fitView(
        [...prim.corners, ...prim.atoms.map((atom) => atom.p)],
        this.oblique,
        up,
        0.8,
      );
      const conventionalView = this.fitView(cell.vertices, this.oblique, up, 0.8);
      const blockView = this.fitView(
        array.cells.flatMap((c) => c.vertices),
        this.oblique,
        up,
        0.6,
      );
      // Seen from the side along the lattice rows t₁, slightly from above: each layer is a row.
      const apartView = this.fitView(
        this.journey.apart,
        normalize(add(scale(this.e1, -1), scale(this.n, 0.1))),
        this.n,
      );
      const oneView = this.fitView(this.journey.selected, this.n, this.e2);
      const flatView = netView(2.1 * this.netRadius);

      const vPrim = { ...this.base(), ...lay(1), pAtoms: 1, rhombo: 1, avec: 1 };
      const vCell = { ...vPrim, cAtoms: 1, cube: 1, rhombo: 0.3, avec: 0.4 };
      const vArray = { ...vCell, bAtoms: 1, grid: 1, rhombo: 0, avec: 0 };
      const vSlice = { ...vArray, color: 1, plane: 1, grid: 0.35, cube: 0.5 };
      const vApart = { ...vSlice, ...apart, plane: 0, grid: 0, cube: 0 };
      const vOne = { ...vApart, ...lay(0.06, layer) };
      const vNet = { ...vOne, ...lay(0, layer), nAtoms: 1, grow: 1, prim: 1, vec: 1 };
      const primitiveText = `${S.vectorLabels.join(", ")} span the primitive cell, ${S.primitiveVolumeText} = ${vol(S.primitiveVolume)} Å³ with ${S.primitiveCountText}.`;
      const conventionalText =
        S.key === "sc"
          ? `For simple cubic the conventional cube is the primitive cell itself: ${S.cellCountText} in a³ = ${vol(1)} Å³.`
          : `The conventional ${cellName} shows the full ${S.hexagonal ? "hexagonal" : "cubic"} symmetry: ${S.cellCountText} in ${S.cellVolumeText} = ${vol(S.cellVolume)} Å³, the volume of ${ratio} primitive cells.`;
      const netText = `an infinite ${typeName} net with ${cellText} and ${perCell} per cell`;

      if (this.mode === "primToNet") {
        step("Primitive cell", `${S.short}: ${primitiveText} ${primitiveNote}`, vPrim, primView);
        step("Conventional cell", conventionalText, vCell, conventionalView);
        step(
          "3D array",
          `Repeat the ${cellName} along its edges: ${arrayText} with ${this.journey.atoms} atoms. Every lattice point has the same surroundings.`,
          vArray,
          blockView,
        );
        step(
          `Slice by (${H})`,
          `The (${H}) planes cut the array into ${this.layers.length} parallel layers, ${spacing}. Colors mark the stacking registry: ${sequence}${sequence.endsWith("…") ? "" : "."}`,
          vSlice,
          blockView,
        );
        step(
          "Layers apart",
          `Pulled apart along ${along}, every layer is a flat 2D array of atoms. Stacked back with their in-plane shifts they rebuild the 3D crystal: ${sequence}, period N = ${g.period}.`,
          vApart,
          apartView,
        );
        step(
          "One layer",
          `Keep layer ${layer} and look straight down ${along}: one 2D array, with every distance true.`,
          vOne,
          oneView,
        );
        step(
          "2D array",
          `Repeat the layer in the plane: ${netText}; area ${f3(g.area * a * a)} Å². Open it in the Surface net to measure and export.`,
          vNet,
          flatView,
          { handoff: true },
        );
      } else {
        step(
          "2D array",
          `Start from one (${H}) layer of ${S.short}: ${netText}.${reducedNote}`,
          vNet,
          flatView,
        );
        step(
          "Stack the layers",
          `Copies of the layer stack along ${along}, each one shifted in-plane: ${sequence}. The pattern repeats every N = ${g.period} layers.`,
          vApart,
          apartView,
        );
        step(
          "3D array",
          `Close the gaps (${g.evenlySpaced ? `d = ${len(g.d)} Å` : `${g.gaps.map(len).join(" and ")} Å in turn`}): the stacked 2D arrays are a 3D crystal, here ${this.journey.atoms} atoms.`,
          { ...vSlice, plane: 0, grid: 0, cube: 0 },
          blockView,
        );
        step(
          "Repeating cells",
          `The same block is ${arrayText}: each ${cellName} is a translated copy of the others.`,
          vArray,
          blockView,
        );
        step(
          "Conventional cell",
          `Keep one ${cellName}: ${S.cellCountText} in ${S.cellVolumeText} = ${vol(S.cellVolume)} Å³.`,
          { ...vCell, rhombo: 0, avec: 0 },
          conventionalView,
        );
        step(
          "Primitive cell",
          `The smallest repeating unit: ${primitiveText} ${primitiveNote}`,
          { ...vPrim, cAtoms: 0.12, cube: 0.3 },
          primView,
          { autoRotate: true },
        );
      }
    }

    return steps;
  }

  // ------------------------------------------------------------------ timeline

  get last() {
    return this.steps.length - 1;
  }

  /** Values between steps: linear inside a segment (easing is applied to the position). */
  valuesAt(position) {
    const k = Math.min(this.last, Math.max(0, Math.floor(position)));
    const t = position - k;
    const from = this.steps[k].values;
    if (t < 1e-6 || k === this.last) return from;
    const to = this.steps[k + 1].values;
    return Object.fromEntries(
      Object.keys(from).map((key) => [key, lerp(from[key], to[key] ?? 0, t)]),
    );
  }

  viewAt(position) {
    const k = Math.min(this.last, Math.max(0, Math.floor(position)));
    const t = position - k;
    const from = this.steps[k].view;
    if (t < 1e-6 || k === this.last) return this.effective(from);
    return this.blend(this.effective(from), this.effective(this.steps[k + 1].view), t);
  }

  effective(view) {
    const aspect =
      Math.max(this.viewer.host.clientWidth, 100) / Math.max(this.viewer.host.clientHeight, 100);
    return { ...view, span: view.span / Math.min(1, aspect), zoom: 1 };
  }

  blend(from, to, t) {
    return {
      target: [0, 1, 2].map((i) => lerp(from.target[i], to.target[i], t)),
      quaternion: new Quaternion().slerpQuaternions(from.quaternion, to.quaternion, t),
      span: lerp(from.span, to.span, t),
      zoom: lerp(from.zoom, to.zoom, t),
    };
  }

  /** The camera as it is now (the user may have rotated or zoomed while paused). */
  currentView() {
    const camera = this.viewer.camera;
    return {
      target: this.viewer.controls.target.toArray(),
      quaternion: camera.quaternion.clone(),
      span: this.viewer.span,
      zoom: camera.zoom,
    };
  }

  applyView(view) {
    const { camera, controls } = this.viewer;
    const back = new Vector3(0, 0, 1).applyQuaternion(view.quaternion);
    camera.quaternion.copy(view.quaternion);
    camera.up.copy(new Vector3(0, 1, 0).applyQuaternion(view.quaternion));
    camera.position.copy(v3(view.target)).addScaledVector(back, view.span * 1.65);
    camera.zoom = view.zoom;
    controls.target.set(...view.target);
    this.viewer.span = view.span;
    this.viewer.updateFrustum();
    this.viewer.dirty = true;
  }

  applyAt(position, view) {
    const values = this.valuesAt(position);
    for (const channel of this.channels) channel(values);
    if (view) this.applyView(view);
    this.position = position;
    this.viewer.dirty = true;
    this.viewer.onAnimationPosition?.(position);
  }

  cancel() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    this.frame = this.timer = null;
    if (this.viewer.controls) this.viewer.controls.enabled = true;
  }

  /** Tween to a step. */
  goTo(target, done) {
    target = Math.min(this.last, Math.max(0, target));
    this.cancel();
    this.setAutoRotate(false);
    const start = this.position;
    const fromView = this.currentView();
    const toView = this.effective(this.steps[target].view);
    const duration = this.reducedMotion
      ? 0
      : (DURATION / this.speed) * (Math.abs(target - start) > 1.5 ? 1.3 : 1);
    const began = performance.now();
    this.viewer.controls.enabled = false;
    const tick = () => {
      const t = duration ? clamp01((performance.now() - began) / duration) : 1;
      const e = easeInOutQuad(t);
      this.applyAt(lerp(start, target, e), this.blend(fromView, toView, e));
      if (t < 1) {
        this.frame = requestAnimationFrame(tick);
        return;
      }
      this.frame = null;
      this.viewer.controls.enabled = true;
      this.setAutoRotate(Boolean(this.steps[target].autoRotate));
      this.notify();
      done?.();
    };
    this.notify(target);
    tick();
  }

  next() {
    this.pause();
    this.goTo(Math.round(this.position) + 1);
  }

  back() {
    this.pause();
    this.goTo(Math.round(this.position) - 1);
  }

  play() {
    if (Math.round(this.position) >= this.last) this.applyAt(0, this.effective(this.steps[0].view));
    this.playing = true;
    this.notify();
    const advance = () => {
      if (!this.playing) return;
      if (Math.round(this.position) >= this.last) {
        this.playing = false;
        this.notify();
        return;
      }
      this.goTo(Math.round(this.position) + 1, () => {
        const hold =
          (1800 + 30 * this.steps[Math.round(this.position)].caption.length) / this.speed;
        this.timer = setTimeout(advance, this.reducedMotion ? 2500 : hold);
      });
    };
    advance();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
    this.notify();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  replay() {
    this.cancel();
    this.applyAt(0, this.effective(this.steps[0].view));
    this.play();
  }

  /** Scrubber: jump to any position on the timeline. */
  seek(position) {
    this.pause();
    this.cancel();
    this.setAutoRotate(false);
    this.applyAt(Math.min(this.last, Math.max(0, position)), this.viewAt(position));
    this.notify();
  }

  /** Re-frame the current step (Fit view). */
  refit() {
    this.goTo(Math.round(this.position));
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setAutoRotate(on) {
    const controls = this.viewer.controls;
    controls.autoRotate = on && !this.reducedMotion;
    controls.autoRotateSpeed = 1.2;
  }

  /** The user started dragging: stop auto-rotation (dragging is disabled mid-tween). */
  userInteracted() {
    this.setAutoRotate(false);
  }

  /** Re-apply the current step, e.g. after the camera type changed. */
  refresh() {
    this.cancel();
    this.applyAt(this.position, this.viewAt(Math.round(this.position)));
    this.setAutoRotate(Boolean(this.steps[Math.round(this.position)].autoRotate));
  }

  info(pending) {
    const index = pending ?? Math.round(this.position);
    const step = this.steps[index];
    const shown = (j) =>
      ["in", "out", "lay"].some((key) => (step.values[`${key}:${j}`] ?? 0) > 0.05);
    const registries =
      this.mode === "build" || (JOURNEYS.includes(this.mode) && step.values.color > 0.05);
    return {
      mode: this.mode,
      structure: this.structure.key,
      step: index,
      total: this.steps.length,
      label: step.label,
      caption: step.caption,
      handoff: Boolean(step.handoff),
      playing: this.playing,
      position: this.position,
      hkl: this.g.hkl,
      layer: this.layer,
      period: this.g.period,
      ballsInCell: this.ballsInCell ?? null,
      atoms: this.journey?.atoms ?? null,
      captions: this.steps.map((s) => s.caption),
      // Overlays shown in this step, for the legend.
      visible: Object.entries(step.values)
        .filter(([key, value]) => !key.includes(":") && value > 0.05)
        .map(([key]) => key),
      // Registry letters of the layers on screen (Build, and the colored journey steps).
      letters: registries
        ? [...new Map(this.layers.filter(shown).map((j) => [this.letterOf(j), this.colorOf(j)]))]
        : [],
    };
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(pending) {
    const info = this.info(pending);
    for (const listener of this.listeners) listener(info);
  }

  dispose() {
    this.cancel();
    this.playing = false;
    this.setAutoRotate(false);
    this.viewer.scene.remove(this.group);
    const geometries = new Set([this.sphere]);
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.labels = [];
    this.listeners.clear();
    this.viewer.dirty = true;
  }
}
