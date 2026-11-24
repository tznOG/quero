import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (file) =>
  ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const moduleUrl = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const validationUrl = moduleUrl(compile('lib/validation.ts'));
const { safeUrl, cents, textValue, validateItem } = await import(validationUrl);
const { readJson, checkOrigin } = await import(
  moduleUrl(
    compile('lib/http.ts')
      .replace(
        /['"]\.\/public-origin['"]/,
        JSON.stringify(moduleUrl(compile('lib/public-origin.ts'))),
      )
      .replace("'./validation'", JSON.stringify(validationUrl)),
  )
);

for (const url of [
  'javascript:alert(1)',
  'http://example.com',
  'https://user:pass@example.com',
  'bad',
  false,
  123,
])
  assert.throws(() => safeUrl(url));
assert.equal(safeUrl('', true), '');
assert.equal(safeUrl(null, true), '');
assert.throws(() => safeUrl(false, true));
assert.equal(cents(0), 0);
assert.equal(cents(null, true), null);
for (const price of [-1, 1.1, NaN, Infinity, '1', 1000000001]) assert.throws(() => cents(price));
assert.throws(() => textValue('   ', 20));
assert.equal(textValue(' abc ', 5), 'abc');
assert.throws(() => validateItem({ category: 'Fake', priority: 'Quero' }));
const request = (body, headers = {}) =>
  new Request('https://wishlist.test/api/items', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
assert.deepEqual(await readJson(request('{"name":"Coração ♡"}')), { name: 'Coração ♡' });
for (const body of ['null', '[]', 'true', '{'])
  await assert.rejects(readJson(request(body)), { status: 400 });
await assert.rejects(readJson(request('{}', { 'Content-Type': 'text/plain' })), { status: 415 });
await assert.rejects(readJson(request(JSON.stringify({ name: '♥'.repeat(7000) }))), {
  status: 413,
});
assert.throws(() => checkOrigin(request('{}', { origin: 'https://evil.test' })), { status: 403 });
assert.throws(() => checkOrigin(request('{}', { 'sec-fetch-site': 'cross-site' })), {
  status: 403,
});
checkOrigin(request('{}', { origin: 'https://wishlist.test' }));
process.env.APP_ORIGIN = 'https://quero.tznog.com';
checkOrigin(
  new Request('http://entre-nos:3000/api/items', {
    method: 'POST',
    headers: { origin: process.env.APP_ORIGIN },
  }),
);
assert.throws(() => checkOrigin(request('{}', { origin: 'https://wishlist.test' })), {
  status: 403,
});
delete process.env.APP_ORIGIN;
process.env.APP_ORIGIN = 'https://quero.tznog.com';
process.env.PRIVATE_ORIGINS = 'http://homelab.tail86b1f4.ts.net:3080';
const privateRequest = (origin, host = 'homelab.tail86b1f4.ts.net:3080') =>
  new Request('http://container:3000/api/items', { method: 'POST', headers: { host, origin } });
assert.throws(() => checkOrigin(privateRequest(process.env.PRIVATE_ORIGINS)), { status: 403 });
checkOrigin(privateRequest('https://quero.tznog.com'));
assert.throws(() => checkOrigin(privateRequest('https://evil.test')), { status: 403 });
assert.throws(() => checkOrigin(privateRequest(process.env.PRIVATE_ORIGINS, 'quero.tznog.com')), {
  status: 403,
});
delete process.env.APP_ORIGIN;
delete process.env.PRIVATE_ORIGINS;
console.log('PASS: URL, money, category, JSON byte limits and origin validation.');
