import { spawnSync } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  'wasm-pack',
  [
    'build',
    'wasm/neural-network',
    '--release',
    '--target',
    'web',
    '--out-dir',
    '../../public/demos/neural-network/pkg',
    '--no-pack',
    '--locked',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${join(homedir(), '.cargo', 'bin')}${delimiter}${process.env.PATH ?? ''}`,
    },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await unlink(join(root, 'public/demos/neural-network/pkg/.gitignore')).catch(
  (error) => {
    if (error.code !== 'ENOENT') throw error;
  },
);
