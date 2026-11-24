import { env } from './env';
import { HttpError, textValue } from './validation';
import type { WishCategory } from './types';

export async function listCategories(userId: string): Promise<WishCategory[]> {
  return (
    await env.DB.prepare('SELECT id,name FROM categories WHERE user_id=? ORDER BY name_key')
      .bind(userId)
      .all<WishCategory>()
  ).results;
}

function categoryName(value: unknown) {
  const name = textValue(value, 40).normalize('NFC').replace(/\s+/gu, ' ');
  if (/[\p{Cc}\p{Cf}]/u.test(name))
    throw new HttpError(400, 'O nome da categoria contém caracteres inválidos.');
  return { name, key: name.toLocaleLowerCase('pt-BR') };
}

export async function createCategory(userId: string, value: unknown) {
  const { name, key } = categoryName(value);
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    'INSERT INTO categories(id,user_id,name,name_key) SELECT ?,?,?,? WHERE (SELECT count(*) FROM categories WHERE user_id=?)<50',
  )
    .bind(id, userId, name, key, userId)
    .run();
  if (!result.meta.changes) throw new HttpError(400, 'Você pode criar até 50 categorias.');
  return { id, name };
}

export async function renameCategory(userId: string, id: string, value: unknown) {
  const { name, key } = categoryName(value);
  // The trigger updates only this owner's items in the same SQLite statement.
  const result = await env.DB.prepare(
    'UPDATE categories SET name=?,name_key=? WHERE id=? AND user_id=?',
  )
    .bind(name, key, id, userId)
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'Categoria não encontrada.');
  return { id, name };
}

export async function deleteCategory(userId: string, id: string) {
  const result = await env.DB.prepare('DELETE FROM categories WHERE id=? AND user_id=?')
    .bind(id, userId)
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'Categoria não encontrada.');
}

export function categoryDatabaseError(error: unknown): HttpError | null {
  if (!(error instanceof Error)) return null;
  if (error.message.includes('UNIQUE constraint failed: categories.user_id, categories.name_key'))
    return new HttpError(409, 'Você já tem uma categoria com esse nome.');
  if (error.message.includes('invalid item category'))
    return new HttpError(
      400,
      'Esta categoria não está disponível. Atualize a página e escolha outra categoria.',
    );
  return null;
}
