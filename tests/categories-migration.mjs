import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('lib/sqlite.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SQLiteDatabase } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const directory = mkdtempSync(join(tmpdir(), 'quero-category-migration-'));
const old = join(directory, 'old-migrations');
mkdirSync(old);
for (const name of readdirSync('drizzle').filter(
  (n) => n.endsWith('.sql') && n < '0011_user_categories.sql',
))
  copyFileSync(join('drizzle', name), join(old, name));
const filename = join(directory, 'test.sqlite');
let db;
try {
  db = new SQLiteDatabase(filename, old);
  for (const owner of ['alice', 'bob']) {
    db.connection
      .prepare(
        'INSERT INTO profiles(id,name,email,created_at,password_hash,salt) VALUES(?,?,?,0,?,?)',
      )
      .run(owner, owner, owner + '@example.test', 'synthetic', 'synthetic');
    db.connection
      .prepare('INSERT INTO wishlists(id,user_id,name,created_at) VALUES(?,?,?,0)')
      .run(owner + '-list', owner, 'Lista');
    db.connection
      .prepare(
        'INSERT INTO items(id,wishlist_id,name,url,price,category,notes,purchased,created_at) VALUES(?,?,?, ?,1234,?,?,1,0)',
      )
      .run(
        owner + '-item',
        owner + '-list',
        'Produto',
        'https://example.com',
        'Tecnologia',
        'Nota preservada',
      );
  }
  const before = JSON.stringify(db.connection.prepare('SELECT * FROM items ORDER BY id').all());
  db.connection.close();
  db = new SQLiteDatabase(filename);
  assert.equal(
    JSON.stringify(db.connection.prepare('SELECT * FROM items ORDER BY id').all()),
    before,
  );
  assert.equal(db.connection.prepare('SELECT count(*) AS n FROM categories').get().n, 14);
  db.connection
    .prepare('UPDATE categories SET name=?,name_key=? WHERE user_id=? AND name=?')
    .run('Jogos', 'jogos', 'alice', 'Tecnologia');
  assert.equal(
    db.connection.prepare('SELECT category FROM items WHERE id=?').get('alice-item').category,
    'Jogos',
  );
  assert.equal(
    db.connection.prepare('SELECT category FROM items WHERE id=?').get('bob-item').category,
    'Tecnologia',
  );
  db.connection.prepare('DELETE FROM categories WHERE user_id=?').run('alice');
  const item = db.connection.prepare('SELECT * FROM items WHERE id=?').get('alice-item');
  assert.equal(item.category, '');
  assert.equal(item.notes, 'Nota preservada');
  assert.equal(item.purchased, 1);
  assert.equal(item.price, 1234);
  db.connection.close();
  db = new SQLiteDatabase(filename);
  assert.equal(
    db.connection.prepare('SELECT count(*) AS n FROM categories WHERE user_id=?').get('alice').n,
    0,
  );
  assert.equal(db.connection.prepare('SELECT count(*) AS n FROM items').get().n, 2);
  console.log(
    'PASS: legacy database migration preserves items, isolates changes and never reseeds deleted categories.',
  );
} finally {
  db?.connection.close();
  if (
    !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
    !basename(directory).startsWith('quero-category-migration-')
  )
    throw new Error('Unexpected temporary path');
  rmSync(directory, { recursive: true, force: true });
}
