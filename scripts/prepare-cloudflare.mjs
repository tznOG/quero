import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2),
  option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? null : args[i + 1];
  };
const id = option('--database-id'),
  name = option('--name') || 'entre-nos';
if (
  !id ||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ||
  id === '00000000-0000-4000-8000-000000000000'
)
  throw new Error('Informe --database-id com o UUID real retornado ao criar o D1.');
if (!/^[a-z][a-z0-9-]{1,60}$/.test(name))
  throw new Error('Nome inválido. Use letras minúsculas, números e hífens.');
const built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const config = {
  name,
  main: 'index.js',
  compatibility_date: built.compatibility_date,
  compatibility_flags: ['nodejs_compat'],
  no_bundle: true,
  rules: built.rules,
  assets: { directory: '../client' },
  d1_databases: [
    {
      binding: 'DB',
      database_name: name + '-db',
      database_id: id,
      migrations_dir: '../../drizzle',
    },
  ],
};
writeFileSync('dist/server/wrangler.cloudflare.json', JSON.stringify(config, null, 2) + '\n');
console.log('Configuração criada: dist/server/wrangler.cloudflare.json');
console.log(
  'Próximos passos: aplicar migrações D1 e executar wrangler deploy com esta configuração.',
);
