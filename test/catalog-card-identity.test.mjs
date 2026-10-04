import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cardIdentity, identityAliases, identityFamilies, displayIdentity, accessibilityIdentity, synchronizeRfqIdentity, synchronizeProductPresentation, synchronizeCatalogCardIdentities } from '../scripts/catalog-card-identity.mjs';
import { renderStaticCommerceCards } from '../seo/build-seo.mjs';
import { finalizeApprovedTds } from '../scripts/approved-tds-presentation.mjs';
const root = new URL('../', import.meta.url);
const {products}=JSON.parse(await readFile(new URL('catalog/products.source.json', root),'utf8'));
const selected=products.filter(p=>identityFamilies.has(p.family));
const prop=(p,key)=>p.additionalProperty.find(x=>x.name===key)?.value;
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const collect=(o,type)=>{if(!o||typeof o!=='object')return [];return [...(o['@type']===type?[o]:[]),...Object.values(o).flatMap(v=>Array.isArray(v)?v.flatMap(x=>collect(x,type)):collect(v,type))];};
test('all 56 neat-material cards survive repeated generation with canonical aliases and compact categories', async()=>{
 assert.deepEqual([...identityFamilies].map(f=>selected.filter(p=>p.family===f).length),[9,17,25,5]);
 for(const family of identityFamilies){
  const path=`products/${family}.html`,html=await readFile(new URL(path,root),'utf8');
  assert.equal(synchronizeProductPresentation(html,products,new URL(path,root).pathname),html);
  const rendered=renderStaticCommerceCards(html,path);
  assert.equal(renderStaticCommerceCards(rendered,path),rendered);
  for(const p of selected.filter(p=>p.family===family)) {
   const article=[...rendered.matchAll(/<article class="[^"]*product-card[\s\S]*?<\/article>/g)].map(x=>x[0]).find(x=>x.includes(`href="${p.slug}.html"`));
   assert.ok(article,p.slug);const {shorthand,name,cas}=cardIdentity(p);
   for(const value of [shorthand,name,cas,p.cardCategory])assert.ok(plain(article).includes(value),`${p.slug}: ${value}`);
   for(const alias of identityAliases(p)) assert.ok(article.includes(alias) || article.includes(alias.toLowerCase()), `${p.slug}: searchable ${alias}`);
   assert.ok(!article.includes('Alternate Abbreviation'));
  }
 }
});
test('all individual pages have one canonical H1, CAS, formula, search aliases and JSON-LD alternateName',async()=>{
 for(const p of selected){
  const path=p.url.slice(1),html=await readFile(new URL(path,root),'utf8');
  assert.equal(finalizeApprovedTds(synchronizeProductPresentation(html,products,new URL(path,root).pathname),p,products),html);
  const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];assert.equal(headings.length,1,p.slug);
  const {shorthand,name,cas}=cardIdentity(p);assert.ok(plain(headings[0][1]).includes(shorthand),p.slug);assert.ok(plain(headings[0][1]).includes(name),p.slug);
  assert.ok(html.includes(`class="product-identity__cas">${p.activeMaterialIdentity?'Active-material CAS':'CAS'}: ${cas}`));
  const keywords=html.match(/<meta name="keywords" content="([^"]+)"/)[1];for(const alias of identityAliases(p))assert.ok(keywords.includes(alias),`${p.slug} alias ${alias}`);
  const schema=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(x=>collect(JSON.parse(x[1]),'Product'));
  assert.ok(schema.length,p.slug);for(const node of schema){assert.deepEqual(node.alternateName,identityAliases(p));const formula=node.additionalProperty?.find(x=>x.name==='Formula');if(formula)assert.equal(formula.value,prop(p,'Formula'));}
  assert.ok(plain(html).includes(prop(p,'Formula')),`${p.slug} formula`);
 }
});
test('phosphite and phosphate remain independent; requested synonyms and LiPF6 FAQ agree with source',async()=>{
 for(const [cas,abbr,formula] of [['1795-31-9','TTPi','C9H27O3PSi3'],['10497-05-9','TMSP','C9H27O4PSi3']]){
  const p=selected.find(p=>prop(p,'CAS Number')===cas);assert.equal(p.primaryAbbreviation,abbr);assert.equal(prop(p,'Formula'),formula);
  const html=await readFile(new URL(p.url.slice(1),root),'utf8');assert.ok(!plain(html).includes('C9H33O6PSi3'));
 }
 const dual=selected.find(p=>prop(p,'CAS Number')==='678966-16-0');assert.equal(cardIdentity(dual).shorthand,'LiDODFP / LiDFBOP');for(const a of ['LiDODFP','LiDFBOP','LiODFP'])assert.ok(identityAliases(dual).includes(a));
 const faq=plain(await readFile(new URL('products/lithium-salts.html',root),'utf8'));assert.ok(faq.includes('lists ≤10 ppm water'));assert.ok(!/lists (?:<=|≤)\s*20\s*ppm water/.test(faq));
});
test('missing shorthand retains full name and does not infer an acronym',()=>{const p={name:'Unabridged chemical name',aliases:['GUESS'],additionalProperty:[]};assert.deepEqual(cardIdentity(p),{name:p.name,shorthand:'',cas:''});});

const schemas = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(x => JSON.parse(x[1]));
const searchSource = await readFile(new URL('assets/js/product-search-index.js', root), 'utf8');
const searchRecords = JSON.parse(searchSource.slice(searchSource.indexOf('=') + 1).trim().replace(/;$/, '')).records;

test('aliases are explicit approved fields, never bare integers or chemical-name fragments', () => {
 const forbidden = new Set(['1', '2', 'Methyl 2', 'Bis(2', 'Prop-1-ene-1', '4-Fluoro-1']);
 for (const p of selected) {
  const expected = [...new Set([p.primaryAbbreviation, ...p.alternateAbbreviations, ...p.approvedSynonyms])];
  assert.deepEqual(identityAliases({...p, aliases: [...p.aliases, '1', 'Methyl 2', 'Invented']}), expected);
  assert.deepEqual(p.aliases, expected, p.slug);
  assert.deepEqual(searchRecords.find(r => r.slug === p.slug).aliases, expected, p.slug);
  for (const alias of expected) {
   assert.ok(!/^\d+$/.test(alias), `${p.slug}: bare integer ${alias}`);
   assert.ok(!forbidden.has(alias), `${p.slug}: truncated ${alias}`);
   assert.equal((alias.match(/\(/g) || []).length, (alias.match(/\)/g) || []).length, `${p.slug}: incomplete parenthetical alias`);
   if (p.chemicalName.includes(',')) assert.notEqual(alias, p.chemicalName.slice(0, p.chemicalName.indexOf(',')), `${p.slug}: comma-derived prefix`);
  }
 }
});

test('all category ItemList names use the same normalized identity as visible cards', async () => {
 for (const path of ['products.html', ...[...identityFamilies].map(f => `products/${f}.html`)]) {
  const html = await readFile(new URL(path, root), 'utf8');
  const entries = schemas(html).flatMap(s => collect(s, 'ItemList')).flatMap(s => s.itemListElement || []);
  const family = path === 'products.html' ? null : path.split('/').pop().replace('.html', '');
  for (const p of selected.filter(p => !family || p.family === family)) {
   const entry = entries.find(e => e.url?.endsWith(p.url));
   assert.ok(entry, `${path}: ${p.slug} list entry`);
   assert.equal(entry.name, displayIdentity(p), `${path}: ${p.slug}`);
  }
 }
});

test('all 57 display identities agree across cards, images, detail schema, search and accessibility', async () => {
 const catalog = await readFile(new URL('products.html', root), 'utf8');
 for (const p of selected) {
  const display = displayIdentity(p), {shorthand, name} = cardIdentity(p);
  const article = [...catalog.matchAll(/<article class="[^"]*product-card[\s\S]*?<\/article>/g)].map(x=>x[0]).find(x=>x.includes(`href="products/${p.slug}.html"`));
  assert.ok(article, p.slug);
  assert.ok(plain(article).includes(shorthand) && plain(article).includes(name));
  assert.ok(article.includes(`aria-label="View details for ${display}"`), `${p.slug}: media accessibility`);
  const imageType=p.qualityDocumentation?.specificationBasis==='approved-tds-release'&&p.commerceStatus==='rfq'?'identity illustration':'chemical structure';
  const imageAlt=p.imagePresentation?p.imageAlt:`${display} ${imageType}`;
  assert.ok(article.includes(`alt="${imageAlt}"`), `${p.slug}: card image`);
  const detail = await readFile(new URL(p.url.slice(1), root), 'utf8');
  assert.ok(detail.includes(`alt="${imageAlt}"`), `${p.slug}: detail image`);
  assert.ok(detail.includes(`<meta name="keywords" content="${display},`), `${p.slug}: detail search metadata`);
  for (const node of schemas(detail).flatMap(s=>collect(s,'Product'))) assert.equal(node.name, p.qualityDocumentation?.specificationBasis==='approved-tds-release'?p.name:display, p.slug);
  assert.equal(searchRecords.find(r=>r.slug===p.slug).name, display, p.slug);
 }
});


test('RFQ prefills use canonical display identities while routes and other parameters remain intact', async () => {
 for (const p of selected) {
  const input = '<a href="../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=Stale%20Name&amp;quantity_scale=5kg&amp;message=Keep%20this#form">Quote</a>';
  const expected = input.replace('Stale%20Name', encodeURIComponent(displayIdentity(p)));
  assert.equal(synchronizeRfqIdentity(input,p), expected);
  assert.equal(synchronizeRfqIdentity(expected,p), expected);
  const detail = await readFile(new URL(p.url.slice(1),root),'utf8');
  for (const match of detail.matchAll(/href="([^"]*contact\.html\?[^"]*product_interest=[^"]*)"/g)) {
   const url=new URL(match[1].replaceAll('&amp;','&'),'https://example.test/products/');
   assert.equal(url.searchParams.get('product_interest'),displayIdentity(p),p.slug);
  }
 }
 for (const path of ['products.html', ...[...identityFamilies].map(f=>`products/${f}.html`)]) {
  const html=await readFile(new URL(path,root),'utf8');
  for(const article of html.matchAll(/<article class="[^"]*product-card[\s\S]*?<\/article>/g)) {
   const p=selected.find(p=>article[0].includes(`href="${path==='products.html'?'products/':''}${p.slug}.html"`));
   if(!p)continue;
   for(const match of article[0].matchAll(/href="([^"]*contact\.html\?[^"]*product_interest=[^"]*)"/g)) {
    assert.equal(new URL(match[1].replaceAll('&amp;','&'),'https://example.test/').searchParams.get('product_interest'),displayIdentity(p));
   }
  }
 }
});

test('accessible labels omit repeated display abbreviations and retain genuine alternate aliases', async () => {
 const html=await readFile(new URL('products.html',root),'utf8');
 for(const p of selected) {
  const label=accessibilityIdentity(p), tokens=label.split('; '), display=p.displayAbbreviations || [p.primaryAbbreviation];
  assert.equal(new Set(tokens.map(s=>s.toLowerCase())).size,tokens.length,p.slug);
  for(const abbreviation of display) assert.ok(!tokens.slice(1).includes(abbreviation),p.slug);
  for(const alias of identityAliases(p).filter(a=>!display.includes(a)&&a!==p.chemicalName))assert.ok(tokens.includes(alias),`${p.slug}: retain ${alias}`);
  assert.ok(html.includes(`aria-label="${label}"`),p.slug);
 }
 const p=selected.find(p=>p.primaryAbbreviation==='LiPF6');
 assert.equal(accessibilityIdentity(p),'LiPF6; Lithium hexafluorophosphate; CAS 21324-40-3');
});
