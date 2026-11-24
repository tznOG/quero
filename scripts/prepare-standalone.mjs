import { cpSync } from 'node:fs';
for (const [source, destination] of [
  ['public', '.next/standalone/public'],
  ['.next/static', '.next/standalone/.next/static'],
  ['drizzle', '.next/standalone/drizzle'],
])
  cpSync(source, destination, { recursive: true });
console.log('Standalone pronto, incluindo arquivos estáticos e migrações.');
