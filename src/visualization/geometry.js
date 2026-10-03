/**
 * Mesh builders for the 3D viewer.
 */

import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from "three";
import { add, dot, orthonormalFrame, scale, subtract } from "../crystal/math.js";

/** A triangle fan for a convex planar polygon. */
export function polygonGeometry(points) {
  const positions = [];

  for (let i = 1; i < points.length - 1; i++) {
    positions.push(...points[0], ...points[i], ...points[i + 1]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A unit sphere clipped by the cell faces in `mask` (−1, 0 or 1 per axis) and closed with
 * flat caps, so a boundary atom shows its half, quarter or eighth share of the cell.
 */
export function cappedSphereGeometry(segments, mask) {
  const sphere = new SphereGeometry(
    1,
    segments,
    Math.max(8, Math.round(segments * 0.65)),
  ).toNonIndexed();
  const positions = sphere.attributes.position.array;
  let triangles = [];

  for (let i = 0; i < positions.length; i += 9) {
    triangles.push([
      Array.from(positions.slice(i, i + 3)),
      Array.from(positions.slice(i + 3, i + 6)),
      Array.from(positions.slice(i + 6, i + 9)),
    ]);
  }

  sphere.dispose();

  for (let axis = 0; axis < 3; axis++) {
    if (!mask[axis]) {
      continue;
    }

    const inward = [0, 0, 0];
    inward[axis] = -mask[axis];
    const clipped = [];
    const capPoints = [];

    for (const triangle of triangles) {
      const polygon = [];

      for (let i = 0; i < 3; i++) {
        const p = triangle[i];
        const q = triangle[(i + 1) % 3];
        const dp = dot(p, inward);
        const dq = dot(q, inward);
        const pInside = dp >= -1e-8;
        const qInside = dq >= -1e-8;

        if (pInside) {
          polygon.push(p);
        }

        if (pInside !== qInside) {
          const crossing = add(p, scale(subtract(q, p), dp / (dp - dq)));
          polygon.push(crossing);
          capPoints.push(crossing);
        }
      }

      for (let i = 1; i < polygon.length - 1; i++) {
        clipped.push([polygon[0], polygon[i], polygon[i + 1]]);
      }
    }

    const unique = new Map(
      capPoints.map((point) => [point.map((value) => value.toFixed(6)).join(","), point]),
    );
    const cap = [...unique.values()];

    if (cap.length > 2) {
      const centroid = scale(cap.reduce(add, [0, 0, 0]), 1 / cap.length);
      const [u, v] = orthonormalFrame(scale(inward, -1));
      cap.sort(
        (first, second) =>
          Math.atan2(dot(subtract(first, centroid), v), dot(subtract(first, centroid), u)) -
          Math.atan2(dot(subtract(second, centroid), v), dot(subtract(second, centroid), u)),
      );

      for (let i = 0; i < cap.length; i++) {
        clipped.push([centroid, cap[i], cap[(i + 1) % cap.length]]);
      }
    }

    triangles = clipped;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(triangles.flat(2), 3));
  geometry.computeVertexNormals();
  return geometry;
}
