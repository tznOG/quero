import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = (path) =>
  ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const moduleUrl = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const validationUrl = moduleUrl(compile('lib/validation.ts'));
const { normalizeOffers, fetchOffers } = await import(
  moduleUrl(compile('lib/offers.ts').replace("'./validation'", JSON.stringify(validationUrl)))
);
const rows = [
  {
    title: 'Headset',
    source: 'Loja',
    link: 'https://shop.test/item',
    extracted_price: 199.9,
    coupon: 'PRESENTE10',
  },
  { link: 'javascript:alert(1)', extracted_price: 1 },
  { link: 'https://shop.test/negative', extracted_price: -1 },
  {
    link: 'https://shop.test/installments',
    extracted_price: 10,
    monthly_payment_duration: 12,
    extracted_total: 120,
  },
  { link: 'https://shop.test/unclear', extracted_price: 10, monthly_payment_duration: 12 },
];
const result = normalizeOffers(rows);
assert.equal(result.length, 2);
assert.equal(result[0].price, 12000);
assert.equal(result[1].price, 19990);
assert.equal(result[1].coupon, 'PRESENTE10');
assert.equal(normalizeOffers(null).length, 0);
let calls = 0;
const original = globalThis.fetch;
globalThis.fetch = async (url) => {
  calls++;
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'serpapi.com');
  return Response.json(
    parsed.searchParams.get('engine') === 'google_shopping'
      ? { shopping_results: [{ ...rows[0], immersive_product_page_token: 'test-token' }] }
      : {
          product_results: {
            stores: [
              {
                name: 'Loja 2',
                title: 'Headset',
                link: 'https://shop.test/offer',
                extracted_price: 149,
                coupon: 'AMOR15',
                extracted_original_price: 199,
              },
            ],
          },
        },
  );
};
const offers = await fetchOffers('Headset', 'test-key');
assert.equal(calls, 2);
assert.equal(offers[0].coupon, 'AMOR15');
assert.equal(offers[0].price, 14900);
assert.equal(offers[0].oldPrice, 19900);
globalThis.fetch = async () => Response.json({ error: 'Quota exceeded' });
await assert.rejects(() => fetchOffers('Headset', 'test-key'), /provedor/);
globalThis.fetch = original;
console.log(
  'PASS: provider parsing, coupon codes, installments, unsafe URLs, details lookup and provider errors. Live API requires SERPAPI_KEY.',
);
