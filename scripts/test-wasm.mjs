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
  readFile(new URL('examples.bin', base)),
]);
initSync({ module: wasm });

test('Rust WebAssembly recognizes all ten held-out examples', () => {
  const model = new DigitModel(weights);
  try {
    for (let digit = 0; digit < 10; digit++) {
      const pixels = Float64Array.from(
        examples.subarray(digit * 784, (digit + 1) * 784),
        (v) => v / 255,
      );
      const scores = model.predict(pixels);
      assert.equal(scores.length, 10);
      assert.ok(scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(Math.abs(scores.reduce((a, b) => a + b, 0) - 1) < 1e-8);
      assert.equal(scores.indexOf(Math.max(...scores)), digit);
    }
  } finally {
    model.free();
  }
});

test('WebAssembly rejects invalid weights and pixel data', () => {
  assert.throws(() => new DigitModel(weights.subarray(0, 100)));
  const model = new DigitModel(weights);
  try {
    assert.throws(() => model.predict(new Float64Array(783)));
    for (const value of [NaN, Infinity, -1, 2]) {
      const pixels = new Float64Array(784);
      pixels[0] = value;
      assert.throws(() => model.predict(pixels));
    }
  } finally {
    model.free();
  }
});
