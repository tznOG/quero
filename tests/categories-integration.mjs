import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
if (!base || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Category tests require the local synthetic test server.');
function client() {
  let cookie = '';
  return async (path, method = 'GET', body, expected = 200, headers = {}) => {
    const r = await fetch(base + '/api/' + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    const data = await r.json();
    assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
const alice = client(),
  bob = client(),
  anon = client();
const password = 'Synthetic category password 2026!';
const stamp = crypto.randomUUID();
const accounts = [];
try {
  for (const [c, name] of [
    [alice, 'Category Alice'],
    [bob, 'Category Bob'],
  ]) {
    await c('auth/signup', 'POST', {
      name,
      email: `${name.replaceAll(' ', '')}.${stamp}@example.test`,
      password,
    });
    accounts.push(c);
  }
  await anon('categories', 'GET', undefined, 401);
  await anon('categories', 'POST', { name: 'Anonymous' }, 401);
  assert.deepEqual((await anon('state')).categories, []);
  let a = await alice('state'),
    b = await bob('state');
  assert.equal(a.categories.length, 7);
  assert.equal(b.categories.length, 7);
  const tech = a.categories.find((c) => c.name === 'Tecnologia');
  await bob(`categories/${tech.id}`, 'PATCH', { name: 'Stolen' }, 404);
  await bob(`categories/${tech.id}`, 'DELETE', undefined, 404);
  for (const name of ['', '  ', 'x'.repeat(41), false, 'test\u0000name'])
    await alice('categories', 'POST', { name }, 400);
  await alice('categories', 'POST', { name: 'Tecnologia' }, 409);
  const cafe = await alice('categories', 'POST', { name: '  CAFÉ  ' }, 201);
  await alice('categories', 'POST', { name: 'cafe\u0301' }, 409);
  await alice('categories', 'POST', { name: 'Viagens' }, 403, {
    origin: 'https://foreign.example.test',
  });
  const trip = await alice('categories', 'POST', { name: 'Viagens' }, 201);
  const list = a.lists[0].id;
  const otherList = (await alice('lists', 'POST', { name: 'Outra lista' }, 201)).id;
  const product = {
    wishlistId: list,
    name: 'Desejo sintético',
    url: 'https://example.com/product',
    price: 1000,
    targetPrice: null,
    image: '',
    category: 'Viagens',
    priority: 'Quero',
    notes: 'Preservar notas',
  };
  const first = (await alice('items', 'POST', product, 201)).id;
  const purchased = (await alice('items', 'POST', { ...product, wishlistId: otherList }, 201)).id;
  await alice(`items/${purchased}`, 'PATCH', { purchased: true });
  await bob('items', 'POST', { ...product, wishlistId: b.lists[0].id }, 400);
  await bob('categories', 'POST', { name: 'Viagens' }, 201);
  const bobItem = (await bob('items', 'POST', { ...product, wishlistId: b.lists[0].id }, 201)).id;
  const privateCategory = await alice(
    'categories',
    'POST',
    { name: 'Categoria privada sem itens' },
    201,
  );
  const shared = await alice(`lists/${list}/share`, 'POST', { enabled: true });
  const publicView = await anon(`shared/${shared.shareToken}`);
  assert.equal('categories' in publicView, false);
  assert.equal(JSON.stringify(publicView).includes(privateCategory.name), false);
  await bob(`items/${first}/reserve`, 'POST', { shareToken: shared.shareToken });
  await alice(`categories/${trip.id}`, 'PATCH', { name: 'Casa' }, 409);
  assert.equal((await alice('state')).items.find((i) => i.id === first).category, 'Viagens');
  await alice(`categories/${trip.id}`, 'PATCH', { name: 'Todas' });
  a = await alice('state');
  assert.equal(a.items.find((i) => i.id === first).category, 'Todas');
  assert.equal(a.items.find((i) => i.id === purchased).category, 'Todas');
  assert.equal((await bob('state')).items.find((i) => i.id === bobItem).category, 'Viagens');
  assert.equal((await anon(`shared/${shared.shareToken}`)).items[0].category, 'Todas');
  await alice('items', 'POST', product, 400); // stale form after rename
  await alice(`items/${first}`, 'PATCH', product, 400);
  await alice(`categories/${trip.id}`, 'DELETE');
  a = await alice('state');
  assert.equal(a.items.length, 2);
  for (const item of a.items) {
    assert.equal(item.category, '');
    assert.equal(item.notes, product.notes);
    assert.equal(item.price, 1000);
  }
  assert.equal(a.items.find((i) => i.id === purchased).purchased, true);
  assert.equal((await bob(`shared/${shared.shareToken}`)).items[0].reservation, 'mine');
  assert.equal((await bob('state')).items[0].category, 'Viagens');
  await alice('items', 'POST', { ...product, category: 'Todas' }, 400);
  await alice('items', 'POST', { ...product, category: '' }, 201);
  // Even all of the starter categories can be deleted, without deleting items or reseeding.
  for (const category of (await alice('state')).categories)
    await alice(`categories/${category.id}`, 'DELETE');
  assert.deepEqual((await alice('state')).categories, []);
  assert.equal((await alice('state')).items.length, 3);
  await alice('items', 'POST', { ...product, category: 'Tecnologia' }, 400);
  await alice('items', 'POST', { ...product, category: '' }, 201);
  // Names are data, not HTML or SQL; server returns exactly the stored text.
  const literal = await alice('categories', 'POST', { name: '<b>Artes</b>' }, 201);
  assert.equal(literal.name, '<b>Artes</b>');
  await alice(`categories/${literal.id}`, 'DELETE');
  for (let i = 0; i < 49; i++) await alice('categories', 'POST', { name: 'Categoria ' + i }, 201);
  const race = await Promise.all(
    [0, 1, 2, 3].map(async (i) => {
      try {
        await alice('categories', 'POST', { name: 'Concorrente ' + i }, 201);
        return true;
      } catch (e) {
        assert.match(e.message, /50 categorias/);
        return false;
      }
    }),
  );
  assert.equal(race.filter(Boolean).length, 1);
  assert.equal((await alice('state')).categories.length, 50);
  console.log(
    'PASS: category CRUD, defaults, Unicode duplicates, per-account authorization, CSRF, sharing privacy, rename/delete preservation, stale writes and concurrent limits.',
  );
} finally {
  for (const account of accounts)
    await account('auth/delete-account', 'POST', {
      currentPassword: password,
      confirmation: 'EXCLUIR',
    });
}
