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
  holeHosts,
  interstitialSites,
  neighborShells,
  wignerSeitzVertices,
} from "../crystal/environment.js";
import { PRIMITIVE_VECTORS, latticeSites, primitiveCellCorners } from "../crystal/lattice.js";
import {
  add,
  cubicFamily,
  dot,
  formatNumber,
  formatVector,
  mod,
  norm,
  normalize,
  scale,
  subtract,
} from "../crystal/math.js";
import {
  extendedPlaneQuad,
  planeBoxPolygon,
  planeLevel,
  planeLevelsInBox,
} from "../crystal/planes.js";
import { isAllowedReflection, reciprocalPoints } from "../crystal/reciprocal.js";
import { SHOCKLEY_EXAMPLE, slipSystems } from "../crystal/slip.js";
import { buildStack } from "../crystal/stacking.js";
import { layerOffset, surfaceCell, surfaceNet } from "../crystal/surfaces.js";
import { cappedSphereGeometry, polygonGeometry } from "./geometry.js";

export const toVector3 = (point) => new Vector3(...point);

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
    this.resize();
  }

  resize() {
    const width = Math.max(100, this.host.clientWidth);
    const height = Math.max(100, this.host.clientHeight);
    const aspect = width / height;
    this.renderer.setSize(width, height, false);

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
    sprite.position.copy(toVector3(position));
    sprite.userData.labelScale = size;
    sprite.renderOrder = 10;
    this.group.add(sprite);
    this.labels.push(sprite);
  }

  updateLabels() {
    this.camera.updateMatrixWorld();
    const viewHeight = Math.max(this.host.clientHeight, 100);

    for (const sprite of this.labels) {
      const depth = Math.abs(
        sprite.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z,
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
   * `color` is a color or a function of the site.
   */
  spheres(sites, radius, color, opacity = 1, segments = 24, capped = false) {
    const groups = new Map();

    for (const site of sites) {
      const mask = capped && site.boundary ? site.boundary : [0, 0, 0];
      const key = mask.join(",");

      if (!groups.has(key)) {
        groups.set(key, { mask, pts: [] });
      }

      groups.get(key).pts.push(site);
    }

    for (const { mask, pts: points } of groups.values()) {
      const geometry = mask.some(Boolean)
        ? cappedSphereGeometry(segments, mask)
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

    if (this.kind !== state.camera) {
      this.setCamera(state.camera);
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

  /** Cells, planes, directions, surface patch, neighbors, holes and slip. */
  crystalScene(state, selection) {
    const center = scale(state.N, 0.5);
    const level = planeLevel(state.hkl, state.N, state.location, state.c, state.layer);
    const radius = state.radiusMode === "physical" ? 1 / (2 * Math.sqrt(2)) : state.radius;
    const selected = selection?.space === "crystal" ? selection : null;
    const host = selected && !selected.type ? selected.p : [0, 0, 0];
    let sites = latticeSites(state.N, state.mode === "unique");

    if (state.primitiveOnly) {
      sites = [];
      for (let i = 0; i <= state.tiles; i++) {
        for (let j = 0; j <= state.tiles; j++) {
          for (let k = 0; k <= state.tiles; k++) {
            sites.push({
              id: `p:${i}:${j}:${k}`,
              p: [0, 1, 2].map(
                (axis) =>
                  i * PRIMITIVE_VECTORS[0][axis] +
                  j * PRIMITIVE_VECTORS[1][axis] +
                  k * PRIMITIVE_VECTORS[2][axis],
              ),
            });
          }
        }
      }
    }

    this.count = sites.length;
    this.center.copy(toVector3(center));
    const neighbors = state.neighbors ? neighborShells(host, state.shell, state.cutoff) : [];
    const neighborKeys = new Set(neighbors.map((neighbor) => formatVector(neighbor.p, 8)));
    const colorOf = (site) =>
      selected?.id === site.id
        ? state.selectedColor
        : neighborKeys.has(formatVector(site.p, 8))
          ? state.neighborColor
          : state.plane && state.highlight && Math.abs(dot(site.p, state.hkl) - level) < 1e-7
            ? state.layerColor
            : state.registryColor
              ? state[
                  "color" + "ABC"[mod(Math.round(site.p.reduce((sum, value) => sum + value, 0)), 3)]
                ]
              : site.ghost && state.mode === "ghost"
                ? "#b5cbd5"
                : state.color;

    if (state.atoms) {
      if (state.mode === "ghost") {
        this.spheres(
          sites.filter((site) => !site.ghost),
          radius,
          colorOf,
          state.opacity,
          state.quality,
          state.clip,
        );
        this.spheres(
          sites.filter((site) => site.ghost),
          radius,
          colorOf,
          Math.min(0.28, state.opacity),
          state.quality,
          state.clip,
        );
      } else {
        this.spheres(sites, radius, colorOf, state.opacity, state.quality, state.clip);
      }
    }

    if (state.labels !== "none" && state.atoms) {
      sites
        .slice(0, 180)
        .forEach((site) =>
          this.label(
            state.labels === "id"
              ? site.id
              : state.labels === "fractional"
                ? formatVector(site.p)
                : state.labels === "registry"
                  ? "ABC"[mod(Math.round(site.p.reduce((sum, value) => sum + value, 0)), 3)]
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

    if (state.cellOn) {
      this.box(state.cell, [1, 1, 1], state.selectedColor);
    }

    if (state.primitive || state.primitiveOnly) {
      for (let i = 0; i < state.tiles; i++) {
        for (let j = 0; j < state.tiles; j++) {
          for (let k = 0; k < state.tiles; k++) {
            this.edges(
              primitiveCellCorners(
                add(
                  add(scale(PRIMITIVE_VECTORS[0], i), scale(PRIMITIVE_VECTORS[1], j)),
                  scale(PRIMITIVE_VECTORS[2], k),
                ),
              ),
              state.surfaceColor,
            );
          }
        }
      }
      if (state.primitiveVectors) {
        PRIMITIVE_VECTORS.forEach((vector, index) =>
          this.arrow([0, 0, 0], vector, state.surfaceColor, `p${index + 1}`),
        );
      }
    }

    if (state.ws) {
      this.convex(
        wignerSeitzVertices().map((vertex) => add(vertex, host)),
        state.surfaceColor,
      );
      this.label("Wigner–Seitz · a³/4", add(host, [0, 0, 0.65]), state.surfaceColor);
    }

    if (state.axes) {
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

    if (state.origin) {
      this.label("O", [0, 0, -0.13]);
    }

    const planePolygon = (hkl, c) =>
      state.extend ? extendedPlaneQuad(hkl, c, state.N) : planeBoxPolygon(hkl, c, state.N);

    if (state.plane) {
      let planes =
        state.planeSet === "symmetry"
          ? cubicFamily(state.hkl).map((hkl, index) => ({
              n: hkl,
              c: planeLevel(hkl, state.N, state.location, state.c, state.layer),
              color: FAMILY_COLORS[index % 6],
              label: `(${formatVector(hkl)})`,
            }))
          : [
              {
                n: state.hkl,
                c: level,
                color: state.planeColor,
                label: `(${formatVector(state.hkl)})${state.location === "canonical" ? "" : " oriented"} · c=${formatNumber(level)}`,
              },
            ];

      if (["parallel", "atomic"].includes(state.planeSet)) {
        const levels = planeLevelsInBox(state.hkl, state.N, state.planeSet === "atomic");
        planes = levels.slice(0, 64).map((c) => ({ n: state.hkl, c, color: state.planeColor }));

        if (levels.length > 64) {
          this.messages.push(`Showing 64 of ${levels.length} parallel planes.`);
        }
      }

      for (const plane of planes) {
        const polygon = planePolygon(plane.n, plane.c);

        if (!polygon.length) {
          this.messages.push(
            "A selected plane has no 2D intersection with this box. Extend it or change its location.",
          );
          continue;
        }

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
    }

    const foot = add(
      center,
      scale(state.hkl, (level - dot(state.hkl, center)) / dot(state.hkl, state.hkl)),
    );

    if (state.normal) {
      this.arrow(
        foot,
        scale(normalize(state.hkl), 0.8),
        state.planeColor,
        `normal [${formatVector(state.hkl)}]`,
      );
    }

    if (state.spacing) {
      this.polygon(planePolygon(state.hkl, level + 1), state.planeColor, state.planeOpacity * 0.5);
      this.arrow(
        foot,
        scale(state.hkl, 1 / dot(state.hkl, state.hkl)),
        "#63879d",
        `d = ${formatNumber(state.a / norm(state.hkl))} Å`,
      );
    }

    if (state.direction) {
      for (const uvw of state.dirFamily ? cubicFamily(state.uvw, true) : [state.uvw]) {
        this.arrow(
          state.arrowOrigin,
          scale(uvw, state.scale),
          state.dirColor,
          state.dirFamily ? null : `${formatNumber(state.scale)}a [${formatVector(uvw)}]`,
        );
      }
      if (state.repeat) {
        for (let step = 1; step < 4; step++) {
          this.arrow(
            add(state.arrowOrigin, scale(state.uvw, step * state.scale)),
            scale(state.uvw, state.scale),
            state.dirColor,
          );
        }
      }
    }

    if (state.plane2) {
      const polygon = planePolygon(
        state.hkl2,
        planeLevel(state.hkl2, state.N, state.location, state.c, state.layer),
      );
      this.polygon(polygon, state.surfaceColor, state.planeOpacity);

      if (polygon.length && state.planeLabels) {
        this.label(
          `comparison (${formatVector(state.hkl2)})`,
          scale(polygon.reduce(add, [0, 0, 0]), 1 / polygon.length),
          state.surfaceColor,
          0.14,
        );
      }
    }

    if (state.dir2) {
      this.arrow(
        state.arrowOrigin,
        scale(state.uvw2, state.scale),
        state.selectedColor,
        `comparison [${formatVector(state.uvw2)}]`,
      );
    }

    if (state.surface) {
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
      const netOrigin = add(offset, add(scale(cell.t1, i), scale(cell.t2, j)));
      const net = surfaceNet(cell, state.netRepeat, netOrigin);
      this.spheres(net, radius * 0.6, state.surfaceColor, 0.85, state.quality);

      if (Math.abs((layer * cell.g) / 2 - level) > 1e-8) {
        this.messages.push(
          `Surface overlay uses nearest occupied layer c=${formatNumber((layer * cell.g) / 2)}.`,
        );
      }

      if (state.surfaceCell) {
        this.polygon(
          [
            netOrigin,
            add(netOrigin, cell.t1),
            add(add(netOrigin, cell.t1), cell.t2),
            add(netOrigin, cell.t2),
          ],
          state.surfaceColor,
          0.18,
        );
      }

      if (state.surfaceVectors) {
        this.arrow(netOrigin, cell.t1, state.surfaceColor, "t₁");
        this.arrow(netOrigin, cell.t2, "#b777a6", "t₂");
      }

      if (state.tiling) {
        for (const point of net) {
          this.line(
            [
              point.p,
              add(point.p, cell.t1),
              add(add(point.p, cell.t1), cell.t2),
              add(point.p, cell.t2),
            ],
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
      this.spheres(
        interstitialSites(state.holes, state.N),
        radius * 0.44,
        (site) =>
          selected?.id === site.id
            ? state.selectedColor
            : site.type === "octa"
              ? "#cc7aae"
              : "#c6a139",
        0.9,
        state.quality,
      );
      if (selected?.type && state.hosts) {
        const hosts = holeHosts(selected);
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
      const systems = slipSystems(state.load);
      const drawnPlanes = new Set();

      for (const system of state.allSlip ? systems : [systems[state.slipIndex]]) {
        const key = system.n.join(",");

        if (!drawnPlanes.has(key)) {
          this.polygon(
            planeBoxPolygon(system.n, dot(system.n, center), state.N),
            state.planeColor,
            state.allSlip ? 0.1 : 0.25,
          );
          drawnPlanes.add(key);
        }

        this.arrow(center, system.b, state.dirColor, state.allSlip ? null : "b = a/2<110>");

        if (!state.allSlip) {
          this.arrow(center, scale(normalize(system.n), 0.7), state.planeColor, "slip normal");
        }
      }
    }

    if (state.partials) {
      const example = SHOCKLEY_EXAMPLE;
      const origin = [0.15, 0.6, 0.5];
      this.polygon(
        extendedPlaneQuad(example.normal, dot(example.normal, origin), [1, 1, 1]),
        state.surfaceColor,
        0.15,
      );
      this.arrow(origin, example.first, "#da8c48", "a/6 [2 −1 −1]");
      this.arrow(add(origin, example.first), example.second, "#9665c2", "a/6 [1 −2 1]");
      this.arrow(origin, example.perfect, "#2c998d", "a/2 [1 −1 0]");
    }
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
    const points = reciprocalPoints(state.extent, state.forbidden);
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
        state.reflection,
        isAllowedReflection(state.reflection) ? "#2c988e" : "#cb6454",
        `G (${formatVector(state.reflection)})`,
      );
      this.spheres(
        [
          {
            p: state.reflection,
            id: "G-selected",
            hkl: state.reflection,
            allowed: isAllowedReflection(state.reflection),
          },
        ],
        0.16,
        state.selectedColor,
        1,
        state.quality,
      );
    }

    if (state.basisReciprocal) {
      [
        [-1, 1, 1],
        [1, -1, 1],
        [1, 1, -1],
      ].forEach((vector, index) =>
        this.arrow([0, 0, 0], vector, FAMILY_COLORS[index], `b${index + 1}`),
      );
    }

    if (state.bounds !== "none") {
      this.box([0, 0, 0], [2, 2, 2], "#9483b3");
    }

    if (state.axes) {
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].forEach((axis, index) =>
        this.arrow(
          [0, 0, 0],
          scale(axis, state.extent + 1),
          ["#d6655d", "#48a085", "#5683ca"][index],
          ["h", "k", "l"][index],
        ),
      );
    }

    this.messages.push(
      "Reciprocal coordinates: one unit = 2π/a Å⁻¹. Forbidden grid positions are not reciprocal nodes.",
    );
  }

  /** Frame everything drawn except labels. */
  fit() {
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
      toVector3([1.15, -1.55, 1.15])
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
