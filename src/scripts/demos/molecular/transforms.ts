import type { Vec3 } from './molecule-data';

export type Quaternion = [number, number, number, number];

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a,
    [u, v, s, t] = b;
  return [
    w * u + x * t + y * s - z * v,
    w * v - x * s + y * t + z * u,
    w * s + x * v - y * u + z * t,
    w * t - x * u - y * v - z * s,
  ];
}

export function arcball(
  x: number,
  y: number,
  width: number,
  height: number,
): Vec3 {
  const res = Math.max(1, Math.min(width, height) - 1);
  const nx = (2 * x - width - 1) / res,
    ny = -(2 * y - height - 1) / res;
  const d = nx * nx + ny * ny;
  const z = 2 * d <= 0.25 ? Math.sqrt(0.25 - d) : 0.25 / (2 * Math.sqrt(d));
  const length = Math.hypot(nx, ny, z);
  return [nx / length, ny / length, z / length];
}

export function rotationBetween(a: Vec3, b: Vec3): Quaternion {
  const cross: Vec3 = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const w = 1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = Math.hypot(...cross, w);
  if (norm < 1e-8) return [0, 1, 0, 0];
  return [cross[0] / norm, cross[1] / norm, cross[2] / norm, w / norm];
}

export function rotationMatrix(q: Quaternion) {
  const length = Math.hypot(...q);
  const [x, y, z, w] = q.map((v) => v / length) as Quaternion;
  return new Float32Array([
    1 - 2 * (y * y + z * z),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    0,
    2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    0,
    2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
    0,
    0,
    0,
    0,
    1,
  ]);
}

export function perspective(aspect: number, distance: number) {
  const f = 1 / Math.tan(Math.PI / 8),
    near = 0.01,
    far = distance + 100;
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ]);
}

export function viewMatrix(distance: number) {
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    -distance,
    1,
  ]);
}
