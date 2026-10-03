/**
 * Vector and integer helpers shared by the crystallography modules.
 * Vectors are plain [x, y, z] arrays; nothing here depends on the renderer.
 */

/** Component-wise vector arithmetic. */
export const add = (a, b) => a.map((value, index) => value + b[index]);
export const subtract = (a, b) => a.map((value, index) => value - b[index]);
export const scale = (vector, factor) => vector.map((value) => value * factor);
export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (vector) => Math.sqrt(dot(vector, vector));

/** Unit vector; throws for a zero vector. */
export const normalize = (vector) => {
  if (norm(vector) < 1e-10) {
    throw new Error("A zero vector has no direction.");
  }
  return scale(vector, 1 / norm(vector));
};

/** a · (b × c): the signed volume spanned by three vectors. */
export const tripleProduct = (a, b, c) => dot(a, cross(b, c));

/** Modulo with the sign of the modulus. */
export const mod = (value, modulus) => ((value % modulus) + modulus) % modulus;

/** Greatest common divisor of two integers (always ≥ 0). */
export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b) {
    [a, b] = [b, a % b];
  }

  return a;
};

export const gcdOf = (values) => values.reduce(gcd, 0);
export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/** Angle in degrees. With `unoriented`, the acute angle between lines or plane normals. */
export const angleBetween = (a, b, unoriented = false) =>
  (Math.acos(clamp((unoriented ? Math.abs(dot(a, b)) : dot(a, b)) / (norm(a) * norm(b)), -1, 1)) *
    180) /
  Math.PI;

/** Round for display; non-finite values print as ∞. */
export const formatNumber = (value, digits = 4) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : "∞";
export const formatVector = (vector, digits = 3) =>
  vector.map((value) => formatNumber(value, digits)).join(" ");

/**
 * Parse Miller or direction indices from text such as "1 -1 0" or "(1, 1, 1)".
 * Accepts three integers within ±24, not all zero.
 */
export function parseIndices(input) {
  const indices = Array.isArray(input)
    ? input
    : String(input)
        .replace(/[()[\]<>]/g, "")
        .trim()
        .split(/[\s,;]+/)
        .map(Number);

  if (
    indices.length !== 3 ||
    !indices.every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 24) ||
    indices.every((value) => value === 0)
  ) {
    throw new Error(
      "Enter three nonzero-direction integer indices, each from −24 to 24; separate them with spaces.",
    );
  }

  return indices.slice();
}

/** Parse three numbers, optionally restricted to integers within [min, max]. */
export function parseTriple(input, min = -100, max = 100, integer = false) {
  const values = Array.isArray(input)
    ? input
    : String(input)
        .trim()
        .split(/[\s,;]+/)
        .map(Number);

  if (
    values.length !== 3 ||
    !values.every(
      (value) =>
        Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        (!integer || Number.isInteger(value)),
    )
  ) {
    throw new Error("Enter three valid coordinates separated by spaces.");
  }

  return values.slice();
}

/** Extended Euclid: returns [g, x, y] with a·x + b·y = g (Bézout identity). */
export function extendedGcd(a, b) {
  if (!b) {
    return [Math.abs(a), a < 0 ? -1 : 1, 0];
  }

  const [g, x, y] = extendedGcd(b, a % b);
  return [g, y, x - Math.trunc(a / b) * y];
}

/**
 * All cubic-symmetry variants of an index triple (permutations and sign changes).
 * Unless `oriented`, v and −v count once: the first nonzero component is made positive.
 */
export function cubicFamily(indices, oriented = false) {
  const unique = new Map();

  for (const order of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let variant = [indices[order[0]] * sx, indices[order[1]] * sy, indices[order[2]] * sz];

          if (!oriented && variant.find((value) => value !== 0) < 0) {
            variant = scale(variant, -1);
          }

          unique.set(variant.join(","), variant);
        }
      }
    }
  }

  return [...unique.values()];
}

/** Right-handed orthonormal frame [u, v, w] with w along `normal`. */
export function orthonormalFrame(normal) {
  const w = normalize(normal);
  const u = normalize(cross(Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], w));
  return [u, cross(w, u), w];
}
