import { safeUrl } from './validation';
export type Offer = {
  title: string;
  url: string;
  store: string;
  price: number;
  oldPrice: number | null;
  coupon: string | null;
  image: string;
};
export function searchLinks(name: string) {
  const q = encodeURIComponent(name);
  return [
    { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { name: 'Amazon', url: `https://www.amazon.com.br/s?k=${q}` },
    { name: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${q}` },
    {
      name: 'Cupons e promoções',
      url: `https://www.google.com/search?q=${encodeURIComponent(name + ' cupom promoção Brasil')}`,
    },
  ];
}
export function normalizeOffers(rows: unknown): Offer[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .slice(0, 50)
    .flatMap((value: unknown) => {
      try {
        if (!value || typeof value !== 'object') return [];
        const row = value as Record<string, unknown>;
        if (row.monthly_payment_duration && !Number.isFinite(row.extracted_total)) return [];
        if (
          typeof (row.monthly_payment_duration ? row.extracted_total : row.extracted_price) !==
          'number'
        )
          return [];
        const price = Math.round(
          Number(row.monthly_payment_duration ? row.extracted_total : row.extracted_price) * 100,
        );
        if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000) return [];
        const oldPrice = row.extracted_old_price ?? row.extracted_original_price;
        return [
          {
            title: String(row.title || '').slice(0, 200),
            url: safeUrl(row.link || row.product_link),
            store: String(row.source || row.name || 'Loja').slice(0, 100),
            price,
            oldPrice:
              typeof oldPrice === 'number' &&
              Number.isFinite(oldPrice) &&
              oldPrice > 0 &&
              oldPrice <= 10000000
                ? Math.round(oldPrice * 100)
                : null,
            coupon: typeof row.coupon === 'string' ? row.coupon.slice(0, 80) : null,
            image:
              typeof row.thumbnail === 'string' && row.thumbnail.startsWith('https://')
                ? row.thumbnail
                : '',
          },
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.price - b.price)
    .slice(0, 15);
}
export async function fetchOffers(name: string, key: string): Promise<Offer[]> {
  const u = new URL('https://serpapi.com/search.json');
  u.search = new URLSearchParams({
    engine: 'google_shopping',
    q: name,
    gl: 'br',
    hl: 'pt',
    api_key: key,
    num: '10',
  }).toString();
  const response = await fetch(u, { signal: AbortSignal.timeout(18000) });
  if (!response.ok)
    throw new Error('O serviço de ofertas está indisponível. Tente novamente mais tarde.');
  const data = (await response.json()) as Record<string, unknown>;
  if (data.error)
    throw new Error(
      'Não foi possível consultar o provedor de ofertas. Verifique a configuração ou tente mais tarde.',
    );
  const shopping = normalizeOffers(data.shopping_results);
  // One product details request adds store-level promotions and coupon codes.
  const candidates = Array.isArray(data.shopping_results) ? data.shopping_results : [];
  const candidate = candidates.find(
    (row: unknown): row is { immersive_product_page_token: string } =>
      !!row &&
      typeof row === 'object' &&
      'immersive_product_page_token' in row &&
      typeof row.immersive_product_page_token === 'string',
  );
  if (candidate) {
    const details = new URL('https://serpapi.com/search.json');
    details.search = new URLSearchParams({
      engine: 'google_immersive_product',
      page_token: candidate.immersive_product_page_token,
      api_key: key,
    }).toString();
    try {
      const response = await fetch(details, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const product = (await response.json()) as { product_results?: { stores?: unknown } };
        const stores = normalizeOffers(product.product_results?.stores);
        const seen = new Set<string>();
        return [...stores, ...shopping]
          .sort((a, b) => a.price - b.price)
          .filter((o) => {
            if (seen.has(o.url)) return false;
            seen.add(o.url);
            return true;
          })
          .slice(0, 15);
      }
    } catch {
      /* Shopping results remain useful if the optional details request fails. */
    }
  }
  return shopping;
}
