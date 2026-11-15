import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {historicalBytes,historicalPaths,historicalSnapshot,verifyHistoricalBytes} from './helpers/historical-fixtures.mjs';
const root=new URL('../',import.meta.url),dir=new URL('./fixtures/preservation-history/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir))),sha=b=>createHash('sha256').update(b).digest('hex');
test('every historical fixture reproduces its independently recorded SHA-256 without Git access',()=>{
 let checked=0;for(const [rev,snapshot] of Object.entries(manifest.snapshots))for(const [path,expected] of Object.entries(snapshot.files)){assert.equal(sha(historicalBytes(rev,path)),expected,rev+':'+path);checked++;}assert.ok(checked>1000);
});
test('historical authority fails closed on tampering, unknown inputs and unsafe paths',()=>{
 assert.throws(()=>verifyHistoricalBytes(Buffer.from('altered'),sha(Buffer.from('approved'))),/SHA-256 mismatch/);
 assert.throws(()=>historicalBytes('unknown','index.html'),/Unreviewed historical commit/);
 assert.throws(()=>historicalBytes('52c8b9b','unknown.html'),/Unreviewed historical path/);
 for(const path of ['../index.html','/index.html','assets/../index.html'])assert.throws(()=>historicalBytes('52c8b9b',path),/Invalid historical path/);
 assert.throws(()=>historicalSnapshot(['fetch','origin']),/Unsupported historical snapshot request/);
});
test('reviewed historical tree lists are exact and returned defensively',()=>{
 let checked=0;for(const [rev,snapshot] of Object.entries(manifest.snapshots))for(const [roots,expected]of Object.entries(snapshot.trees)){
  const actual=historicalPaths(rev,JSON.parse(roots));assert.deepEqual(actual,expected);actual.push('unapproved');assert.deepEqual(historicalPaths(rev,JSON.parse(roots)),expected);checked++;
 }assert.ok(checked>0);
});
test('private-payment history is hash-only and fixtures stay outside the explicit public boundary',()=>{
 const compressed=readFileSync(new URL('blobs.json.gz',dir));assert.equal(sha(compressed),manifest.archiveSHA256);
 const blobs=JSON.parse(gunzipSync(compressed));let privateRecords=0;
 for(const snapshot of Object.values(manifest.snapshots))for(const [path,expected]of Object.entries(snapshot.files))if(/private-orders\/|private-payments\/|private-order/.test(path)){
  assert.ok(!Object.hasOwn(blobs,expected),'Private payload must not be archived: '+path);assert.equal(sha(readFileSync(new URL(path,root))),expected,path);privateRecords++;
 }assert.ok(privateRecords>0);
 const published=readFileSync(new URL('cloudflare-site/public-assets.txt',root),'utf8').trim().split('\n');assert.equal(published.length,893);assert.ok(!published.some(p=>p.startsWith('test/')));
 for(const hex of Object.values(blobs)){const text=Buffer.from(hex,'hex').toString('utf8');assert.doesNotMatch(text,/(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{12,}|chuang[\w.-]*@google\.com|7970 S Energy|1600 Amphitheatre/i);}
});
