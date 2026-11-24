import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

if (!existsSync('dist/server/wrangler.json')) {
  throw new Error('Execute npm run setup antes de iniciar o build de produção.');
}
const args = process.argv.slice(2);
const cli = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(cli),
    'dev',
    '--config',
    'dist/server/wrangler.json',
    '--local',
    '--persist-to',
    '.wrangler/state',
    '--ip',
    '127.0.0.1',
    '--inspector-port',
    '0',
    ...(existsSync('.dev.vars') ? ['--env-file', resolve('.dev.vars')] : []),
    ...args,
  ],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
