import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root));
const json=async p=>JSON.parse(await read(p));
test('four approved chemical layouts retain recorded identities and exact approved website hashes',async()=>{
 const dir='design/option-a/scientific-artwork/chemistry/';const lock=await json(dir+'website-artwork.lock.json');const old=await json('docs/merchant-images/chemical-integration/approved-chemical-provenance.json');
 assert.equal(lock.length,4);
 for(const r of lock){const d=await json(dir+r.slug+'-definition.json');const prior=old.products.find(p=>p.slug===r.slug);assert.equal(d.inchiKey,prior.inchiKey);assert.equal(d.formula,prior.formula);assert.equal(d.cas,prior.cas);assert.equal(createHash('sha256').update(await read(r.websiteImage.slice(1))).digest('hex'),r.sha256);assert.equal(createHash('sha256').update(await read(dir+r.slug+'-definition.json')).digest('hex'),r.definitionSHA256);assert.match(d.status,/APPROVED_WEBSITE/);assert.equal(createHash('sha256').update(await read(dir+r.slug+'-candidate.svg')).digest('hex'),d.svgSHA256);assert.equal(d.smiles,prior.isomericSmiles||prior.smiles);const mol=(await read(dir+r.slug+'-candidate.mol')).toString();assert.match(mol,/M  END/);}
});
test('original chemical website and clean Merchant images remain byte-identical historical records',async()=>{
 const history=await json('design/option-a/scientific-artwork/chemistry/historical-sources.json');assert.equal(history.length,4);
 for(const r of history)for(const v of Object.values(r.originalImages))assert.equal(createHash('sha256').update(await read(v.path.replace(/^https:\/\/www.winigenmaterials.com\//,'').replace(/^\//,''))).digest('hex'),v.sha256);
});
