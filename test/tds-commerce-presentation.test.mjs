import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizeApprovedTds} from '../scripts/approved-tds-presentation.mjs';
const root=new URL('../',import.meta.url);
const products=JSON.parse(readFileSync(new URL('catalog/products.source.json',root))).products;
const selected=products.filter(p=>['WM-SOL-TFEP','WM-ADD-PFPN','WM-ADD-LIDFOP-EMC20'].includes(p.sku));
assert.equal(selected.length,3);
test('shared commerce header allows long chemical names to wrap on narrow screens',()=>{
  const css=readFileSync(new URL('assets/css/ecommerce.css',root),'utf8');
  assert.match(css,/\.ecommerce-panel__header > div\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/);
});
for(const p of selected) {
  test(`${p.primaryAbbreviation}: commerce navigation, support and idempotence`,()=>{
    const html=readFileSync(new URL(p.url.slice(1),root),'utf8');
    const nav=html.match(/<nav class="product-detail-nav"[\s\S]*?<\/nav>/)[0];
    assert.deepEqual([...nav.matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)].map(m=>[m[1],m[2]]),[['overview','Overview'],['specifications','Specifications'],['packages','Packages &amp; Pricing'],['applications','Applications &amp; Technical Notes'],['documentation','Documentation'],['technical-guides','Related Guides']]);
    assert(!/Specifications &(?:amp;)? RFQ|Available by RFQ|provisional pricing|draft price/i.test(html));
    for(const text of ['Need something beyond the standard package?','Different grade or package','Request a quote','Formulation or application support','Start a technical discussion','Moving toward pilot scale','Explore technical services','Add to Cart','data-product-quick-tds']) assert(html.includes(text));
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert(!/<sub>20<\/sub>/.test(html));
    assert(html.includes('id="applications"'));
    assert.equal(finalizeApprovedTds(html,p,products),html);
  });
}
