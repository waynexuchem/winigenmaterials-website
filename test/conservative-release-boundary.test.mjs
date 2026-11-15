import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,existsSync,readdirSync}from'node:fs';import{createHash}from'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),hash=b=>createHash('sha256').update(b).digest('hex'),base='34cd0919e5e8662e66ce8bfab0b7a906dbdc25d3',lock=JSON.parse(read('test/fixtures/private-payment-frozen.source.json'));
test('conservative static release freezes all five main-site payment assets to verified production Git bytes',()=>{
 for(const path of ['assets/js/private-order-checkout.js','private-orders/wq20260922-01.html','private-orders/wq20260923-01.html','private-orders/wq20261021-01.html','private-orders/confirmation.html']){const original=historicalSnapshot(['show',base+':'+path],{cwd:root});assert.deepEqual(read(path),original,path);assert.equal(hash(read(path)),lock.files[path],path);}
});
test('all production Worker and payment bytes remain exact; excluded private-only sources stay absent',()=>{
 for(const[path,sha]of Object.entries(lock.files)){assert.equal(hash(read(path)),sha,path);assert.equal(hash(historicalSnapshot(['show',base+':'+path],{cwd:root})),sha,path);}
 for(const path of ['assets/css/private-payment.css','private-orders/wq20261103-02.html','design/private-payments'])assert.equal(existsSync(new URL(path,root)),false,path);
 assert.equal(readdirSync(new URL('private-orders/',root)).some(p=>p.startsWith('pay-')),false);
});
test('893-path publication closure has no private review additions or original scientific sources',()=>{
 const manifest=read('cloudflare-site/public-assets.txt').toString().trim().split('\n');assert.equal(manifest.length,893);assert.equal(new Set(manifest).size,893);
 for(const path of manifest){assert.ok(existsSync(new URL(path,root)),path);assert.doesNotMatch(path,/^outputs\/|^test\/|^design\/|nonpublic-before|tds-unit-masters/);}
 for(const path of ['assets/css/private-payment.css','private-orders/wq20261103-02.html']){assert.ok(!manifest.includes(path));for(const page of manifest.filter(p=>p.endsWith('.html')))assert.ok(!read(page).toString().includes('/'+path),page+' requires '+path);}
});
