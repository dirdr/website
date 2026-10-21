The molecular viewers run the upstream Rust application through WebAssembly and
WebGL 2. The portfolio only selects a PDB file and mounts the canvas. Parsing,
molecule preparation, camera matrices, arcball rotation, rendering, and shaders
come from the upstream package; there is no parallel TypeScript renderer.

`scripts/molecular-upstream.json` pins the source revision. Update that revision
and run `npm run build:wasm:molecular` to fetch the upstream source, build it with
its lockfile, and refresh the generated browser package, embedding helper, PDB
files, and licenses. The temporary source checkout is removed after the build.
Visitors load the generated files from this website, without contacting GitHub.
Normal website builds use the checked-in assets and do not need Rust or network
access.

Each Markdown `<web-demo>` selects its molecule with `data-molecule`. The
upstream helper handles input, resizing, and context restoration; the portfolio
reports errors and disposes the viewer when its frame closes.
