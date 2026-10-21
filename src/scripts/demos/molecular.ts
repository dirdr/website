import { connectDemoFrame } from './frame';
import type { mountMolecule } from '../../../public/demos/molecular-visualization/viewer';

const canvas = document.querySelector<HTMLCanvasElement>('#molecular-canvas')!;
const status = document.querySelector<HTMLElement>('#molecule-status')!;
const controller = new AbortController();
let dispose: (() => void) | undefined;

connectDemoFrame();
window.addEventListener(
  'pagehide',
  () => {
    controller.abort();
    dispose?.();
  },
  { once: true },
);

function showError(error: unknown) {
  status.textContent =
    error instanceof Error ? error.message : String(error ?? '');
  status.hidden = !error;
}

async function load() {
  try {
    const path =
      new URLSearchParams(location.search).get('molecule') ??
      '/demos/molecular-visualization/pdb/methane.pdb';
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin)
      throw new Error('Molecule files must be hosted on this site.');
    const moduleUrl = `${location.origin}/demos/molecular-visualization/viewer.js`;
    const [module, response] = await Promise.all([
      import(/* @vite-ignore */ moduleUrl) as Promise<{
        mountMolecule: typeof mountMolecule;
      }>,
      fetch(url, { signal: controller.signal }),
    ]);
    if (!response.ok) throw new Error('Could not load this molecule.');
    const pdb = await response.text();
    if (controller.signal.aborted) return;
    dispose = await module.mountMolecule(canvas, pdb, showError);
    if (controller.signal.aborted) dispose();
    else showError(null);
  } catch (error) {
    if (!controller.signal.aborted) showError(error);
  }
}

void load();
