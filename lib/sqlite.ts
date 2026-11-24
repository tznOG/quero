import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private args: SQLInputValue[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Statement(
      this.db,
      this.sql,
      args.map((value) => {
        if (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'bigint' ||
          value instanceof Uint8Array
        )
          return value;
        throw new TypeError('Invalid SQL binding');
      }),
    );
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.args) as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>() {
    return { results: this.db.prepare(this.sql).all(...this.args) as T[] };
  }
  execute() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes) } };
  }
  async run() {
    return this.execute();
  }
}

export class SQLiteDatabase {
  readonly connection: DatabaseSync;
  constructor(filename: string, migrations = resolve(process.cwd(), 'drizzle')) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.connection = new DatabaseSync(filename);
    this.connection.exec(
      'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;',
    );
    this.connection.exec(
      'CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
    );
    for (const name of readdirSync(migrations)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      // Check and apply under one lock, including when two processes start together.
      this.connection.exec('BEGIN IMMEDIATE');
      try {
        if (!this.connection.prepare('SELECT name FROM app_migrations WHERE name=?').get(name)) {
          this.connection.exec(readFileSync(resolve(migrations, name), 'utf8'));
          this.connection.prepare('INSERT INTO app_migrations VALUES (?,?)').run(name, Date.now());
        }
        this.connection.exec('COMMIT');
      } catch (error) {
        this.connection.exec('ROLLBACK');
        this.connection.close();
        throw error;
      }
    }
  }
  prepare(sql: string) {
    return new Statement(this.connection, sql);
  }
  async batch(statements: Statement[]) {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      // No awaits inside the transaction: other requests cannot interleave.
      const results = statements.map((statement) => statement.execute());
      this.connection.exec('COMMIT');
      return results;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }
}

const singleton = globalThis as typeof globalThis & { entreNosDb?: SQLiteDatabase };
export function getDatabase() {
  return (singleton.entreNosDb ??= new SQLiteDatabase(
    resolve(process.env.DATABASE_PATH || 'data/entre-nos.sqlite'),
  ));
}
