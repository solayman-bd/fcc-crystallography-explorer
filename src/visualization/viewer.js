/**
 * Three.js viewer for the crystal, stacking and reciprocal workspaces.
 * Atoms are instanced, pickable spheres; labels are camera-facing sprites.
 */

import {
  ArrowHelper,
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  HEXAGON,
  directionText,
  directionVector,
  extendedQuadOf,
  familyOf,
  fractionalOf,
  holesOf,
  hostsOf,
  levelsInRegion,
  neighborsOf,
  partialsOf,
  planeLevelOf,
  planeNormal,
  planeText,
  prismOutline,
  prismSites,
  reciprocalBasisOf,
  reciprocalPointsOf,
  reflectionOf,
  regionOf,
  sitesOf,
  slipSystemsOf,
  structureFor,
  toCartesian,
  toFractional,
  wignerSeitzOf,
} from "../crystal/bulk.js";
import { PRIMITIVE_VECTORS, primitiveCellCorners } from "../crystal/lattice.js";
import {
  layerForState,
  layerGeometry,
  layerNet,
  layerOf,
  layerS,
  nearestLayer,
  stackingIndices,
} from "../crystal/layers.js";
import {
  add,
  dot,
  formatNumber,
  formatVector,
  gcdOf,
  mod,
  norm,
  normalize,
  scale,
  subtract,
} from "../crystal/math.js";
import { extendedPlaneQuad } from "../crystal/planes.js";
import { buildStack } from "../crystal/stacking.js";
import { VIEW_DIRECTIONS, combine } from "../crystal/structures.js";
import { layerOffset, surfaceCell, surfaceNet } from "../crystal/surfaces.js";
import { CellNetAnimation } from "./cell-net.js";
import { cappedSphereGeometry, clippedSphereGeometry, polygonGeometry } from "./geometry.js";

export const toVector3 = (point) => new Vector3(...point);

/**
 * Stacking registry (A = 0, B = 1, C = 2) of a site on the structure's (111) layers, or on
 * the (0001) layers for HCP.
 */
function registryOf(S) {
  if (S.key === "fcc") {
    return (site) => mod(Math.round(site.p.reduce((sum, value) => sum + value, 0)), 3);
  }
  const layers = layerGeometry(S.registryPlane, 1, S);
  const indices = stackingIndices(layers, 0, layers.period);
  return (site) => indices[mod(layerOf(layers, site.p), layers.period)];
}

/** Colors for the members of a symmetry family. */
export const FAMILY_COLORS = ["#36ad9c", "#a081d1", "#db9151", "#5789b6", "#e16b87", "#9aaa3b"];

/**
 * Owns the renderer, cameras, controls and the drawing group.
 * `draw(state, selection)` rebuilds the scene from the current settings.
 */
export class CrystalViewer {
  constructor(host, onPick) {
    this.host = host;
    this.onPick = onPick;
    this.scene = new Scene();
    this.scene.background = new Color("#eef3f5");
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    host.appendChild(this.renderer.domElement);
    this.scene.add(new HemisphereLight(0xffffff, 0x8fa5b5, 2.1));
    const keyLight = new DirectionalLight(0xffffff, 3);
    keyLight.position.set(5, -7, 10);
    this.scene.add(keyLight);
    const fillLight = new DirectionalLight(0xc4e2ff, 1.1);
    fillLight.position.set(-6, 2, 4);
    this.scene.add(fillLight);
    this.group = new Group();
    this.scene.add(this.group);
    this.center = toVector3([0.5, 0.5, 0.5]);
    this.span = 2;
    this.pickables = [];
    this.labels = [];
    this.dirty = true;
    this.raycaster = new Raycaster();
    this.cellNet = null;
    this.drawn = { highlighted: false, planes: 0, comparison: false };
    this.setCamera("orthographic");
    new ResizeObserver(() => this.resize()).observe(host);
    let downAt;
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (event) => (downAt = [event.clientX, event.clientY]),
    );
    this.renderer.domElement.addEventListener("pointerup", (event) => {
      if (downAt && Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) < 5) {
        this.pick(event);
      }
      downAt = null;
    });
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.controls.update() || this.dirty) {
        this.updateLabels();
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
    };
    animate();
  }

  /** Switch between orthographic and perspective, keeping position and target. */
  setCamera(kind) {
    const position = this.camera?.position.clone() || toVector3([3, -4, 3]);
    const target = this.controls?.target.clone() || this.center;
    this.controls?.dispose();
    this.kind = kind;
    this.camera =
      kind === "orthographic"
        ? new OrthographicCamera(-2, 2, 2, -2, 0.01, 3000)
        : new PerspectiveCamera(38, 1, 0.01, 3000);
    this.camera.position.copy(position);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.controls.addEventListener("start", () => this.cellNet?.userInteracted());
    this.resize();
  }

  resize() {
    const width = Math.max(100, this.host.clientWidth);
    const height = Math.max(100, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.updateFrustum();
  }

  /** Apply `span` and the canvas aspect ratio to the camera. */
  updateFrustum() {
    const aspect = Math.max(100, this.host.clientWidth) / Math.max(100, this.host.clientHeight);

    if (this.kind === "orthographic") {
      this.camera.left = (-this.span * aspect) / 2;
      this.camera.right = (this.span * aspect) / 2;
      this.camera.top = this.span / 2;
      this.camera.bottom = -this.span / 2;
    } else {
      this.camera.aspect = aspect;
    }

    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Remove and dispose everything drawn. */
  clear() {
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.geometry) {
        geometries.add(object.geometry);
      }
      for (const material of Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : []) {
        materials.add(material);
      }
    });
    this.group.clear();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.labels = [];
    this.pickables = [];
  }

  line(points, color = "#7595a7", closed = false, opacity = 1) {
    if (points.length < 2) {
      return;
    }

    const geometry = new BufferGeometry().setFromPoints(
      (closed ? [...points, points[0]] : points).map(toVector3),
    );
    this.group.add(
      new Line(geometry, new LineBasicMaterial({ color, opacity, transparent: opacity < 1 })),
    );
  }

  /** Arrow from `origin` along `vector`, with an optional label at its tip. */
  arrow(origin, vector, color, text) {
    if (norm(vector) < 1e-9) return;

    this.group.add(
      new ArrowHelper(
        toVector3(normalize(vector)),
        toVector3(origin),
        norm(vector),
        color,
        Math.min(0.13, norm(vector) * 0.2),
        Math.min(0.055, norm(vector) * 0.09),
      ),
    );

    if (text) {
      this.label(text, add(add(origin, vector), [0, 0, 0.07]), color);
    }
  }

  /** Camera-facing text sprite; updateLabels keeps it at a constant screen size. */
  label(text, position, color = "#31546a", size = 0.18) {
    if (this.labels.length >= 220) {
      return;
    }

    const sprite = this.makeLabel(text, color, size);
    sprite.position.copy(toVector3(position));
    this.group.add(sprite);
    this.labels.push(sprite);
  }

  /** A label sprite that is not yet placed in the scene. */
  makeLabel(text, color = "#31546a", size = 0.18) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    context.font = "600 34px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const width = Math.min(508, context.measureText(text).width + 24);
    context.fillStyle = "#f5f9fced";
    context.beginPath();
    context.roundRect((512 - width) / 2, 4, width, 85, 14);
    context.fill();
    context.fillStyle = color;
    context.fillText(text, 256, 48, 490);
    const sprite = new Sprite(
      new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false }),
    );
    sprite.userData.labelScale = size;
    sprite.renderOrder = 10;
    return sprite;
  }

  updateLabels() {
    this.camera.updateMatrixWorld();
    const viewHeight = Math.max(this.host.clientHeight, 100);
    const world = new Vector3();

    for (const sprite of [...this.labels, ...(this.cellNet?.labels ?? [])]) {
      const depth = Math.abs(
        sprite.getWorldPosition(world).applyMatrix4(this.camera.matrixWorldInverse).z,
      );
      const unitsPerPixel =
        this.kind === "orthographic"
          ? this.span / (viewHeight * this.camera.zoom)
          : (2 * Math.tan((this.camera.fov * Math.PI) / 360) * depth) / viewHeight;
      const size = 32 * (sprite.userData.labelScale / 0.18) * unitsPerPixel;
      sprite.scale.set(size * 5.333, size, 1);
    }
  }

  /**
   * Instanced spheres for `sites` (one mesh per boundary mask when `capped`).
   * `color` is a color or a function of the site. `normals` are the outward face normals of a
   * non-cubic cell; sites with their own `clip` planes (the HCP prism) are cut by those.
   */
  spheres(sites, radius, color, opacity = 1, segments = 24, capped = false, normals = null) {
    const groups = new Map();

    for (const site of sites) {
      const clip = capped && site.clip?.length ? site.clip : null;
      const mask = capped && site.boundary ? site.boundary : [0, 0, 0];
      const key = clip ? clip.map((normal) => formatVector(normal, 5)).join("|") : mask.join(",");

      if (!groups.has(key)) {
        groups.set(key, { mask, clip, pts: [] });
      }

      groups.get(key).pts.push(site);
    }

    for (const { mask, clip, pts: points } of groups.values()) {
      const geometry = clip
        ? clippedSphereGeometry(segments, clip)
        : mask.some(Boolean)
          ? cappedSphereGeometry(segments, mask, normals)
          : new SphereGeometry(1, segments, Math.max(8, Math.round(segments * 0.65)));
      const material = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.08,
        opacity,
        transparent: opacity < 1,
        depthWrite: opacity > 0.98,
      });
      const mesh = new InstancedMesh(geometry, material, points.length);
      const dummy = new Object3D();
      points.forEach((site, index) => {
        dummy.position.copy(toVector3(site.p));
        dummy.scale.setScalar(radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, new Color(typeof color === "function" ? color(site) : color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.sites = points;
      this.group.add(mesh);
      this.pickables.push(mesh);
    }
  }

  polygon(points, color, opacity = 0.25) {
    if (points.length < 3) return;

    this.group.add(
      new Mesh(
        polygonGeometry(points),
        new MeshStandardMaterial({
          color,
          side: DoubleSide,
          transparent: true,
          opacity,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1,
        }),
      ),
    );
    this.line(points, color, true, 0.85);
  }

  /** Edges of a parallelepiped from its eight corners (corner index bits = axes). */
  edges(corners, color = "#6c8b9e") {
    const segments = [];

    for (let from = 0; from < 8; from++) {
      for (let axis = 0; axis < 3; axis++) {
        const to = from ^ (1 << axis);
        if (to > from) {
          segments.push(corners[from], corners[to]);
        }
      }
    }

    const geometry = new BufferGeometry().setFromPoints(segments.map(toVector3));
    this.group.add(new LineSegments(geometry, new LineBasicMaterial({ color })));
  }

  box(origin, size, color) {
    this.edges(
      Array.from({ length: 8 }, (_, corner) =>
        origin.map((value, axis) => value + ((corner >> axis) & 1) * size[axis]),
      ),
      color,
    );
  }

  /** Translucent convex hull with outlined edges. */
  convex(points, color) {
    const geometry = new ConvexGeometry(points.map(toVector3));
    this.group.add(
      new Mesh(
        geometry,
        new MeshStandardMaterial({
          color,
          opacity: 0.18,
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    this.group.add(
      new LineSegments(new EdgesGeometry(geometry, 12), new LineBasicMaterial({ color })),
    );
  }

  /** Rebuild the scene for the current settings. */
  draw(state, selection, fit = false) {
    this.state = state;
    this.selected = selection;
    this.clear();
    this.messages = [];
    this.count = 0;
    this.drawn = { highlighted: false, planes: 0, comparison: false };

    if (state.workspace !== "animation" && this.cellNet) {
      this.disposeAnimation();
      fit = true;
    }

    const cameraChanged = this.kind !== state.camera;

    if (cameraChanged) {
      this.setCamera(state.camera);
    }

    if (state.workspace === "animation") {
      this.animationScene(state, cameraChanged);
      this.resize();
      return;
    }

    if (state.workspace === "stacking") {
      this.stackScene(state, selection);
    } else if (state.workspace === "reciprocal") {
      this.reciprocalScene(state);
    } else {
      this.crystalScene(state, selection);
    }

    if (fit) {
      this.fit();
    }

    this.resize();
    this.dirty = true;
  }

  /**
   * The "3D cell ⇄ 2D net" animation for the plane and occupied layer of the surface panel.
   * It is rebuilt (and restarted) only when the plane, layer, mode or appearance changes.
   */
  animationScene(state, cameraChanged = false) {
    const layer = layerForState(layerGeometry(state.hkl, 1, state.structure), state);
    const key = JSON.stringify([
      state.animMode,
      state.structure,
      state.hkl.map((value) => value / gcdOf(state.hkl)),
      layer,
      state.a,
      state.radiusMode,
      state.radius,
      state.quality,
      state.color,
      state.colorA,
      state.colorB,
      state.colorC,
      state.planeColor,
      state.dirColor,
      state.surfaceColor,
    ]);

    if (this.cellNet?.key === key) {
      this.cellNet.setSpeed(state.animSpeed);

      if (cameraChanged) {
        this.cellNet.refresh();
      }
      return;
    }

    const wasPlaying = this.cellNet?.playing;
    this.cellNet?.dispose();
    this.cellNet = new CellNetAnimation(this, state, layer);
    this.cellNet.key = key;
    this.cellNet.onChange((info) => this.onAnimation?.(info));
    this.cellNet.notify();

    if (wasPlaying) {
      this.cellNet.play();
    }
  }

  /** Stop and remove the animation (when leaving its workspace). */
  disposeAnimation() {
    if (!this.cellNet) return;
    this.cellNet.dispose();
    this.cellNet = null;
    this.camera.up.set(0, 0, 1);
    this.dirty = true;
  }

  /** Cells, planes, directions, surface patch, neighbors, holes and slip. */
  crystalScene(state, selection) {
    const S = structureFor(state.structure);
    const fcc = S.key === "fcc";
    const region = regionOf(S, state);
    const prism = region.kind === "prism";
    const center = fcc ? scale(state.N, 0.5) : region.center;
    const centerFraction = scale(region.levelCells, 0.5);
    const level = planeLevelOf(
      S,
      state.hkl,
      region.levelCells,
      state.location,
      state.c,
      state.layer,
    );
    const radius = state.radiusMode === "physical" ? S.physicalRadius : state.radius;
    const selected = selection?.space === "crystal" ? selection : null;
    const host = selected && !selected.type ? selected.p : [0, 0, 0];
    let sites = prism
      ? prismSites(S, region.stories)
      : sitesOf(S, state.N, state.mode === "unique");

    if (state.primitiveOnly) {
      sites = [];
      for (let i = 0; i <= state.tiles; i++) {
        for (let j = 0; j <= state.tiles; j++) {
          for (let k = 0; k <= state.tiles; k++) {
            sites.push({
              id: `p:${i}:${j}:${k}`,
              p: fcc
                ? [0, 1, 2].map(
                    (axis) =>
                      i * PRIMITIVE_VECTORS[0][axis] +
                      j * PRIMITIVE_VECTORS[1][axis] +
                      k * PRIMITIVE_VECTORS[2][axis],
                  )
                : combine(S.primitive, [i, j, k]),
            });

            // The other basis atoms (HCP's B) inside each tiled primitive cell.
            if (i < state.tiles && j < state.tiles && k < state.tiles) {
              S.basisCartesian
                .slice(1)
                .forEach((offset, b) =>
                  sites.push({
                    id: `p:${i}:${j}:${k}:${b + 1}`,
                    p: add(combine(S.primitive, [i, j, k]), offset),
                  }),
                );
            }
          }
        }
      }
      if (!fcc) {
        sites.forEach((site) => (site.f = toFractional(S, site.p)));
      }
    }

    this.count = sites.length;
    const onPlane = (site) => Math.abs(dot(fractionalOf(site), state.hkl) - level) < 1e-7;
    this.drawn.highlighted = state.atoms && state.plane && state.highlight && sites.some(onPlane);
    this.center.copy(toVector3(center));
    const neighbors = state.neighbors ? neighborsOf(S, host, state.shell, state.cutoff) : [];
    const neighborKeys = new Set(neighbors.map((neighbor) => formatVector(neighbor.p, 8)));
    const registry = registryOf(S);
    const colorOf = (site) =>
      selected?.id === site.id
        ? state.selectedColor
        : neighborKeys.has(formatVector(site.p, 8))
          ? state.neighborColor
          : state.plane && state.highlight && onPlane(site)
            ? state.layerColor
            : state.registryColor
              ? state["color" + "ABC"[registry(site)]]
              : site.ghost && state.mode === "ghost"
                ? "#b5cbd5"
                : state.color;
    // Faces of the hexagonal unit cell are not axis planes; capped spheres need their normals.
    const faceNormals = S.hexagonal ? S.reciprocal.map(normalize) : null;

    if (state.atoms) {
      if (state.mode === "ghost") {
        this.spheres(
          sites.filter((site) => !site.ghost),
          radius,
          colorOf,
          state.opacity,
          state.quality,
          state.clip,
          faceNormals,
        );
        this.spheres(
          sites.filter((site) => site.ghost),
          radius,
          colorOf,
          Math.min(0.28, state.opacity),
          state.quality,
          state.clip,
          faceNormals,
        );
      } else {
        this.spheres(sites, radius, colorOf, state.opacity, state.quality, state.clip, faceNormals);
      }
    }

    if (prism && state.mode !== "closed" && !state.primitiveOnly) {
      this.messages.push(
        "The hexagonal prism is always drawn closed; unique and ghost drawings apply to the unit-cell supercell.",
      );
    }

    if (state.labels !== "none" && state.atoms) {
      sites
        .slice(0, 180)
        .forEach((site) =>
          this.label(
            state.labels === "id"
              ? site.id
              : state.labels === "fractional"
                ? formatVector(fractionalOf(site))
                : state.labels === "registry"
                  ? "ABC"[registry(site)]
                  : formatVector(scale(site.p, state.a)),
            add(site.p, [0, 0, radius + 0.08]),
            "#35586a",
            0.13,
          ),
        );
      if (sites.length > 180) {
        this.messages.push("Only the first 180 base atom labels are shown.");
      }
    }

    if (!state.primitiveOnly && prism && state.bounds !== "none") {
      this.segments(prismOutline(S, region.stories), "#6c8b9e");

      // The three unit cells inside the prism: spokes to every other corner, on every level.
      if (state.bounds === "all") {
        for (let z = 0; z <= region.stories; z++) {
          for (const corner of [HEXAGON[0], HEXAGON[2], HEXAGON[4]]) {
            this.line(
              [toCartesian(S, [0, 0, z]), toCartesian(S, [corner[0], corner[1], z])],
              "#86a1b1",
              false,
              0.6,
            );
          }
        }
        // The shared vertical edge of the three cells; their other edges lie on the prism faces.
        this.line(
          [toCartesian(S, [0, 0, 0]), toCartesian(S, [0, 0, region.stories])],
          "#86a1b1",
          false,
          0.6,
        );
      }
    } else if (!state.primitiveOnly && S.hexagonal) {
      if (state.bounds === "outer") {
        this.edges(this.unitCorners(S, [0, 0, 0], state.N));
      }
      if (state.bounds === "all") {
        for (let axis = 0; axis < 3; axis++) {
          const others = [0, 1, 2].filter((other) => other !== axis);
          for (let i = 0; i <= state.N[others[0]]; i++) {
            for (let j = 0; j <= state.N[others[1]]; j++) {
              const start = [0, 0, 0];
              const end = [0, 0, 0];
              start[others[0]] = end[others[0]] = i;
              start[others[1]] = end[others[1]] = j;
              end[axis] = state.N[axis];
              this.line([toCartesian(S, start), toCartesian(S, end)], "#86a1b1", false, 0.6);
            }
          }
        }
      }
    } else {
      if (!state.primitiveOnly && state.bounds === "outer") {
        this.box([0, 0, 0], state.N);
      }

      if (!state.primitiveOnly && state.bounds === "all") {
        for (let axis = 0; axis < 3; axis++) {
          const others = [0, 1, 2].filter((other) => other !== axis);
          for (let i = 0; i <= state.N[others[0]]; i++) {
            for (let j = 0; j <= state.N[others[1]]; j++) {
              const start = [0, 0, 0];
              const end = [0, 0, 0];
              start[others[0]] = end[others[0]] = i;
              start[others[1]] = end[others[1]] = j;
              end[axis] = state.N[axis];
              this.line([start, end], "#86a1b1", false, 0.6);
            }
          }
        }
      }
    }

    if (state.cellOn) {
      if (S.hexagonal) {
        this.edges(
          this.unitCorners(S, prism ? [0, 0, state.cell[2]] : state.cell, [1, 1, 1]),
          state.selectedColor,
        );
      } else {
        this.box(state.cell, [1, 1, 1], state.selectedColor);
      }
    }

    if (state.primitive || state.primitiveOnly) {
      const vectors = fcc ? PRIMITIVE_VECTORS : S.primitive;
      for (let i = 0; i < state.tiles; i++) {
        for (let j = 0; j < state.tiles; j++) {
          for (let k = 0; k < state.tiles; k++) {
            const corner = add(
              add(scale(vectors[0], i), scale(vectors[1], j)),
              scale(vectors[2], k),
            );
            this.edges(
              fcc
                ? primitiveCellCorners(corner)
                : Array.from({ length: 8 }, (_, bits) =>
                    add(corner, combine(vectors, [bits & 1, (bits >> 1) & 1, (bits >> 2) & 1])),
                  ),
              state.surfaceColor,
            );
          }
        }
      }
      if (state.primitiveVectors) {
        vectors.forEach((vector, index) =>
          this.arrow([0, 0, 0], vector, state.surfaceColor, `p${index + 1}`),
        );
      }

      // Primitive-cell corners outside the drawn cell (BCC's lie in neighboring cubes).
      if (!fcc && !state.primitiveOnly && state.atoms) {
        const drawn = new Set(sites.map((site) => formatVector(site.p, 6)));
        const corners = [];
        for (let i = 0; i <= state.tiles; i++) {
          for (let j = 0; j <= state.tiles; j++) {
            for (let k = 0; k <= state.tiles; k++) {
              const p = combine(vectors, [i, j, k]);
              if (!drawn.has(formatVector(p, 6))) {
                corners.push({ id: `p:${i}:${j}:${k}`, p, f: toFractional(S, p) });
              }
            }
          }
        }
        this.spheres(corners, radius, state.color, Math.min(0.4, state.opacity), state.quality);
      }
    }

    if (state.ws) {
      const cell = wignerSeitzOf(S);
      this.convex(
        cell.map((vertex) => add(vertex, host)),
        state.surfaceColor,
      );
      this.label(
        `Wigner–Seitz · ${S.primitiveVolumeText}`,
        add(host, [0, 0, fcc ? 0.65 : Math.max(...cell.map((vertex) => vertex[2])) + 0.15]),
        state.surfaceColor,
      );
    }

    if (state.axes) {
      if (S.hexagonal) {
        S.axes.forEach((axis, index) =>
          this.arrow(
            [0, 0, 0],
            scale(normalize(axis), 0.8),
            ["#d5655d", "#48a085", "#5683ca"][index],
            S.vectorLabels[index],
          ),
        );
      } else {
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ].forEach((axis, index) =>
          this.arrow(
            [0, 0, 0],
            scale(axis, 0.8),
            ["#d5655d", "#48a085", "#5683ca"][index],
            ["x", "y", "z"][index],
          ),
        );
      }
    }

    if (state.origin) {
      this.label("O", [0, 0, -0.13]);
    }

    const planePolygon = (hkl, c) =>
      state.extend ? region.extended(hkl, c) : region.polygon(hkl, c);
    const planeName = (hkl) => (S.hexagonal ? planeText(S, hkl) : formatVector(hkl));
    const directionName = (uvw) => (S.hexagonal ? directionText(S, uvw) : formatVector(uvw));

    if (state.plane) {
      let planes =
        state.planeSet === "symmetry"
          ? familyOf(S, state.hkl).map((hkl, index) => ({
              n: hkl,
              c: planeLevelOf(S, hkl, region.levelCells, state.location, state.c, state.layer),
              color: FAMILY_COLORS[index % 6],
              label: `(${planeName(hkl)})`,
            }))
          : [
              {
                n: state.hkl,
                c: level,
                color: state.planeColor,
                label: `(${planeName(state.hkl)})${state.location === "canonical" ? "" : " oriented"} · c=${formatNumber(level)}`,
              },
            ];

      if (["parallel", "atomic"].includes(state.planeSet)) {
        const levels = levelsInRegion(S, state.hkl, region, state.planeSet === "atomic");
        planes = levels.slice(0, 64).map((c) => ({ n: state.hkl, c, color: state.planeColor }));

        if (levels.length > 64) {
          this.messages.push(`Showing 64 of ${levels.length} parallel planes.`);
        }
      }

      const missing = [];

      for (const plane of planes) {
        const polygon = planePolygon(plane.n, plane.c);

        if (!polygon.length) {
          missing.push(plane);
          continue;
        }

        this.drawn.planes++;
        this.polygon(
          polygon,
          plane.color,
          state.planeSet === "one" ? state.planeOpacity : state.planeOpacity * 0.5,
        );

        if (plane.label && state.planeLabels) {
          this.label(
            plane.label,
            scale(polygon.reduce(add, [0, 0, 0]), 1 / polygon.length),
            plane.color,
            0.14,
          );
        }
      }

      // Parallel and atomic sets include layers that only touch a corner; that is expected.
      if (state.planeSet === "one" && missing.length) {
        this.messages.push(
          `The (${planeName(state.hkl)}) plane at c=${formatNumber(level)} does not cut through this box. Extend it or change its location.`,
        );
      } else if (state.planeSet === "symmetry" && missing.length) {
        this.messages.push(
          `${missing.map((plane) => `(${planeName(plane.n)})`).join(", ")} ${missing.length > 1 ? "do" : "does"} not cut through this box at this location; the other family members are drawn.`,
        );
      } else if (!this.drawn.planes) {
        this.messages.push(
          "No plane of this set cuts through the box. Extend the planes or change the box.",
        );
      }
    }

    const normalVector = planeNormal(S, state.hkl);
    const foot = fcc
      ? add(center, scale(state.hkl, (level - dot(state.hkl, center)) / dot(state.hkl, state.hkl)))
      : add(
          center,
          scale(
            normalVector,
            (level - dot(normalVector, center)) / dot(normalVector, normalVector),
          ),
        );

    if (state.normal) {
      this.arrow(
        foot,
        scale(normalize(normalVector), 0.8),
        state.planeColor,
        S.hexagonal ? `normal of (${planeName(state.hkl)})` : `normal [${formatVector(state.hkl)}]`,
      );
    }

    if (state.spacing) {
      this.polygon(planePolygon(state.hkl, level + 1), state.planeColor, state.planeOpacity * 0.5);
      this.arrow(
        foot,
        scale(normalVector, 1 / dot(normalVector, normalVector)),
        "#63879d",
        `d = ${formatNumber(state.a / norm(normalVector))} Å`,
      );
    }

    const arrowOrigin = toCartesian(S, state.arrowOrigin);

    if (state.direction) {
      for (const uvw of state.dirFamily ? familyOf(S, state.uvw, true, "direction") : [state.uvw]) {
        this.arrow(
          arrowOrigin,
          scale(directionVector(S, uvw), state.scale),
          state.dirColor,
          state.dirFamily ? null : `${formatNumber(state.scale)}a [${directionName(uvw)}]`,
        );
      }
      if (state.repeat) {
        for (let step = 1; step < 4; step++) {
          this.arrow(
            add(arrowOrigin, scale(directionVector(S, state.uvw), step * state.scale)),
            scale(directionVector(S, state.uvw), state.scale),
            state.dirColor,
          );
        }
      }
    }

    if (state.plane2) {
      const polygon = planePolygon(
        state.hkl2,
        planeLevelOf(S, state.hkl2, region.levelCells, state.location, state.c, state.layer),
      );
      this.polygon(polygon, state.surfaceColor, state.planeOpacity);
      this.drawn.comparison = polygon.length >= 3;

      if (polygon.length && state.planeLabels) {
        this.label(
          `comparison (${planeName(state.hkl2)})`,
          scale(polygon.reduce(add, [0, 0, 0]), 1 / polygon.length),
          state.surfaceColor,
          0.14,
        );
      }
    }

    if (state.dir2) {
      this.arrow(
        arrowOrigin,
        scale(directionVector(S, state.uvw2), state.scale),
        state.selectedColor,
        `comparison [${directionName(state.uvw2)}]`,
      );
    }

    if (state.surface) {
      let net;
      let netOrigin;
      let t1;
      let t2;

      if (fcc) {
        const cell = surfaceCell(state.hkl);
        const layer = Math.round(level / (cell.g / 2));
        const offset = layerOffset(state.hkl, layer);
        const delta = subtract(center, offset);
        const g11 = dot(cell.t1, cell.t1);
        const g22 = dot(cell.t2, cell.t2);
        const g12 = dot(cell.t1, cell.t2);
        const det = g11 * g22 - g12 * g12;
        const i = Math.round((dot(delta, cell.t1) * g22 - dot(delta, cell.t2) * g12) / det);
        const j = Math.round((dot(delta, cell.t2) * g11 - dot(delta, cell.t1) * g12) / det);
        netOrigin = add(offset, add(scale(cell.t1, i), scale(cell.t2, j)));
        net = surfaceNet(cell, state.netRepeat, netOrigin);
        [t1, t2] = [cell.t1, cell.t2];

        if (Math.abs((layer * cell.g) / 2 - level) > 1e-8) {
          this.messages.push(
            `Surface overlay uses nearest occupied layer c=${formatNumber((layer * cell.g) / 2)}.`,
          );
        }
      } else {
        const layers = layerGeometry(state.hkl, 1, S);
        const factor = gcdOf(state.hkl);
        const layer = nearestLayer(layers, level / factor);
        ({ origin: netOrigin, points: net } = layerNet(layers, layer, state.netRepeat, center));
        net.forEach((point) => (point.f = toFractional(S, point.p)));
        [t1, t2] = [layers.t1, layers.t2];

        if (Math.abs(layerS(layers, layer) * factor - level) > 1e-8) {
          this.messages.push(
            `Surface overlay uses nearest occupied layer c=${formatNumber(layerS(layers, layer) * factor)}.`,
          );
        }
      }

      this.spheres(net, radius * 0.6, state.surfaceColor, 0.85, state.quality);

      if (state.surfaceCell) {
        this.polygon(
          [netOrigin, add(netOrigin, t1), add(add(netOrigin, t1), t2), add(netOrigin, t2)],
          state.surfaceColor,
          0.18,
        );
      }

      if (state.surfaceVectors) {
        this.arrow(netOrigin, t1, state.surfaceColor, "t₁");
        this.arrow(netOrigin, t2, "#b777a6", "t₂");
      }

      if (state.tiling) {
        for (const point of net) {
          if (point.basis) continue;
          this.line(
            [point.p, add(point.p, t1), add(add(point.p, t1), t2), add(point.p, t2)],
            state.surfaceColor,
            true,
            0.3,
          );
        }
      }
    }

    if (state.neighbors) {
      const drawnKeys = new Set(state.atoms ? sites.map((site) => formatVector(site.p, 8)) : []);
      this.spheres(
        neighbors.filter((neighbor) => !drawnKeys.has(formatVector(neighbor.p, 8))),
        radius,
        state.neighborColor,
        0.55,
        state.quality,
      );
      this.spheres(
        [{ p: host, id: selected?.id || "bulk-origin" }],
        radius * 1.08,
        state.selectedColor,
        1,
        state.quality,
      );

      if (state.bonds) {
        neighbors.forEach((neighbor) => this.line([host, neighbor.p], state.neighborColor));
      }

      if (state.hull && neighbors.filter((neighbor) => neighbor.shell === 1).length >= 4) {
        this.convex(
          neighbors.filter((neighbor) => neighbor.shell === 1).map((neighbor) => neighbor.p),
          state.neighborColor,
        );
      }
    }

    if (state.holes !== "none") {
      const holes = holesOf(S, state.holes, state.N, region);
      this.spheres(
        holes,
        radius * 0.44,
        (site) =>
          selected?.id === site.id
            ? state.selectedColor
            : site.type === "octa"
              ? "#cc7aae"
              : site.type === "cubic"
                ? "#5e9fce"
                : "#c6a139",
        0.9,
        state.quality,
      );
      if (!holes.length) {
        this.messages.push(
          `${S.short} has no ${state.holes === "cubic" ? "cubic" : state.holes === "octa" ? "octahedral" : "tetrahedral"} holes in this list; choose another type.`,
        );
      }
      if (selected?.type && state.hosts) {
        const hosts = hostsOf(S, selected);
        this.spheres(
          hosts.map((host, index) => ({ ...host, id: `host:${index}` })),
          radius,
          state.neighborColor,
          0.65,
          state.quality,
        );
        hosts.forEach((host) => this.line([selected.p, host.p], state.neighborColor));
      }
    }

    if (state.slip) {
      const systems = slipSystemsOf(S, state.load);
      const drawnPlanes = new Set();

      for (const system of state.allSlip
        ? systems
        : [systems[Math.min(state.slipIndex, systems.length - 1)]]) {
        const key = system.n.join(",");

        if (!drawnPlanes.has(key)) {
          this.polygon(
            region.polygon(system.n, dot(system.n, centerFraction)),
            state.planeColor,
            state.allSlip ? 0.1 : 0.25,
          );
          drawnPlanes.add(key);
        }

        this.arrow(
          center,
          system.b,
          state.dirColor,
          state.allSlip ? null : fcc ? "b = a/2<110>" : `b = ${S.slip.burgers}`,
        );

        if (!state.allSlip) {
          this.arrow(
            center,
            scale(system.normal ?? normalize(system.n), 0.7),
            state.planeColor,
            "slip normal",
          );
        }
      }
    }

    if (state.partials) {
      const example = partialsOf(S);

      if (fcc) {
        const origin = [0.15, 0.6, 0.5];
        this.polygon(
          extendedPlaneQuad(example.normal, dot(example.normal, origin), [1, 1, 1]),
          state.surfaceColor,
          0.15,
        );
        this.arrow(origin, example.first, "#da8c48", "a/6 [2 −1 −1]");
        this.arrow(add(origin, example.first), example.second, "#9665c2", "a/6 [1 −2 1]");
        this.arrow(origin, example.perfect, "#2c998d", "a/2 [1 −1 0]");
      } else if (example) {
        const origin = example.origin;
        this.polygon(
          extendedQuadOf(
            S,
            example.normal,
            dot(example.normal, toFractional(S, origin)),
            [1, 1, 1],
            0.9,
          ),
          state.surfaceColor,
          0.15,
        );
        this.arrow(origin, example.first, "#da8c48", example.labels[0]);
        this.arrow(add(origin, example.first), example.second, "#9665c2", example.labels[1]);
        this.arrow(origin, example.perfect, "#2c998d", example.labels[2]);
      } else {
        this.messages.push(
          `The partial-vector construction is shown for the close-packed planes of FCC and HCP; ${S.short} has none here.`,
        );
      }
    }
  }

  /** Cartesian corners of the unit-cell box from fractional `origin` with `size` cells. */
  unitCorners(S, origin, size) {
    return Array.from({ length: 8 }, (_, corner) =>
      toCartesian(
        S,
        origin.map((value, axis) => value + ((corner >> axis) & 1) * size[axis]),
      ),
    );
  }

  /** Line segments from [from, to] pairs. */
  segments(pairs, color) {
    const geometry = new BufferGeometry().setFromPoints(pairs.flat().map(toVector3));
    this.group.add(new LineSegments(geometry, new LineBasicMaterial({ color })));
  }

  /** Stacked close-packed layers in the [111] frame. */
  stackScene(state, selection) {
    const stack = buildStack(
      state.stack,
      state.layers,
      state.stackRepeat,
      state.separation,
      state.registries,
    );
    const radius = state.radiusMode === "physical" ? 1 / (2 * Math.sqrt(2)) : state.radius;
    this.count = stack.points.length;

    if (state.atoms) {
      this.spheres(
        stack.points,
        radius,
        (point) =>
          selection?.space === "stacking" && selection.id === point.id
            ? state.selectedColor
            : state[`color${point.registry}`],
        state.opacity,
        state.quality,
      );
    }

    if (state.stackLabels) {
      stack.sequence.split("").forEach((registry, layer) => {
        if (state.registries.includes(registry)) {
          this.label(
            `${registry} · ${layer}`,
            [-state.stackRepeat * 1.13 - 0.55, 0, layer * stack.displayHeight],
            state[`color${registry}`],
            0.22,
          );
        }
      });
    }

    if (state.axes) {
      this.arrow([0, 0, 0], [1, 0, 0], "#d6655d", "e₁ ∥ [1 −1 0]");
      this.arrow([0, 0, 0], [0, 1, 0], "#48a085", "e₂ ∥ [1 1 −2]");
      this.arrow([0, 0, 0], [0, 0, 1], "#5683ca", "normal ∥ [111]");
    }

    if (state.stack === "twin" && state.layers > 4 && state.twinPlane) {
      const height = 4 * stack.displayHeight;
      const half = state.stackRepeat;
      this.polygon(
        [
          [-half, -half, height],
          [half, -half, height],
          [half, half, height],
          [-half, half, height],
        ],
        state.surfaceColor,
        0.16,
      );
    }

    if (state.separation !== 1) {
      this.messages.push(`Layer spacing is visually exaggerated ×${state.separation}.`);
    }

    if (state.stack === "aaa") {
      this.messages.push("AAA is a non-close-packed registry comparison; its ideal gap is a/√2.");
    }
  }

  /** Reciprocal lattice nodes, the selected G and the primitive reciprocal basis. */
  reciprocalScene(state) {
    const S = structureFor(state.structure);
    const fcc = S.key === "fcc";
    const points = reciprocalPointsOf(S, state.extent, state.forbidden);
    const selectedG = planeNormal(S, state.reflection);
    const allowed = reflectionOf(S, state.reflection, state.a, state.lambda).allowed;
    this.count = points.length;

    if (state.atoms) {
      this.spheres(
        points.filter((point) => point.allowed),
        0.11,
        "#8061b6",
        1,
        state.quality,
      );
      this.spheres(
        points.filter((point) => !point.allowed),
        0.05,
        "#c6a694",
        0.4,
        state.quality,
      );
    }

    if (state.selectedG) {
      this.arrow(
        [0, 0, 0],
        selectedG,
        allowed ? "#2c988e" : "#cb6454",
        `G (${S.hexagonal ? planeText(S, state.reflection) : formatVector(state.reflection)})`,
      );
      this.spheres(
        [{ p: selectedG, id: "G-selected", hkl: state.reflection, allowed }],
        0.16,
        state.selectedColor,
        1,
        state.quality,
      );
    }

    if (state.basisReciprocal) {
      (fcc
        ? [
            [-1, 1, 1],
            [1, -1, 1],
            [1, 1, -1],
          ]
        : reciprocalBasisOf(S, 1).map((vector) => scale(vector, 1 / (2 * Math.PI)))
      ).forEach((vector, index) =>
        this.arrow([0, 0, 0], vector, FAMILY_COLORS[index], `b${index + 1}`),
      );
    }

    if (state.bounds !== "none") {
      if (S.hexagonal) {
        this.edges(
          Array.from({ length: 8 }, (_, corner) =>
            combine(S.reciprocal, [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1]),
          ),
          "#9483b3",
        );
      } else {
        const edge = fcc ? 2 : S.reciprocalBox;
        this.box([0, 0, 0], [edge, edge, edge], "#9483b3");
      }
    }

    if (state.axes) {
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].forEach((axis, index) =>
        this.arrow(
          [0, 0, 0],
          scale(S.hexagonal ? planeNormal(S, axis) : axis, state.extent + 1),
          ["#d6655d", "#48a085", "#5683ca"][index],
          ["h", "k", "l"][index],
        ),
      );
    }

    this.messages.push(
      S.hexagonal
        ? "Reciprocal coordinates: one unit = 2π/a Å⁻¹. Extinct HCP reflections are reciprocal nodes where the two-atom basis cancels the scattering."
        : "Reciprocal coordinates: one unit = 2π/a Å⁻¹. Forbidden grid positions are not reciprocal nodes.",
    );
  }

  /** Frame everything drawn except labels. */
  fit() {
    if (this.cellNet) {
      this.cellNet.refit();
      return;
    }

    const bounds = new Box3();

    for (const child of this.group.children) {
      if (!child.isSprite) {
        bounds.expandByObject(child);
      }
    }

    if (!bounds.isEmpty()) {
      this.center.copy(bounds.getCenter(new Vector3()));
      this.span = Math.max(0.7, bounds.getSize(new Vector3()).length() * 1.12);
    }

    this.span /= Math.min(
      1,
      Math.max(this.host.clientWidth, 100) / Math.max(this.host.clientHeight, 100),
    );
    this.controls.target.copy(this.center);
    this.camera.position.copy(this.center).add(
      toVector3(VIEW_DIRECTIONS[this.state?.structure] ?? VIEW_DIRECTIONS.fcc)
        .normalize()
        .multiplyScalar(this.span * 1.65),
    );
    this.camera.up.set(0, 0, 1);
    this.camera.zoom = 1;
    this.resize();
    this.controls.update();
    this.dirty = true;
  }

  /** Look along a direction, keeping the distance to the target. */
  look(direction) {
    const unit = normalize(direction);
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.camera.position.copy(this.controls.target).add(toVector3(scale(unit, distance)));
    this.camera.up.copy(toVector3(Math.abs(unit[2]) > 0.98 ? [0, 1, 0] : [0, 0, 1]));
    this.controls.update();
    this.dirty = true;
  }

  /** Raycast a click to a site. With low host opacity, holes take priority over hosts. */
  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    const holeHit =
      this.state.opacity < 0.4
        ? hits.find((hit) => hit.object.userData.sites[hit.instanceId]?.type)
        : null;
    const hit = holeHit || hits[0];

    if (hit) {
      this.onPick({ ...hit.object.userData.sites[hit.instanceId], space: this.state.workspace });
    }
  }

  /** Camera position, target, up vector and zoom, for saved views. */
  cameraState() {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
      zoom: this.camera.zoom,
      span: this.span,
    };
  }

  /** Restore a saved camera state. */
  restore(camera) {
    if (camera) {
      for (const key of ["position", "target", "up"]) {
        if (
          !Array.isArray(camera[key]) ||
          camera[key].length !== 3 ||
          !camera[key].every((value) => Number.isFinite(value) && Math.abs(value) < 10000)
        ) {
          throw new Error("Invalid camera");
        }
      }

      this.camera.position.fromArray(camera.position);
      this.camera.up.fromArray(camera.up);
      this.controls.target.fromArray(camera.target);

      if (Number.isFinite(camera.zoom) && camera.zoom > 0) {
        this.camera.zoom = camera.zoom;
      }

      if (Number.isFinite(camera.span) && camera.span > 0.01 && camera.span < 10000) {
        this.span = camera.span;
      }

      this.resize();
      this.controls.update();
    }
  }

  /** Render at `scale`× resolution and add a caption strip. */
  png(scale) {
    const previousRatio = this.renderer.getPixelRatio();
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height, false);
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    const source = this.renderer.domElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height + 50 * scale;
    const context = canvas.getContext("2d");
    context.fillStyle = "#eef3f5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    context.fillStyle = "#315368";
    context.font = `${12 * scale}px system-ui`;
    context.fillText(
      `FCC Explorer · ${this.state.workspace} · a=${this.state.a} Å · ideal geometry`,
      18 * scale,
      source.height + 29 * scale,
    );
    this.renderer.setPixelRatio(previousRatio);
    this.renderer.setSize(width, height, false);
    this.dirty = true;
    return canvas.toDataURL("image/png");
  }
}
