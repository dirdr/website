import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  DigitModel,
  initSync,
} from '../public/demos/neural-network/pkg/portfolio_mnist.js';

const base = new URL('../public/demos/neural-network/', import.meta.url);
const [wasm, weights, examples] = await Promise.all([
  readFile(new URL('pkg/portfolio_mnist_bg.wasm', base)),
  readFile(new URL('model.bin', base)),
  readFile(new URL('fixtures/mnist-examples.bin', import.meta.url)),
]);
initSync({ module: wasm });

test('Rust WebAssembly classifies at least nine of ten held-out digits', () => {
  const model = new DigitModel(weights);
  try {
    let correct = 0;
    for (let digit = 0; digit < 10; digit++) {
      const pixels = Float32Array.from(
        examples.subarray(digit * 784, (digit + 1) * 784),
        (v) => v / 255,
      );
      const scores = model.predict(pixels);
      assert.equal(scores.length, 10);
      assert.ok(scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(Math.abs(scores.reduce((a, b) => a + b, 0) - 1) < 1e-6);
      correct += Number(scores.indexOf(Math.max(...scores)) === digit);
    }
    assert.ok(correct >= 9, `${correct}/10 digits recognized`);
  } finally {
    model.free();
  }
});

test('WebAssembly rejects invalid weights and pixel data', () => {
  for (const length of [0, 3, 100, weights.length - 1]) {
    assert.throws(() => new DigitModel(weights.subarray(0, length)));
  }
  const wrongHeader = Uint8Array.from(weights);
  wrongHeader[0] = 0;
  assert.throws(() => new DigitModel(wrongHeader));
  for (const value of [NaN, Infinity, 0, -1]) {
    const invalid = Uint8Array.from(weights);
    new DataView(invalid.buffer, invalid.byteOffset).setFloat32(4, value, true);
    assert.throws(() => new DigitModel(invalid));
  }
  const model = new DigitModel(weights);
  try {
    assert.throws(() => model.predict(new Float32Array(783)));
    for (const value of [NaN, Infinity, -1, 2]) {
      const pixels = new Float32Array(784);
      pixels[0] = value;
      assert.throws(() => model.predict(pixels));
    }
  } finally {
    model.free();
  }
});
