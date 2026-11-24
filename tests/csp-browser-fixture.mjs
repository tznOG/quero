import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();
 const violations=[];
 page.on('console',msg=>{if(msg.text().includes('Content Security Policy'))violations.push(msg.text());});
 const response=await page.goto('http://127.0.0.1:31879/');
 assert.equal(response.status(),200);
 const csp=response.headers()['content-security-policy'];
 assert.ok(csp.includes("'strict-dynamic'"));
 const nonce=csp.match(/'nonce-([^']+)'/)[1];
 await page.getByRole('button',{name:'Synthetic count 0',exact:true}).click();
 await page.getByRole('button',{name:'Synthetic count 1',exact:true}).waitFor();
 const nonces=await page.locator('script').evaluateAll(scripts=>scripts.map(s=>s.nonce));
 assert.ok(nonces.length>2&&nonces.every(n=>n===nonce));
 assert.equal(violations.length,0,'Legitimate Next scripts must run without CSP errors');
 const second=await page.reload();
 assert.notEqual(second.headers()['content-security-policy'],csp);
 // Inject into the received HTML, as a parser-inserted untrusted script.
 // A script created by an already-trusted executing script inherits strict-dynamic trust.
 await page.route('http://127.0.0.1:31879/',async route=>{
   const response=await route.fetch();
   const html=await response.text();
   await route.fulfill({response,body:html.replace('</head>','<script>window.__harmlessCspProbe = true</script></head>')});
 });
 await page.reload();
 assert.equal(await page.evaluate(()=>window.__harmlessCspProbe),undefined);
 assert.ok(violations.length>0,'Browser must report the blocked harmless inline script');
 console.log('PASS: real Next production build hydrates under CSP; framework and theme scripts have nonce; Edge blocks harmless unnonced inline script; reload rotates nonce. Synthetic fixture, not the full Quero frontend.');
 await context.close();
} finally {await browser.close();}
