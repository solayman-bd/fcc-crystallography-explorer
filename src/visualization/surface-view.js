/**
 * Analytic 2D view of one occupied atomic layer, drawn as SVG.
 */

import { add, dot, formatNumber, formatVector, scale, subtract } from "../crystal/math.js";
import { planeInfo, planeLevel } from "../crystal/planes.js";
import { cubicMeshVectors, layerOffset, surfaceCell, surfaceNet } from "../crystal/surfaces.js";

/**
 * Projects one atomic layer onto e1 = t1/|t1| and e2 = n̂ × e1 and draws the net,
 * cells and bonds as SVG, with pan and zoom.
 */
export class SurfaceView {
  constructor(host, onPick) {
    this.host = host;
    this.pick = onPick;
    this.zoom = 1;
    this.pan = [0, 0];
    host.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoom = Math.max(0.25, Math.min(8, this.zoom * Math.exp(-event.deltaY * 0.001)));
        this.draw(this.state, this.selected);
      },
      { passive: false },
    );
    let dragStart;
    host.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-site]")) {
        dragStart = [event.clientX, event.clientY, ...this.pan];
        host.setPointerCapture(event.pointerId);
      }
    });
    host.addEventListener("pointermove", (event) => {
      if (!dragStart) {
        return;
      }

      const rect = host.getBoundingClientRect();
      this.pan = [
        dragStart[2] + ((event.clientX - dragStart[0]) * 900) / rect.width,
        dragStart[3] + ((event.clientY - dragStart[1]) * 700) / rect.height,
      ];
      this.draw(this.state, this.selected);
    });
    host.addEventListener("pointerup", () => (dragStart = null));
  }

  /** Reset pan and zoom. */
  fit() {
    this.zoom = 1;
    this.pan = [0, 0];

    if (this.state) {
      this.draw(this.state, this.selected);
    }
  }

  /** Redraw the SVG for the current settings. */
  draw(state, selection) {
    this.state = state;
    this.selected = selection;
    const cell = surfaceCell(state.hkl, state.a);
    const step = planeInfo(state.hkl).step;
    const level = planeLevel(state.hkl, state.N, state.location, state.c, state.layer);
    const layer = Math.round(level / step);
    const origin = layerOffset(state.hkl, layer);
    const net = surfaceNet(cell, state.netRepeat, origin);
    const coords = net.map((point) => [
      dot(subtract(point.p, origin), cell.ex),
      dot(subtract(point.p, origin), cell.ey),
    ]);
    const pixels =
      Math.min(
        680 / (Math.max(...coords.map((xy) => xy[0])) - Math.min(...coords.map((xy) => xy[0])) + 1),
        470 / (Math.max(...coords.map((xy) => xy[1])) - Math.min(...coords.map((xy) => xy[1])) + 1),
      ) * this.zoom;
    const project = (point) => [
      450 + this.pan[0] + dot(point, cell.ex) * pixels,
      325 + this.pan[1] - dot(point, cell.ey) * pixels,
    ];
    const pointList = (points) =>
      points
        .map((point) =>
          project(point)
            .map((value) => formatNumber(value, 3))
            .join(","),
        )
        .join(" ");
    const parts = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700" role="img" aria-label="Analytic single-layer surface net"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10Z" fill="${state.surfaceColor}"/></marker></defs><rect width="900" height="700" fill="#eef3f5"/>`,
    );
    const drawCell = (corner, v1, v2, stroke, fill, dash = "") =>
      parts.push(
        `<polygon points="${pointList([corner, add(corner, v1), add(add(corner, v1), v2), add(corner, v2)])}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="${dash}"/>`,
      );

    if (state.tiling) {
      for (let i = -state.netRepeat; i < state.netRepeat; i++) {
        for (let j = -state.netRepeat; j < state.netRepeat; j++) {
          drawCell(add(scale(cell.t1, i), scale(cell.t2, j)), cell.t1, cell.t2, "#c2b3d6", "none");
        }
      }
    }

    if (state.bonds2d) {
      const byKey = new Map(net.map((point) => [formatVector(point.p, 7), point]));
      for (const point of net) {
        for (const step of cell.neighbors) {
          const neighbor = byKey.get(formatVector(add(point.p, step), 7));
          if (neighbor && point.id < neighbor.id) {
            const from = project(subtract(point.p, origin));
            const to = project(subtract(neighbor.p, origin));
            parts.push(
              `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="#aec3ce" stroke-width="1.4"/>`,
            );
          }
        }
      }
    }

    if (state.conventional) {
      const [u, v] = cubicMeshVectors(state.hkl);
      drawCell([0, 0, 0], u, v, "#5185a0", "#5185a010", "8 5");
    }

    if (state.surfaceCell) {
      drawCell([0, 0, 0], cell.t1, cell.t2, state.surfaceColor, state.surfaceColor + "26");
    }

    if (state.atoms) {
      net.forEach((point, index) => {
        const [x, y] = project(subtract(point.p, origin));
        const radius =
          (state.radiusMode === "physical" ? 1 / (2 * Math.sqrt(2)) : state.radius) * pixels;
        const selected =
          selection?.space === "surface"
            ? selection.id === point.id
            : point.ij.every((value) => value === 0);
        parts.push(
          `<circle data-site="${index}" cx="${x}" cy="${y}" r="${Math.max(2, radius)}" fill="${selected ? state.selectedColor : state.color}" opacity="${state.opacity}" stroke="${selected ? state.selectedColor : "white"}" stroke-width="${selected ? 3 : 1.4}"><title>${point.id}: (${formatVector(point.p)})</title></circle>`,
        );

        if (state.labels2d) {
          parts.push(
            `<text x="${x}" y="${y - radius - 7}" text-anchor="middle" font-size="11" fill="#39596d">${point.ij.join(",")}</text>`,
          );
        }
      });
    }

    if (state.surfaceVectors) {
      [cell.t1, cell.t2].forEach((vector, index) => {
        const start = project([0, 0, 0]);
        const end = project(vector);
        parts.push(
          `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${state.surfaceColor}" stroke-width="3" marker-end="url(#arr)"/><text x="${end[0] + 10}" y="${end[1] - 10}" font-size="18" fill="${state.surfaceColor}">t${index + 1}</text>`,
        );
      });
    }

    parts.push(
      `<rect x="20" y="16" width="860" height="60" rx="10" fill="#eef3f5"/><text x="35" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#2c4d63">FCC (${formatVector(state.hkl)}) · one atomic layer · c=${formatNumber(layer * step)}</text><text x="35" y="63" font-family="system-ui" font-size="12" fill="#7792a2">Analytic orthogonal projection onto e₁=t₁/|t₁| and e₂=n̂ × e₁.</text><text x="36" y="599" font-family="system-ui" font-size="12" fill="#628192">Hosts: circles · selected: larger outline · primitive cell: filled · cubic mesh: dashed</text><rect x="20" y="616" width="860" height="65" rx="12" fill="white"/><text x="36" y="642" font-family="system-ui" font-size="14" fill="#385c72">|t₁|=${formatNumber(cell.lengths[0])} Å     |t₂|=${formatNumber(cell.lengths[1])} Å     angle=${formatNumber(cell.angle, 2)}°     area=${formatNumber(cell.area)} Å²</text><text x="36" y="664" font-family="system-ui" font-size="12" fill="#7792a2">${cell.coordination} nearest neighbors in this layer · density ${formatNumber(cell.density, 5)} Å⁻² · drag to pan / scroll to zoom</text></svg>`,
    );
    this.svg = parts.join("");
    this.host.innerHTML = this.svg;
    this.host.querySelectorAll("[data-site]").forEach((circle) =>
      circle.addEventListener("pointerup", (event) => {
        event.stopPropagation();
        this.pick({ ...net[+circle.dataset.site], space: "surface" });
      }),
    );
  }

  /** Rasterize the SVG at `scale`× resolution. */
  async png(scale) {
    const url = URL.createObjectURL(new Blob([this.svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 900 * scale;
    canvas.height = 700 * scale;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  }
}
