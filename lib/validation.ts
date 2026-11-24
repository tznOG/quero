export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function textValue(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw new HttpError(400, 'Confira os campos do formulário.');
  }
  const text = value.trim();
  if ((required && !text) || text.length > max)
    throw new HttpError(400, `Preencha o campo com até ${max} caracteres.`);
  return text;
}
export function safeUrl(value: unknown, optional = false): string {
  if (optional && (value == null || value === '')) return '';
  const raw = textValue(value, 2048);
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) throw new Error();
    return u.href;
  } catch {
    throw new HttpError(400, 'Use um link válido começando com https://.');
  }
}
export function cents(value: unknown, optional = false): number | null {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1000000000)
    throw new HttpError(400, 'Informe um preço válido.');
  return value;
}
export function validateItem(body: Record<string, unknown>) {
  const category = textValue(body.category, 40, false),
    priority = textValue(body.priority, 20);
  // Category membership is enforced by SQLite against the list owner's categories.
  if (!['Quero muito', 'Quero', 'Um dia'].includes(priority))
    throw new HttpError(400, 'Prioridade inválida.');
  return {
    name: textValue(body.name, 160),
    url: safeUrl(body.url),
    price: cents(body.price)!,
    targetPrice: cents(body.targetPrice, true),
    image: safeUrl(body.image, true),
    category,
    priority,
    notes: textValue(body.notes, 1000, false),
  };
}
