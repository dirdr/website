import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parsePdb } from '../src/scripts/demos/molecular/molecule-data.ts';
import {
  arcball,
  rotationBetween,
  rotationMatrix,
} from '../src/scripts/demos/molecular/transforms.ts';

const base = new URL(
  '../public/demos/molecular-visualization/pdb/',
  import.meta.url,
);
const methane = await readFile(new URL('methane.pdb', base), 'utf8');

test('PDB parser preserves atoms and deduplicates explicit bonds', () => {
  const molecule = parsePdb(methane);
  assert.equal(molecule.atoms.length, 5);
  assert.equal(molecule.bonds.length, 4);
  assert.equal(molecule.atoms[0].radius, 1.7 * 0.25);
  assert.deepEqual(molecule.atoms[1].color, [1, 1, 1, 1]);
  const noBonds = parsePdb(
    methane
      .split('\n')
      .filter((line) => !line.startsWith('CONECT'))
      .join('\n'),
  );
  assert.equal(noBonds.bonds.length, 0);
  assert.throws(() => parsePdb('not a PDB file'), /No readable atoms/);
});

test('all supplied molecules have finite, centered geometry and valid unique bonds', async () => {
  for (const name of [
    'methane',
    'caffeine',
    'glucose',
    'atp',
    'ethylene',
    'propane',
    'complex',
  ]) {
    const molecule = parsePdb(
      await readFile(new URL(`${name}.pdb`, base), 'utf8'),
    );
    assert.ok(molecule.atoms.length > 0);
    assert.ok(Number.isFinite(molecule.radius) && molecule.radius > 0);
    const center = [0, 0, 0];
    for (const atom of molecule.atoms) {
      assert.ok(atom.position.every(Number.isFinite));
      atom.position.forEach((v, i) => (center[i] += v / molecule.atoms.length));
    }
    assert.ok(center.every((v) => Math.abs(v) < 1e-8));
    const bonds = new Set();
    for (const [a, b] of molecule.bonds) {
      assert.notEqual(a.id, b.id);
      const key = [a.id, b.id].sort((x, y) => x - y).join(':');
      assert.ok(!bonds.has(key));
      bonds.add(key);
    }
  }
});

test('arcball produces a finite rotation without changing molecule scale', () => {
  const a = arcball(200, 200, 700, 450),
    b = arcball(500, 100, 700, 450);
  const q = rotationBetween(a, b);
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-8);
  const matrix = rotationMatrix(q);
  for (const i of [0, 4, 8])
    assert.ok(Math.abs(Math.hypot(...matrix.slice(i, i + 3)) - 1) < 1e-6);
  assert.deepEqual(
    [...rotationMatrix([0, 0, 0, 1])],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
});
