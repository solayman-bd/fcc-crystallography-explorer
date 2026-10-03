/**
 * "3D cell ⇄ 2D net": a step-by-step animation of how one conventional cube is cut into the
 * atomic layers of a plane family, flattened into the 2D net, and rebuilt by stacking.
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
import { PRIMITIVE_VECTORS, primitiveCellCorners } from "../crystal/lattice.js";
import {
  cellCount,
  classifyCut,
  cubeAround,
  inCube,
  layerGeometry,
  layerLetter,
  layerPoints,
  millerLabel,
  nearestLayerPoint,
  planeCoords,
  projectedSpots,
  stackPlan,
} from "../crystal/layers.js";
import { add, dot, formatNumber, norm, normalize, scale, subtract } from "../crystal/math.js";
import { polygonGeometry } from "./geometry.js";

/** Animation modes, in the order shown in the player. */
export const ANIMATION_MODES = [
  ["deconstruct", "3D cell → 2D net"],
  ["build", "2D net → 3D cell"],
  ["primitive", "Primitive cells"],
];

const DURATION = 1100;
const OBLIQUE = normalize([1.15, -1.55, 1.15]);
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
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const f3 = (value) => formatNumber(value, 3).replace("-", "−");
const v3 = (p) => new Vector3(...p);

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
    this.layer = layer;
    this.speed = state.animSpeed;
    this.a = state.a;
    this.g = layerGeometry(state.hkl, state.a);
    this.cube = cubeAround(this.g, layer);
    this.radius = state.radiusMode === "physical" ? 1 / (2 * Math.SQRT2) : state.radius;
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
    // Foot of the cube center on the selected layer, and the layer point nearest to it.
    const s0 = layer * this.g.step;
    this.foot = subtract(
      this.cube.center,
      scale(this.n, (dot(this.g.hkl, this.cube.center) - s0) / norm(this.g.hkl)),
    );
    this.origin = nearestLayerPoint(this.g, layer, this.cube.center);
    this.netRadius = Math.min(6, Math.max(1.7, 3 * Math.max(...this.g.lengths)));

    this.build();
    this.steps = this.makeSteps();
    this.applyAt(0, this.viewAt(0));
  }

  // ------------------------------------------------------------------ scene objects

  colorOf(j) {
    if (this.mode === "deconstruct") {
      return LAYER_PALETTE[this.cube.layers.indexOf(j) % LAYER_PALETTE.length] ?? LAYER_PALETTE[0];
    }
    const index = (((j - this.layer) % this.g.period) + this.g.period) % this.g.period;
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

  build() {
    const { g, cube, state } = this;
    const lift = (p, h = 0.004) => add(p, scale(this.n, h));

    // Layers: Deconstruct/Primitive use the cube's balls plus the selected layer's net; Build uses
    // the stack plan.
    let points;
    if (this.mode === "build") {
      this.plan = stackPlan(g, this.layer);
      points = this.plan.points;
      this.layers = this.plan.layers;
    } else {
      const net = layerPoints(g, this.layer, this.cube.center, this.netRadius)
        .filter((point) => !inCube(cube, point.p))
        .map((point) => ({ ...point, inCube: false }));
      points = [...cube.balls.map((ball) => ({ ...ball, inCube: true })), ...net];
      this.layers = cube.layers;
    }

    const hostColor = new Color(state.color);
    for (const j of this.layers) {
      const holder = new Group();
      this.group.add(holder);
      const layerColor = new Color(this.colorOf(j));
      const inside = this.spheres(
        points.filter((p) => p.layer === j && p.inCube),
        layerColor,
        holder,
      );
      const outsidePoints = points.filter((p) => p.layer === j && !p.inCube);
      const outside = this.spheres(outsidePoints, layerColor, holder);
      const sliceData = cube.slices.find((slice) => slice.layer === j);
      const slice = sliceData
        ? this.polygon(sliceData.polygon, this.colorOf(j), holder, { fill: 0.3 })
        : null;
      const planar = outsidePoints.map((p) =>
        Math.hypot(...planeCoords(g, subtract(p.p, this.foot))),
      );
      let lastGrow = null;
      let letter = null;

      // Letter tags; for long periods only the two A layers that bracket one repeat, so tags
      // on closely spaced layers do not pile up.
      const tagged = g.period <= 4 || j === this.layer || j === this.layer + g.period;
      if (this.mode === "build" && this.plan.stack.includes(j) && tagged) {
        const side = add(
          add(this.foot, scale(this.n, (j - this.layer) * g.d)),
          scale(this.e2, -(this.plan.radius + 0.3)),
        );
        letter = this.label(
          layerLetter(j - this.layer, g.period),
          side,
          this.colorOf(j),
          holder,
          0.24,
        );
      }

      this.channels.push((v) => {
        holder.position.copy(v3(scale(this.n, v[`off:${j}`] ?? 0)));
        const tint = hostColor.clone().lerp(layerColor, v.color);
        for (const mesh of [inside, outside]) mesh?.material.color.copy(tint);
        fade(inside, v[`in:${j}`] ?? 0, 1, true);
        fade(outside, (v[`out:${j}`] ?? 0) * (1 - 0.95 * v.focus), 1, true);
        this.fadePolygon(slice, v[`slice:${j}`] ?? 0);
        fade(letter, v.letters * Math.max(v[`in:${j}`] ?? 0, v[`out:${j}`] ?? 0));

        // The selected layer grows outward from the cube (Deconstruct).
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

    // Cube edges.
    const corners = Array.from({ length: 8 }, (_, c) =>
      add(cube.origin, [c & 1, (c >> 1) & 1, (c >> 2) & 1]),
    );
    const segments = [];
    for (let from = 0; from < 8; from++) {
      for (let axis = 0; axis < 3; axis++) {
        const to = from ^ (1 << axis);
        if (to > from) segments.push(corners[from], corners[to]);
      }
    }
    const edges = new LineSegments(
      new BufferGeometry().setFromPoints(segments.map(v3)),
      new LineBasicMaterial({ color: "#6c8b9e", transparent: true }),
    );
    this.group.add(edges);

    // The selected plane, as a translucent sheet larger than the cube, and its cube cut.
    const half = 1.15;
    const sheet = this.polygon(
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => add(this.foot, add(scale(this.e1, x * half), scale(this.e2, y * half)))),
      state.planeColor,
      this.group,
      { fill: 0.22 },
    );
    const cutPolygon = cube.slices.find((slice) => slice.layer === this.layer)?.polygon ?? [];
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
    const prim = this.polygon(primitiveCorners, state.surfaceColor, this.selectedHolder, {
      fill: 0.3,
    });
    const conv = g.centered
      ? this.polygon(cellCorners(g.centered.u, g.centered.v), CENTERED_COLOR, this.selectedHolder, {
          fill: 0.08,
          dashed: true,
        })
      : null;
    // Vectors float just above the balls so their heads are not hidden inside them.
    const vectors = new Group();
    const top = lift(o, this.radius + 0.02);
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
    if (norm(g.shift) > 1e-9) {
      this.arrow(o, g.shift, state.dirColor, shiftGroup);
      this.line(
        [add(o, g.shift), add(add(o, g.shift), scale(this.n, g.d))],
        state.dirColor,
        shiftGroup,
      );
      this.label(
        "shift",
        add(add(o, scale(g.shift, 0.5)), scale(this.n, 0.09)),
        state.dirColor,
        shiftGroup,
        0.15,
      );
    }
    this.selectedHolder.add(shiftGroup);
    const dGroup = new Group();
    const dBase = add(this.foot, scale(this.e2, (this.plan?.radius ?? 1) + 0.15));
    this.arrow(dBase, scale(this.n, g.d), "#63879d", dGroup);
    this.label(
      `d = ${f3(g.d * this.a)} Å`,
      add(dBase, add(scale(this.n, g.d / 2), scale(this.e2, 0.35))),
      "#63879d",
      dGroup,
      0.15,
    );
    this.group.add(dGroup);

    // Primitive mode: a1, a2, a3, the rhombohedron and its long diagonal.
    const aGroup = new Group();
    ["#36ad9c", "#a081d1", "#db9151"].forEach((color, i) => {
      this.arrow(cube.origin, PRIMITIVE_VECTORS[i], color, aGroup);
      this.label(
        `a${"₁₂₃"[i]}`,
        add(add(cube.origin, scale(PRIMITIVE_VECTORS[i], 0.62)), [0, 0, 0.1]),
        color,
        aGroup,
        0.22,
      );
    });
    this.group.add(aGroup);
    const rhombGeometry = new ConvexGeometry(primitiveCellCorners(cube.origin).map(v3));
    const rhomb = new Group();
    const rhombFill = new Mesh(
      rhombGeometry,
      new MeshStandardMaterial({
        color: state.surfaceColor,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    rhombFill.userData.base = 0.22;
    rhomb.add(
      rhombFill,
      new LineSegments(
        new EdgesGeometry(rhombGeometry, 12),
        new LineBasicMaterial({ color: state.surfaceColor, transparent: true }),
      ),
    );
    this.group.add(rhomb);
    const diagonal = new Group();
    this.line([cube.origin, add(cube.origin, [1, 1, 1])], "#d35f73", diagonal);
    this.label("[111]", add(cube.origin, [1.06, 1.06, 1.1]), "#d35f73", diagonal);
    this.group.add(diagonal);

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
      rhomb.visible = v.rhombo > 0.002;
      rhombFill.material.opacity = v.rhombo * 0.22;
      rhomb.children[1].material.opacity = v.rhombo;
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
    };
    for (const j of this.layers)
      Object.assign(values, {
        [`in:${j}`]: 0,
        [`out:${j}`]: 0,
        [`off:${j}`]: 0,
        [`slice:${j}`]: 0,
      });
    return values;
  }

  view(target, dir, up, span) {
    return { target, quaternion: orientation(dir, up), span };
  }

  makeSteps() {
    const { g, a, cube, layer } = this;
    const H = millerLabel(g.hkl);
    const reducedNote =
      millerLabel(g.input) === H ? "" : ` (${millerLabel(g.input)} reduces to (${H}))`;
    const len = (x) => f3(x * a);
    const typeName = g.type.replace("-", " ");
    const netView = (span) => this.view(this.foot, this.n, this.e2, span);
    const cubeView = this.view(cube.center, OBLIQUE, [0, 0, 1], 2.5);
    const cellText = `|t₁| = ${len(g.lengths[0])} Å, |t₂| = ${len(g.lengths[1])} Å, angle ${f3(g.angle)}°`;
    const steps = [];
    const step = (label, caption, values, view, flags = {}) =>
      steps.push({ label, caption, values, view, ...flags });

    if (this.mode === "deconstruct") {
      const all = (key, value, except = null) =>
        Object.fromEntries(
          this.layers.filter((j) => j !== except).map((j) => [`${key}:${j}`, value]),
        );
      const slice = cube.slices.find((s) => s.layer === layer);
      const cut = classifyCut(g, slice.polygon);
      const spots = projectedSpots(g, cube.balls);
      const sValues = cube.slices.map((s) => f3(s.layer * g.step)).join(", ");
      const counts = cube.slices.map((s) => s.count).join(", ");
      const s1 = { ...this.base(), cube: 1, ...all("in", 1) };
      step(
        "The cube",
        `One conventional FCC cube: 8 corners + 6 face centers = 14 balls, edge a = ${f3(a)} Å.`,
        s1,
        cubeView,
      );
      step(
        `Cut by (${H})`,
        `The (${H}) plane at layer ${layer} (s = ${f3(layer * g.step)}) cuts the cube in a ${cut.shape}.${reducedNote}`,
        { ...s1, plane: 1, cut: 1 },
        cubeView,
      );
      const s3 = { ...s1, color: 1, cut: 0.5, ...all("slice", 1) };
      step(
        "All layers",
        `(${H}) cuts the cube into ${cube.layers.length} layers, s = ${sValues}. Balls per layer: ${counts}. Neighboring layers are d = ${len(g.d)} Å apart.`,
        s3,
        cubeView,
      );
      step(
        `Look along [${H}]`,
        `Looking along [${H}] stacks every layer into one picture: ${spots} spots for 14 balls. Balls that overlap lie on different layers (picture B).`,
        { ...s3, cut: 0, ...all("slice", 0.45) },
        netView(2.3),
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
        netView(2.3),
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
        `Repeat the layer beyond the cube walls: an infinite ${typeName} net.`,
        s6,
        near,
      );
      step(
        "Cut vs. cell",
        cut.isCell
          ? `The ${cut.shape} cut by the cube walls is a cell of this net, but it holds ${cut.atoms} atoms, so it is not the smallest cell.`
          : `The ${cut.shape} cut by the cube walls is not a cell: copies of it cannot fill the plane by translation alone.`,
        { ...s6, cut: 1 },
        near,
      );
      const s7 = { ...s6, prim: 1, vec: 1, conv: g.centered ? 1 : 0 };
      const centered = g.centered
        ? ` Centered cell (dashed): ${len(norm(g.centered.u))} × ${len(norm(g.centered.v))} Å, 2 atoms.`
        : "";
      step(
        "2D cells",
        `Primitive cell t₁, t₂: ${cellText}, area ${f3(g.area * a * a)} Å², 1 atom; planar density ${f3(g.density / (a * a))} Å⁻².${centered}`,
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
      const stackHeight = (stackLayers.length - 1) * g.d;
      const stackCenter = add(this.foot, scale(this.n, stackHeight / 2));
      // Seen from the −e₁ side, like the side view later on, so the A/B/C letters stay on the right.
      const tilt = this.view(
        stackCenter,
        normalize(add(add(scale(this.n, 0.6), scale(this.e1, -0.75)), scale(this.e2, 0.25))),
        this.n,
        Math.max(2.4 * plan.radius + 0.8, stackHeight * 1.8),
      );
      const letters = (count) =>
        stackLayers
          .slice(0, count)
          .map((j) => layerLetter(j - layer, g.period))
          .join("");
      let values = { ...this.base(), ...waiting, color: 1, ...show(layer), prim: 1, vec: 1 };
      step(
        "One layer",
        `Start from one layer of (${H}): a ${typeName} net with ${cellText}.${reducedNote}`,
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
        const L = layerLetter(count, g.period);
        let caption;
        if (index === 0) {
          caption = `Layer B sits d = ${len(g.d)} Å higher and is shifted in-plane by ${len(norm(g.shift))} Å, so its atoms sit over the gaps of layer A.`;
        } else if (count === g.period) {
          caption = `Layer ${count + 1} returns to A: the stacking repeats every N = ${g.period} layers (${letters(count + 1)}). N·d = ${len(g.repeat)} Å, the shortest lattice vector along [${H}].`;
        } else if (group.length > 1) {
          caption = `Layers ${group.map((j) => layerLetter(j - layer, g.period)).join(", ")} follow with the same shift: ${letters(count + 1)}…${g.period > 12 ? ` Showing the first 13 of the N = ${g.period}-layer repeat.` : ""}`;
        } else {
          caption = `Layer ${L} repeats the same shift: ${letters(count + 1)}.`;
        }
        step(group.length > 1 ? "More layers" : `Layer ${L}`, caption, values, tilt);
      });
      step(
        "Side view",
        `Seen from the side along e₁: layers are d = ${len(g.d)} Å apart, and each one is shifted by ${len(norm(g.shift))} Å along the layer.`,
        { ...values, dmark: 1, prim: 0, vec: 0 },
        this.view(
          stackCenter,
          scale(this.e1, -1),
          this.n,
          Math.max(2.4 * plan.radius, stackHeight * 1.6),
        ),
      );
      const allLayers = Object.assign({}, ...this.layers.map(show));
      const inside = plan.points.filter((p) => p.inCube).length;
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
        "Back to the cube",
        `Turn back to the cube axes: exactly ${inside} balls of the stack fall inside one conventional cube (8 corners + 6 face centers).`,
        cubeValues,
        cubeView,
      );
      step(
        "Explore",
        "The stacked layers are the FCC crystal. Drag to explore.",
        cubeValues,
        cubeView,
        { autoRotate: true },
      );
      this.ballsInCube = inside;
    }

    if (this.mode === "primitive") {
      const all = (key, value) =>
        Object.fromEntries(this.layers.map((j) => [`${key}:${j}`, value]));
      const net = { [`in:${layer}`]: 1, [`out:${layer}`]: 1, grow: 1, morphCell: 1 };
      const view2d = this.view(this.foot, this.n, this.e2, 2.1 * this.netRadius);
      if (g.centered) {
        const count = cellCount(g, this.origin, g.centered.u, g.centered.v);
        const parts = [
          `${count.corner} corners × ¼`,
          count.edge && `${count.edge} edge atoms × ½`,
          count.inside && `${count.inside} center`,
        ]
          .filter(Boolean)
          .join(" + ");
        step(
          "Centered 2D cell",
          `Centered cell of the (${H}) net: ${len(norm(g.centered.u))} × ${len(norm(g.centered.v))} Å, area ${f3(2 * g.area * a * a)} Å², ${parts} = ${count.total} atoms.`,
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
        step(
          "Primitive 2D cell",
          `The (${H}) net is ${typeName}: its smallest cell t₁ × t₂ is already primitive. ${cellText}, area ${f3(g.area * a * a)} Å², 4 corners × ¼ = 1 atom.`,
          { ...this.base(), ...net, morph: 1, vec: 1 },
          view2d,
        );
      }
      const cubeBase = { ...this.base(), ...all("in", 1), cube: 1 };
      step(
        "The cube",
        `In 3D the conventional cube holds 8 × ⅛ + 6 × ½ = 4 atoms in a³ = ${f3(a ** 3)} Å³.`,
        cubeBase,
        cubeView,
      );
      step(
        "a₁, a₂, a₃",
        "From one corner, a₁ = a/2[011], a₂ = a/2[101] and a₃ = a/2[110] reach three face centers.",
        { ...cubeBase, avec: 1 },
        cubeView,
      );
      const rh = { ...cubeBase, ...all("in", 0.55), avec: 1, rhombo: 1 };
      step(
        "Primitive cell",
        `The primitive rhombohedron: |aᵢ| = a/√2 = ${f3(a / Math.SQRT2)} Å, 60° between each pair, volume a³/4 = ${f3(a ** 3 / 4)} Å³: 1 atom instead of 4. Its corners are one cube corner, the six face centers and the opposite corner.`,
        rh,
        cubeView,
      );
      step(
        "Long diagonal",
        "Its long diagonal runs along [111], from one cube corner to the opposite corner (1, 1, 1).",
        { ...rh, diag: 1 },
        cubeView,
        { autoRotate: true },
      );
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
    return {
      mode: this.mode,
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
      ballsInCube: this.ballsInCube ?? null,
      captions: this.steps.map((s) => s.caption),
      // Overlays shown in this step, for the legend.
      visible: Object.entries(step.values)
        .filter(([key, value]) => !key.includes(":") && value > 0.05)
        .map(([key]) => key),
      // Registry letters of the layers on screen (Build), with their colors.
      letters:
        this.mode === "build"
          ? [
              ...new Map(
                this.layers
                  .filter(
                    (j) =>
                      (step.values[`in:${j}`] ?? 0) > 0.05 || (step.values[`out:${j}`] ?? 0) > 0.05,
                  )
                  .map((j) => [layerLetter(j - this.layer, this.g.period), this.colorOf(j)]),
              ),
            ]
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
