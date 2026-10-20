import { connectDemoFrame } from './frame';

const canvas = document.querySelector<HTMLCanvasElement>('#drawing')!;
const context = canvas.getContext('2d', { willReadFrequently: true });
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
const prediction = document.querySelector<HTMLElement>('.prediction')!;
const status = document.querySelector<HTMLElement>('#status')!;
const workspace = document.querySelector<HTMLElement>('.workspace')!;
const rows = Array.from(
  document.querySelectorAll<HTMLElement>('[data-digit]'),
  (row) => ({
    row,
    meter: row.querySelector('meter')!,
    score: row.querySelector('.score')!,
  }),
);
const worker = new Worker(
  new URL('./neural-network.worker.ts', import.meta.url),
  { type: 'module' },
);
let ready = false;
let drawing = false;
let pointerId: number | undefined;
let requestId = 0;
let scheduled = 0;
let busy = false;
let queued: Float64Array | undefined;

function resetScores() {
  prediction.textContent = 'Draw a digit';
  rows.forEach(({ row, meter, score }) => {
    row.removeAttribute('data-best');
    meter.value = 0;
    score.textContent = '—';
  });
}

function reset() {
  requestId++;
  queued = undefined;
  if (!context) return;
  context.fillStyle = '#111';
  context.fillRect(0, 0, 280, 280);
  resetScores();
}

function normalizedPixels(): Float64Array | undefined {
  if (!context) return;
  const data = context.getImageData(0, 0, 280, 280).data;
  let left = 280,
    top = 280,
    right = -1,
    bottom = -1;
  for (let y = 0; y < 280; y++) {
    for (let x = 0; x < 280; x++) {
      if (data[(y * 280 + x) * 4]! > 40) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) return;
  const small = document.createElement('canvas');
  small.width = small.height = 28;
  const smallContext = small.getContext('2d', { willReadFrequently: true })!;
  smallContext.fillStyle = '#111';
  smallContext.fillRect(0, 0, 28, 28);
  const width = right - left + 1,
    height = bottom - top + 1;
  const scale = 20 / Math.max(width, height);
  smallContext.drawImage(
    canvas,
    left,
    top,
    width,
    height,
    (28 - width * scale) / 2,
    (28 - height * scale) / 2,
    width * scale,
    height * scale,
  );
  const smallData = smallContext.getImageData(0, 0, 28, 28).data;
  const pixels = new Float64Array(784);
  let mass = 0,
    centerX = 0,
    centerY = 0;
  for (let i = 0; i < 784; i++) {
    const value = Math.max(0, (smallData[i * 4]! - 17) / 238);
    pixels[i] = value;
    mass += value;
    centerX += (i % 28) * value;
    centerY += Math.floor(i / 28) * value;
  }
  if (!mass) return;
  const dx = Math.round(13.5 - centerX / mass),
    dy = Math.round(13.5 - centerY / mass);
  const centered = new Float64Array(784);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const sx = x - dx,
        sy = y - dy;
      if (sx >= 0 && sx < 28 && sy >= 0 && sy < 28)
        centered[y * 28 + x] = pixels[sy * 28 + sx]!;
    }
  }
  return centered;
}

function send(pixels: Float64Array) {
  requestId++;
  if (busy) {
    queued = pixels;
    return;
  }
  busy = true;
  worker.postMessage({ type: 'predict', id: requestId, pixels });
}

function schedulePrediction() {
  if (scheduled || !ready) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    const pixels = normalizedPixels();
    if (pixels) send(pixels);
  });
}

function point(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * 280) / rect.width,
    y: ((event.clientY - rect.top) * 280) / rect.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!ready || !context || event.button !== 0 || drawing) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  drawing = true;
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  const { x, y } = point(event);
  context.strokeStyle = '#fff';
  context.lineWidth = 18;
  context.lineCap = context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 0.01, y + 0.01);
  context.stroke();
  schedulePrediction();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drawing || event.pointerId !== pointerId || !context) return;
  const { x, y } = point(event);
  context.lineTo(x, y);
  context.stroke();
  schedulePrediction();
});

function stop(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  drawing = false;
  pointerId = undefined;
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  schedulePrediction();
}
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);
canvas.addEventListener('lostpointercapture', stop);
canvas.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' ||
    event.key === 'Delete' ||
    event.key === 'Backspace'
  ) {
    event.preventDefault();
    reset();
  }
});
clear.addEventListener('click', reset);

worker.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.type === 'ready') {
    ready = true;
    clear.disabled = false;
    workspace.setAttribute('aria-busy', 'false');
    status.textContent = '';
    status.hidden = true;
    resetScores();
  } else if (message.type === 'prediction') {
    busy = false;
    if (message.id === requestId) {
      const scores = message.scores as Float64Array;
      const best = scores.indexOf(Math.max(...scores));
      prediction.textContent = `Prediction: ${best}`;
      rows.forEach(({ row, meter, score }, digit) => {
        row.toggleAttribute('data-best', digit === best);
        meter.value = scores[digit]!;
        score.textContent = `${Math.round(scores[digit]! * 100)}%`;
      });
    }
    if (queued) {
      const pixels = queued;
      queued = undefined;
      send(pixels);
    }
  } else if (message.type === 'error') {
    fail();
  }
};

function fail() {
  ready = false;
  busy = false;
  queued = undefined;
  clear.disabled = true;
  workspace.setAttribute('aria-busy', 'false');
  prediction.textContent = 'Demo unavailable';
  status.hidden = false;
  status.textContent =
    'The model could not load. Reload the page to try again.';
  worker.terminate();
}
worker.onerror = fail;
reset();
if (context && typeof WebAssembly !== 'undefined') {
  worker.postMessage({
    type: 'init',
    base: new URL('/demos/neural-network/', location.origin).href,
  });
} else {
  fail();
}

connectDemoFrame();
window.addEventListener('pagehide', () => {
  worker.terminate();
  cancelAnimationFrame(scheduled);
});
