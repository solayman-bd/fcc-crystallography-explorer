import assert from "node:assert/strict";
import { test } from "node:test";
import { SphereGeometry } from "three";
import { cappedSphereGeometry } from "../src/visualization/geometry.js";

/** Volume enclosed by a triangle soup (divergence theorem). */
function meshVolume(geometry) {
  const p = (geometry.index ? geometry.toNonIndexed() : geometry).attributes.position.array;
  let volume = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.slice(i, i + 9);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(volume);
}

test("capped boundary spheres hold a half, quarter and eighth of the volume", () => {
  const segments = 48;
  const full = meshVolume(new SphereGeometry(1, segments, Math.round(segments * 0.65)));
  for (const [mask, share] of [
    [[0, 0, -1], 1 / 2],
    [[1, 0, -1], 1 / 4],
    [[-1, 1, 1], 1 / 8],
  ]) {
    const ratio = meshVolume(cappedSphereGeometry(segments, mask)) / full;
    assert.ok(Math.abs(ratio - share) < 0.01 * share + 0.002, `mask ${mask}: ${ratio} vs ${share}`);
  }
});
