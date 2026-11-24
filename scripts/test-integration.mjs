import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { configureToolEnvironment } from './tool-environment.mjs';

configureToolEnvironment(process.cwd());
const root = process.cwd();
const built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
mkdirSync(join(root, '.wrangler'), { recursive: true });
const directory = mkdtempSync(join(root, '.wrangler/integration-'));
const config = join(directory, 'wrangler.json');
const state = join(directory, 'state');
const emptyEnv = join(directory, '.env');
writeFileSync(emptyEnv, '');
writeFileSync(
  config,
  JSON.stringify({
    name: 'entre-nos-test',
    main: resolve('dist/server/index.js'),
    compatibility_date: built.compatibility_date,
    compatibility_flags: ['nodejs_compat'],
    no_bundle: true,
    rules: built.rules,
    assets: { directory: resolve('dist/client') },
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'entre-nos-test',
        database_id: '00000000-0000-4000-8000-000000000000',
        migrations_dir: resolve('drizzle'),
      },
    ],
  }),
);
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const env = { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' };
for (const key of ['SERPAPI_KEY', 'RESEND_API_KEY', 'MAIL_FROM']) delete env[key];
function run(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${args[0]}`);
}
run([
  wrangler,
  'd1',
  'migrations',
  'apply',
  'DB',
  '--local',
  '--config',
  config,
  '--persist-to',
  state,
]);
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
let output = '';
const server = spawn(
  process.execPath,
  [
    wrangler,
    'dev',
    '--local',
    '--config',
    config,
    '--persist-to',
    state,
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--inspector-port',
    '0',
    '--env-file',
    emptyEnv,
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);
server.stdout.on('data', (chunk) => {
  output = (output + chunk).slice(-20000);
});
server.stderr.on('data', (chunk) => {
  output = (output + chunk).slice(-20000);
});
server.on('error', (error) => {
  output += error.message;
});
try {
  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await fetch(base + '/api/state')).ok;
    } catch {
      /* Still starting. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!ready) throw new Error('Test server did not start.\n' + output);
  run(['tests/integration.mjs'], { TEST_BASE_URL: base });
  if (process.argv.includes('--browser')) {
    run(['node_modules/@playwright/test/cli.js', 'test'], { TEST_BASE_URL: base });
  }
  console.log('PASS: isolated production Worker and D1. Test state: ' + directory);
} finally {
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once('close', resolve);
  });
}
