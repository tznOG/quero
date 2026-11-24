import { HttpError } from './validation';
import { requestOrigin } from './public-origin';

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new HttpError(415, 'Envie os dados em JSON.');
  }
  const limit = 18000;
  if (Number(request.headers.get('content-length')) > limit)
    throw new HttpError(413, 'O formulário é muito grande.');
  const reader = request.body?.getReader();
  let size = 0;
  let raw = '';
  const decoder = new TextDecoder();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new HttpError(413, 'O formulário é muito grande.');
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Dados inválidos.');
  }
}

export function checkOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== requestOrigin(request)) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new HttpError(403, 'Origem não autorizada.');
  }
}
