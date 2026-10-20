export {};

interface Model {
  predict(pixels: Float64Array): Float64Array;
}

interface WasmModule {
  default: (options: { module_or_path: URL }) => Promise<unknown>;
  DigitModel: new (bytes: Uint8Array) => Model;
}

let model: Model | undefined;

async function fetchBytes(url: URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url.pathname}`);
  return new Uint8Array(await response.arrayBuffer());
}

self.onmessage = async (event: MessageEvent) => {
  const { type, id } = event.data;
  try {
    if (type === 'init') {
      const base = new URL(event.data.base);
      const moduleUrl = new URL('pkg/portfolio_mnist.js', base).href;
      const [wasm, weights] = await Promise.all([
        import(/* @vite-ignore */ moduleUrl) as Promise<WasmModule>,
        fetchBytes(new URL('model.bin', base)),
      ]);
      await wasm.default({
        module_or_path: new URL('pkg/portfolio_mnist_bg.wasm', base),
      });
      model = new wasm.DigitModel(weights);
      self.postMessage({
        type: 'ready',
      });
    } else if (type === 'predict') {
      if (!model) throw new Error('Model is not ready');
      self.postMessage({
        type: 'prediction',
        id,
        scores: model.predict(event.data.pixels),
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
