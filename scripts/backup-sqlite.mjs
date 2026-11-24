import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const filename = resolve(process.env.DATABASE_PATH || 'data/entre-nos.sqlite');
const destination = resolve(
  process.argv[2] ||
    `/data/backups/entre-nos-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
);
if (!existsSync(filename))
  throw new Error('Banco não encontrado. Abra o site antes de criar um backup.');
if (destination === filename || existsSync(destination))
  throw new Error('Escolha um arquivo novo para o backup.');
mkdirSync(dirname(destination), { recursive: true });
const db = new DatabaseSync(filename, { readOnly: true });
try {
  await backup(db, destination);
  console.log(destination);
} finally {
  db.close();
}
