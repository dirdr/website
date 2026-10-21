# Browser demos

Place a demo widget anywhere in a project's Markdown:

```html
<web-demo
  data-src="/demos/neural-network/"
  data-title="Draw a digit"
></web-demo>
```

Write normal Markdown before or after the widget. Each demo is an isolated page under
`src/pages/demos/`. Static binaries and model files live in `public/demos/`.
The shared `WebDemo.astro` component embeds the page and synchronizes its height
and theme. Future demos, including Épic Drawing, can use the same component.

The embedded page sends `{ type: 'demo:resize', height }` to its parent and receives
`{ type: 'demo:theme', theme: 'light' | 'dark' }`. Both sides validate the sender's
origin and window. Demo workers and animation loops must stop when their page closes.

## Neural network

The browser loads the saved weights from `model.bin` and the Rust WebAssembly
module in a Web Worker. TypeScript converts each drawing into a centered 28×28
image, then Rust runs the 784 → 128 → 10 network and returns ten scores for
the histogram. All inference stays on the visitor's device; no training runs.

The adapter uses the upstream [`nn_lib`](https://github.com/AlexVplle/nn_lib/tree/b57ac76b2306b9ec418e0cc4ddbb62cfc8fa846f),
pinned to the latest revision checked during this update. Cargo downloads the
library when rebuilding Wasm; its source is not copied into this repository.
The weights were retrained with that upstream revision on 50,000 MNIST training
images. The best checkpoint was selected from 20 epochs using 10,000 separate
validation images; the final model scores 97.73% on the untouched 10,000-image
test set. Training used cross entropy, SGD (learning rate 0.12), batches of 100,
and no augmentation. Training code and datasets remain outside this repository.

`model.bin` is 102,740 bytes. Its `MNQ1` format stores each dense layer's per-output
f32 scales, f32 biases, and signed 8-bit weights in row-major order. The adapter
decodes weights to upstream f32 tensors once at startup; inference itself uses
f32 arithmetic. This reduces the former 2,154,580-byte weight file by 95.2%.

Install Rust, the `wasm32-unknown-unknown` target, and `wasm-pack`, then run:

```sh
rustup target add wasm32-unknown-unknown
npm run build:wasm
```

The generated JavaScript and Wasm are checked in. Regular website builds and
hosting need no Rust toolchain or GitHub access. The ten held-out images in
`scripts/fixtures/mnist-examples.bin` are used only by the inference tests.

## Molecular visualization

The molecular demo uses WebGL 2 directly. It ports the original instanced sphere
and cylinder impostor shaders from GLSL 410 to GLSL ES 300. PDB parsing, CPK colors,
atomic radii, centering, scaling, and arcball rotation follow the native project.
Only explicit `CONECT` bonds are rendered; bonds are not inferred from distances.

The shaders and seven PDB examples come from
[`24b8a17`](https://github.com/dirdr/molecular_visualization/tree/24b8a17c391f0f22f3350feff5b79c2b1d33b484).
Licenses are included in `public/demos/molecular-visualization/`. Shader changes
add browser precision declarations and handle bonds aligned with the view direction.
Rendering runs only after input or resizing. The page releases GPU resources when
closed and handles WebGL context loss and restoration.

Choose the PDB file in Markdown:

```html
<web-demo
  data-src="/demos/molecular-visualization/"
  data-molecule="/demos/molecular-visualization/pdb/methane.pdb"
  data-title="Molecular Visualization"
></web-demo>
```

The widget shows only the canvas. Drag to rotate, scroll to zoom, or use arrow
keys and +/−. The `R` key resets the view. PDB files must be hosted on this site.
