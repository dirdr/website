import { connectDemoFrame } from './frame';
import { parsePdb, type Molecule, type Vec3 } from './molecular/molecule-data';
import { MoleculeRenderer } from './molecular/renderer';
import {
  arcball,
  multiply,
  rotationBetween,
  type Quaternion,
} from './molecular/transforms';

const canvas = document.querySelector<HTMLCanvasElement>('#molecular-canvas')!;
const status = document.querySelector<HTMLElement>('#molecule-status')!;
const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: true,
  preserveDrawingBuffer: true,
});
let renderer: MoleculeRenderer | undefined;
let molecule: Molecule | undefined;
let rotation: Quaternion = [0, 0, 0, 1];
let distance = 7,
  homeDistance = 7,
  scheduled = 0;
let drag: { id: number; start: Vec3; rotation: Quaternion } | undefined;
let request: AbortController | undefined;
let active = true;

function schedule() {
  if (scheduled || !active) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    if (!renderer || !molecule || gl?.isContextLost()) return;
    const rect = canvas.getBoundingClientRect(),
      ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio)),
      height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    renderer.draw(width, height, rotation, distance);
  });
}

function resetView() {
  rotation = [0, 0, 0, 1];
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const halfAngle = Math.atan(Math.tan(Math.PI / 8) * Math.min(1, aspect));
  homeDistance = ((molecule?.radius ?? 2) / Math.sin(halfAngle)) * 1.12;
  distance = homeDistance;
  schedule();
}

function zoom(factor: number) {
  distance = Math.max(
    (molecule?.radius ?? 1) * 1.15,
    Math.min(homeDistance * 6, distance * factor),
  );
  schedule();
}

async function load() {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  status.textContent = 'Loading molecule…';
  status.hidden = false;
  try {
    const path =
      new URLSearchParams(location.search).get('molecule') ??
      '/demos/molecular-visualization/pdb/methane.pdb';
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin)
      throw new Error('Molecule files must be hosted on this site.');
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Could not load this molecule.');
    const parsed = parsePdb(await response.text());
    if (!active || controller.signal.aborted) return;
    molecule = parsed;
    renderer!.setMolecule(parsed);
    resetView();
    status.textContent = '';
    status.hidden = true;
  } catch (error) {
    if (controller.signal.aborted || !active) return;
    status.textContent =
      error instanceof Error ? error.message : 'Could not load this molecule.';
  }
}

function projected(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return arcball(
    event.clientX - rect.left,
    event.clientY - rect.top,
    rect.width,
    rect.height,
  );
}

canvas.addEventListener('pointerdown', (event) => {
  if (!molecule || event.button !== 0 || drag) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  drag = { id: event.pointerId, start: projected(event), rotation };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  rotation = multiply(
    rotationBetween(drag.start, projected(event)),
    drag.rotation,
  );
  schedule();
});
function stop(event: PointerEvent) {
  if (event.pointerId !== drag?.id) return;
  drag = undefined;
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);
canvas.addEventListener('lostpointercapture', stop);
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    zoom(Math.exp(Math.max(-200, Math.min(200, event.deltaY)) * 0.002));
  },
  { passive: false },
);
canvas.addEventListener('keydown', (event) => {
  const rotations: Record<string, Quaternion> = {
    ArrowLeft: [0, -Math.sin(0.08), 0, Math.cos(0.08)],
    ArrowRight: [0, Math.sin(0.08), 0, Math.cos(0.08)],
    ArrowUp: [-Math.sin(0.08), 0, 0, Math.cos(0.08)],
    ArrowDown: [Math.sin(0.08), 0, 0, Math.cos(0.08)],
  };
  const turn = rotations[event.key];
  if (turn) {
    event.preventDefault();
    rotation = multiply(turn, rotation);
    schedule();
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    zoom(0.85);
  } else if (event.key === '-') {
    event.preventDefault();
    zoom(1.15);
  } else if (event.key.toLowerCase() === 'r') resetView();
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  status.hidden = false;
  status.textContent = 'Graphics context lost. Waiting to restore it…';
});
canvas.addEventListener('webglcontextrestored', () => {
  try {
    renderer = new MoleculeRenderer(gl!);
    if (molecule) {
      renderer.setMolecule(molecule);
      status.textContent = '';
      status.hidden = true;
      schedule();
    }
  } catch {
    status.hidden = false;
    status.textContent =
      'Could not restore the renderer. Reload the page to try again.';
  }
});
const observer = new ResizeObserver(schedule);
observer.observe(canvas);
connectDemoFrame();
window.addEventListener(
  'pagehide',
  () => {
    active = false;
    request?.abort();
    cancelAnimationFrame(scheduled);
    observer.disconnect();
    renderer?.dispose();
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  },
  { once: true },
);

if (!gl) {
  status.textContent = 'WebGL 2 is unavailable in this browser.';
} else {
  try {
    renderer = new MoleculeRenderer(gl);
    void load();
  } catch (error) {
    console.error(error);
    status.textContent = 'Could not start the renderer.';
  }
}
