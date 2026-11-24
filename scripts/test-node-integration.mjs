import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { createServer } from 'node:net';
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const directory = mkdtempSync(join(tmpdir(), 'entre-nos-test-'));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_PATH: join(directory, 'test.sqlite'),
  PORT: String(port),
  HOSTNAME: '127.0.0.1',
  APP_ORIGIN: base,
  TRUST_PROXY: 'false',
  SERPAPI_KEY: '',
  RESEND_API_KEY: '',
  MAIL_FROM: '',
  TEST_BASE_URL: base,
};
const server = spawn(process.execPath, ['.next/standalone/server.js'], { env, stdio: 'inherit' });
const stopped = new Promise((resolve) => server.once('exit', resolve));
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Test exited ${code}`)),
    );
  });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Server exited before health check');
    try {
      if ((await fetch(base + '/api/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Server failed health check');
  await run(['tests/integration.mjs']);
  await run(['tests/categories-integration.mjs']);
  if (process.argv.includes('--browser'))
    await run([resolve('node_modules/@playwright/test/cli.js'), 'test']);
} finally {
  server.kill();
  await stopped;
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !basename(directory).startsWith('entre-nos-test-'))
    throw new Error('Unexpected temporary directory; cleanup refused');
  rmSync(directory, { recursive: true, force: true });
}
