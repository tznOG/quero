import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('lib/sqlite.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SQLiteDatabase } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const directory = mkdtempSync(join(tmpdir(), 'wishlist-sqlite-'));
const filename = join(directory, 'database.sqlite');
let db;
try {
  db = new SQLiteDatabase(filename);
  const migrations = await db.prepare('SELECT count(*) AS n FROM app_migrations').first();
  assert.ok(migrations.n > 0);
  db.connection.exec('CREATE TABLE adapter_test (id INTEGER PRIMARY KEY, value TEXT)');
  await db.prepare('INSERT INTO adapter_test VALUES (?,?)').bind(1, 'persisted').run();
  await assert.rejects(
    db.batch([
      db.prepare('INSERT INTO adapter_test VALUES (?,?)').bind(2, 'rollback'),
      db.prepare('INSERT INTO adapter_test VALUES (?,?)').bind(1, 'duplicate'),
    ]),
  );
  assert.equal(await db.prepare('SELECT * FROM adapter_test WHERE id=2').first(), null);
  const copy = join(directory, 'backup.sqlite');
  const result = spawnSync(process.execPath, ['scripts/backup-sqlite.mjs', copy], {
    env: { ...process.env, DATABASE_PATH: filename },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const backup = new DatabaseSync(copy, { readOnly: true });
  assert.equal(backup.prepare('SELECT value FROM adapter_test').get().value, 'persisted');
  backup.close();
  db.connection.close();
  db = new SQLiteDatabase(filename);
  assert.deepEqual(
    await db.prepare('SELECT count(*) AS n FROM app_migrations').first(),
    migrations,
  );
  assert.equal(
    (await db.prepare('SELECT value FROM adapter_test').all()).results[0].value,
    'persisted',
  );
  console.log('PASS: SQLite migrations, rollback, persistence and online backup.');
} finally {
  db?.connection.close();
  rmSync(directory, { recursive: true, force: true });
}
