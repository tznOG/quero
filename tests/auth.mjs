import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real auth module with SQLite transactions and a fake mail transport.
// No account, provider key, email or remote database is used.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const name of readdirSync('drizzle')
  .filter((name) => name.endsWith('.sql'))
  .sort())
  sqlite.exec(readFileSync('drizzle/' + name, 'utf8'));
function statement(sql, args = []) {
  return {
    bind(...values) {
      return statement(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...args) || null;
    },
    execute() {
      const result = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(result.changes) } };
    },
    async run() {
      return this.execute();
    },
  };
}
globalThis.__authTestEnv = {
  DB: {
    prepare: statement,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map((s) => s.execute());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  },
  RESEND_API_KEY: 'fake-test-key',
  MAIL_FROM: 'test@example.test',
};
const compile = (file) =>
  ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const moduleUrl = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = compile('lib/auth.ts')
  .replace(/import \{ env \} from ['"]\.\/env['"];?/, 'const env=globalThis.__authTestEnv;')
  .replace(/['"]\.\/public-origin['"]/, JSON.stringify(moduleUrl(compile('lib/public-origin.ts'))))
  .replace(/['"]\.\/validation['"]/, JSON.stringify(moduleUrl(compile('lib/validation.ts'))));
const { authAction, getAccount, hashToken } = await import(moduleUrl(source));
let cookie = '';
process.env.APP_ORIGIN = 'https://quero.tznog.com';
const request = () => new Request('http://entre-nos:3000/api/auth', { headers: { cookie } });
const action = (name, body) => authAction(request(), name, body);
const password = 'Initial safe password 2026';
let mail;
const originalFetch = globalThis.fetch;
try {
  const signup = await action('signup', { email: 'ana@example.test', name: 'Ana', password });
  cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.match(signup.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal((await getAccount(request())).name, 'Ana');
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    mail = JSON.parse(options.body);
    return Response.json({ id: 'fake-message' });
  };
  await action('reset-request', { email: 'ana@example.test' });
  const resetUrl = new URL(mail.text.match(/https:\/\/\S+/)[0]);
  assert.equal(resetUrl.origin, 'https://quero.tznog.com');
  const token = resetUrl.searchParams.get('reset');
  assert.equal(token.length, 64);
  const row = sqlite.prepare('SELECT token_hash FROM password_resets').get();
  assert.equal(row.token_hash, await hashToken(token));
  assert.notEqual(row.token_hash, token);
  const results = await Promise.allSettled([
    action('reset', { token, password: password + ' first' }),
    action('reset', { token, password: password + ' second' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await getAccount(request()), null);
  await assert.rejects(action('reset', { token, password }), { status: 400 });
  const winner = results[0].status === 'fulfilled' ? password + ' first' : password + ' second';
  await assert.rejects(action('login', { email: 'ana@example.test', password }), { status: 401 });
  const login = await action('login', { email: 'ana@example.test', password: winner });
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await getAccount(request())).name, 'Ana');
  // Failed mail delivery must remove the unusable reset token.
  globalThis.fetch = async () => Response.json({ error: 'failure' }, { status: 500 });
  await assert.rejects(action('reset-request', { email: 'ana@example.test' }), { status: 502 });
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM password_resets').get().count, 0);
  await action('reset-request', { email: 'unknown@example.test' });
  process.env.PRIVATE_ORIGINS = 'http://homelab.tail86b1f4.ts.net:3080';
  const privateLogin = await authAction(
    new Request('http://container:3000/api/auth', {
      headers: { host: 'homelab.tail86b1f4.ts.net:3080' },
    }),
    'login',
    { email: 'ana@example.test', password: winner },
  );
  assert.match(privateLogin.headers.get('set-cookie'), /Secure/);
  assert.match(privateLogin.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax/);
  console.log(
    'PASS: reset mail payload, hashed token storage, single-use concurrent reset, session revocation and mail failure cleanup.',
  );
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__authTestEnv;
  delete process.env.APP_ORIGIN;
  delete process.env.PRIVATE_ORIGINS;
  sqlite.close();
}
