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

Prediction runs in a Web Worker using Rust compiled to WebAssembly. The UI uses a
canvas with pointer input. Drawings are fitted to a 20×20 box in a 28×28 image,
centered by their intensity, and normalized before prediction. Drawings stay local.

The model follows the report's MLP: 784 → 256 → 256 → 10, ReLU in each hidden
layer, softmax output, cross entropy, SGD with learning rate 0.04, batch size 100,
and 15 epochs. Its weights were trained for this browser demo; they are not the
original experiment's weights. `model-info.json` records the exported model's score
on all 10,000 held-out MNIST test images. No augmentation is applied in this training run.

The original library is vendored from
[`3bad77a`](https://github.com/dirdr/neural_network_from_scratch/tree/3bad77a01a17f817071cf21b7090eabe0805e035/nn_lib).
Its licenses are included. Changes add dense parameter loading/export and disable
native threading for WebAssembly. Prediction and training use the original layer code.

### Build

Install Rust through Rustup, the `wasm32-unknown-unknown` target, and `wasm-pack`.

```sh
rustup target add wasm32-unknown-unknown
npm run build:wasm
```

The generated JS and Wasm files are checked in, so regular `npm run build` and
hosting do not need Rust. Rebuild them when Rust code changes.

### Train and export

Use the four uncompressed MNIST IDX files (`train-*` and `t10k-*`). The dataset is
not shipped with the website. Run from the repository root:

```sh
cargo run --release --manifest-path wasm/neural-network/Cargo.toml --bin train -- /path/to/mnist/raw public/demos/neural-network 15
cargo test --manifest-path wasm/neural-network/Cargo.toml
```

Training replaces `model.bin`, `model-info.json`, and `examples.bin`. The binary
format starts with `MNP1`, followed by little-endian f64 weights and biases for
each dense layer in row-major order. Loading rejects unexpected lengths and
non-finite parameters. The examples contain one held-out image per digit.

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
