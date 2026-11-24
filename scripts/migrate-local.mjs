import { spawnSync } from 'node:child_process';
import { configureToolEnvironment } from './tool-environment.mjs';
configureToolEnvironment(process.cwd());
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'wrangler.local.json',
    '--persist-to',
    '.wrangler/state',
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
