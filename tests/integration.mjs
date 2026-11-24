import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const target = new URL(base);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
  throw new Error('Integration tests only run against a local test database.');
const stamp = crypto.randomUUID();
function client() {
  let cookie = '';
  return async (path, method = 'GET', body, expected = 200, extra = {}) => {
    const r = await fetch(base + '/api/' + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const raw = await r.text();
    assert.equal(r.status, expected, `${method} ${path}: ${raw}`);
    const data = JSON.parse(raw);
    return data;
  };
}
const alice = client(),
  bob = client(),
  carol = client(),
  anon = client();
const pass = 'A safe test passphrase 2026!';
const signup = (c, name) =>
  c('auth/signup', 'POST', {
    name,
    email: `${name.toLowerCase()}.${stamp}@example.test`,
    password: pass,
  });
await anon('items', 'POST', {}, 401);
await anon('auth/signup', 'POST', { name: 'x', email: 'invalid', password: 'short' }, 400);
await signup(alice, 'Alice');
await signup(bob, 'Bob');
await signup(carol, 'Carol');
let a = await alice('state'),
  b = await bob('state');
assert.equal(a.user.name, 'Alice');
assert.equal(a.lists.length, 1);
assert.equal(a.items.length, 0);
assert.equal(b.items.length, 0);
assert.equal('password_hash' in a.user, false);
const list = a.lists[0].id;
await bob(`lists/${list}`, 'PATCH', { name: 'stolen' }, 404);
const product = {
  wishlistId: list,
  name: 'Test headset',
  url: 'https://example.com/headset',
  price: 19990,
  targetPrice: 15000,
  image: '',
  category: 'Tecnologia',
  priority: 'Quero muito',
  notes: 'A surprise!',
};
await alice('items', 'POST', { ...product, price: -1 }, 400);
await alice('items', 'POST', { ...product, price: 1.5 }, 400);
await alice('items', 'POST', { ...product, url: 'javascript:alert(1)' }, 400);
await alice('items', 'POST', { ...product, image: 'http://127.0.0.1/image' }, 400);
const { id } = await alice('items', 'POST', product, 201);
await alice(`items/${id}/unknown`, 'DELETE', undefined, 404);
await alice(`lists/${list}/unknown`, 'DELETE', undefined, 404);
await alice('auth/logout/unknown', 'POST', {}, 404);
await alice(`items/${id}`, 'PATCH', { priority: 'Um dia' });
assert.equal((await alice('state')).items[0].priority, 'Um dia');
await alice(`items/${id}`, 'PATCH', { priority: 'invalid' }, 400);
await alice('items', 'POST', { ...product, image: false }, 400);
await alice(`lists/${list}/share`, 'POST', { enabled: 'false' }, 400);
await bob(`items/${id}`, 'PATCH', { purchased: true }, 404);
await bob(`items/${id}`, 'DELETE', undefined, 404);
await alice(`items/${id}`, 'PATCH', { ...product, name: 'Headset updated' });
a = await alice('state');
assert.equal(a.items[0].name, 'Headset updated');
assert.equal((await bob('state')).items.length, 0);
const offers = await alice(`items/${id}/offers`);
assert.equal(offers.enabled, false);
assert.equal(offers.offers.length, 0);
assert.equal(offers.links.length, 4);
const { shareToken } = await alice(`lists/${list}/share`, 'POST', { enabled: true });
assert.ok(shareToken.length >= 32);
let shared = await anon(`shared/${shareToken}`);
assert.equal(shared.items.length, 1);
assert.equal(shared.list.owner, 'Alice');
assert.equal('email' in shared.list, false);
await alice(`items/${id}/reserve`, 'POST', { shareToken }, 400);
await bob('friends', 'POST', { shareToken });
assert.equal((await bob('state')).friends.length, 1);
await bob(`items/${id}/reserve`, 'POST', { shareToken });
await carol(`items/${id}/reserve`, 'POST', { shareToken }, 409);
assert.equal((await bob(`shared/${shareToken}`)).items[0].reservation, 'mine');
assert.equal((await carol(`shared/${shareToken}`)).items[0].reservation, 'reserved');
assert.equal('reservation' in (await alice(`shared/${shareToken}`)).items[0], false);
assert.equal('reservation' in (await alice('state')).items[0], false);
await carol(`items/${id}/reserve`, 'POST', { shareToken, cancel: true });
assert.equal((await bob(`shared/${shareToken}`)).items[0].reservation, 'mine');
await bob(`items/${id}/reserve`, 'POST', { shareToken, cancel: true });
assert.equal((await anon(`shared/${shareToken}`)).items[0].reservation, null);
await bob(`items/${id}/reserve`, 'POST', { shareToken });
await alice(`items/${id}`, 'PATCH', { purchased: true });
assert.equal((await anon(`shared/${shareToken}`)).items.length, 0);
await bob(`items/${id}/reserve`, 'POST', { shareToken }, 404);
await alice(`items/${id}`, 'PATCH', { purchased: false });
assert.equal((await anon(`shared/${shareToken}`)).items[0].reservation, null);
await alice(`lists/${list}/share`, 'POST', { enabled: false });
await anon(`shared/${shareToken}`, 'GET', undefined, 404);
assert.equal((await bob('state')).friends.length, 0);
await bob(`items/${id}/reserve`, 'POST', { shareToken }, 404);
const rotated = await alice(`lists/${list}/share`, 'POST', { enabled: true });
assert.notEqual(rotated.shareToken, shareToken);
assert.equal((await bob('state')).friends.length, 0);
await bob('friends', 'POST', { shareToken: rotated.shareToken });
const replaced = await alice(`lists/${list}/share`, 'POST', { enabled: true, rotate: true });
await anon(`shared/${rotated.shareToken}`, 'GET', undefined, 404);
assert.equal((await bob('state')).friends.length, 0);
await bob(`items/${id}/reserve`, 'POST', { shareToken: rotated.shareToken }, 404);
await bob(`items/${id}/reserve`, 'POST', { shareToken: replaced.shareToken });
await alice(`items/${id}`, 'PATCH', { purchased: true }, 403, { origin: 'https://evil.test' });
await alice('auth/logout', 'POST', {});
assert.equal((await alice('state')).user, null);
await alice(`items/${id}`, 'DELETE', undefined, 401);
await alice('auth/login', 'POST', { email: `alice.${stamp}@example.test`, password: 'wrong' }, 401);
await alice('auth/login', 'POST', { email: `alice.${stamp}@example.test`, password: pass });
assert.equal((await alice('state')).user.name, 'Alice');
await alice(`lists/${list}`, 'DELETE');
assert.equal((await alice('state')).items.length, 0);
await anon(`shared/${rotated.shareToken}`, 'GET', undefined, 404);
const secondSession = client();
const aliceEmail = `alice.${stamp}@example.test`;
await secondSession('auth/login', 'POST', { email: aliceEmail, password: pass });
await alice(
  'auth/password',
  'POST',
  { currentPassword: 'wrong', password: pass + ' changed' },
  401,
);
await alice('auth/password', 'POST', { currentPassword: pass, password: pass + ' changed' });
assert.equal((await secondSession('state')).user, null);
await secondSession('auth/login', 'POST', { email: aliceEmail, password: pass }, 401);
await secondSession('auth/login', 'POST', { email: aliceEmail, password: pass + ' changed' });
await alice('auth/reset-request', 'POST', { email: aliceEmail }, 503);
await alice('auth/reset', 'POST', { token: 'invalid', password: pass }, 400);
await alice('profile', 'PATCH', { name: 'Alice Updated' });
assert.equal((await alice('state')).user.name, 'Alice Updated');
// The list cap holds under concurrent requests.
for (let i = 0; i < 29; i++) await alice('lists', 'POST', { name: 'List ' + i }, 201);
const race = await Promise.all(
  [0, 1, 2, 3].map(async (i) => {
    try {
      await alice('lists', 'POST', { name: 'Concurrent ' + i }, 201);
      return true;
    } catch (error) {
      assert.match(error.message, /400/);
      return false;
    }
  }),
);
assert.equal(race.filter(Boolean).length, 1);
assert.equal((await alice('state')).lists.length, 30);
await alice(
  'auth/delete-account',
  'POST',
  { currentPassword: pass + ' changed', confirmation: 'no' },
  400,
);
await alice('auth/delete-account', 'POST', {
  currentPassword: pass + ' changed',
  confirmation: 'EXCLUIR',
});
assert.equal((await secondSession('state')).user, null);
await secondSession('auth/login', 'POST', { email: aliceEmail, password: pass + ' changed' }, 401);
await bob('auth/delete-account', 'POST', { currentPassword: pass, confirmation: 'EXCLUIR' });
await carol('auth/delete-account', 'POST', { currentPassword: pass, confirmation: 'EXCLUIR' });
const html = await fetch(base + '/?lista=not-a-token');
assert.equal(html.headers.get('referrer-policy'), 'no-referrer');
assert.equal(html.headers.get('x-frame-options'), 'DENY');
assert.equal(html.headers.get('cache-control'), 'no-store');
console.log(
  'PASS: authentication, ownership, CRUD, priority, limits under concurrency, sharing revocation, reservations, password/session changes, account deletion, headers and CSRF.',
);
