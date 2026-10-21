import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = JSON.parse(
  await readFile(new URL('./molecular-upstream.json', import.meta.url), 'utf8'),
);
const checkout = await mkdtemp(join(tmpdir(), 'portfolio-molecular-'));
const destination = join(root, 'public/demos/molecular-visualization');
const env = {
  ...process.env,
  PATH: `${join(homedir(), '.cargo', 'bin')}${delimiter}${process.env.PATH ?? ''}`,
};
const run = (command, args) =>
  execFileSync(command, args, { cwd: checkout, env, stdio: 'inherit' });

try {
  run('git', ['init', '--quiet']);
  run('git', [
    'fetch',
    '--quiet',
    '--depth=1',
    upstream.repository,
    upstream.revision,
  ]);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
  run('wasm-pack', [
    'build',
    '--release',
    '--target',
    'web',
    '--out-dir',
    'web/pkg',
    '--no-pack',
    '--no-default-features',
    '--features',
    'web',
    '--locked',
  ]);
  await mkdir(destination, { recursive: true });
  await mkdir(join(destination, 'pkg'), { recursive: true });
  for (const name of await readdir(join(checkout, 'web/pkg'))) {
    if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.wasm'))
      await cp(join(checkout, 'web/pkg', name), join(destination, 'pkg', name));
  }
  for (const name of ['viewer.js', 'viewer.d.ts'])
    await cp(join(checkout, 'web', name), join(destination, name));
  for (const name of ['LICENSE-MIT', 'LICENSE-APACHE'])
    await cp(join(checkout, name), join(destination, name));
  await cp(join(checkout, 'resources/pdb'), join(destination, 'pdb'), {
    recursive: true,
  });
} finally {
  await rm(checkout, { recursive: true, force: true });
}
