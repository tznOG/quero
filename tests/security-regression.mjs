import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const asUrl = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const cache = new Map();
function compile(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  if (file === resolve('lib/env.ts')) return asUrl('export const env=globalThis.__securityEnv;');
  let s = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  s = s.replace(
    /from\s+(['"])(\.[^'"]+)\1/g,
    (_, q, p) => 'from ' + JSON.stringify(compile(resolve(dirname(file), p + '.ts'))),
  );
  const url = asUrl(s);
  cache.set(file, url);
  return url;
}
const { SQLiteDatabase } = await import(compile('lib/sqlite.ts'));
const db = new SQLiteDatabase(':memory:');
globalThis.__securityEnv = {
  DB: db,
  RESEND_API_KEY: '',
  MAIL_FROM: '',
  SERPAPI_KEY: '',
};
process.env.APP_ORIGIN = 'https://quero.tznog.com';
const { authAction, getAccount, hashToken, throttle } = await import(compile('lib/auth.ts'));
try {
  const password = 'Synthetic legacy password 2026',
    salt = 'ab'.repeat(32);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const legacy = Buffer.from(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
      },
      material,
      256,
    ),
  ).toString('hex');
  await db
    .prepare(
      'INSERT INTO profiles(id,name,email,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind('synthetic-id', 'Synthetic', 'legacy@example.test', legacy, salt, Date.now())
    .run();
  const request = new Request('https://quero.tznog.com/api/auth/login');
  await assert.rejects(
    authAction(request, 'login', {
      email: 'legacy@example.test',
      password: 'incorrect',
    }),
    { status: 401 },
  );
  const response = await authAction(request, 'login', {
    email: 'legacy@example.test',
    password,
  });
  const upgraded = await db
    .prepare('SELECT password_hash FROM profiles WHERE id=?')
    .bind('synthetic-id')
    .first();
  assert.match(upgraded.password_hash, /^pbkdf2-sha256\$600000\$[a-f0-9]{64}$/);
  await authAction(request, 'login', {
    email: 'legacy@example.test',
    password,
  });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const sessionRequest = new Request('https://quero.tznog.com/api/state', {
    headers: { cookie },
  });
  assert.equal((await getAccount(sessionRequest)).id, 'synthetic-id');
  await db
    .prepare('UPDATE sessions SET last_seen=?')
    .bind(Date.now() - 2 * 86400000)
    .run();
  assert.equal(await getAccount(sessionRequest), null);
  console.log(
    'PASS: legacy PBKDF2 upgrade, new login and 24-hour idle expiry independent of absolute expiry',
  );
  process.env.TRUST_PROXY = 'true';
  delete process.env.ORIGIN_PROXY_ONLY;
  for (const ip of ['198.51.100.1', '198.51.100.2'])
    await throttle(
      new Request(request, { headers: { 'cf-connecting-ip': ip } }),
      'synthetic',
      'legacy@example.test',
      10,
    );
  const bucket = await db
    .prepare('SELECT count FROM rate_limits WHERE key=?')
    .bind(await hashToken('synthetic:ip:local'))
    .first();
  assert.equal(bucket.count, 2);
  console.log('PASS: spoofed forwarding headers do not split rate limits without proxy isolation');
} finally {
  db.connection.close();
  delete globalThis.__securityEnv;
}
