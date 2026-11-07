import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanProductImage, synchronizeProductImages } from '../scripts/product-image-presentation.mjs';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

test('visible website image and clean Google image are separate and idempotent', () => {
  const p={slug:'sample',image:'/assets/images/product-images/merchant/sample-clean.png',merchantImage:'/assets/images/product-images/merchant/sample-clean.png',originalImage:'/assets/images/old.png',websiteImage:'/assets/images/product-images/website/artwork/sample.png',imageKind:'chemical',websiteImageWidth:1500,websiteImageHeight:1500};
  const before='<html><head><script type="application/ld+json">{"image":"https://www.winigenmaterials.com/assets/images/old.png"}</script></head><body><img src="/assets/images/old.png" alt="Sample"></body></html>';
  const after=synchronizeProductImages(before,[p]);
  assert.ok(after.includes('"image":"https://www.winigenmaterials.com'+p.image+'"'));
  assert.ok(after.includes('src="'+p.websiteImage+'"'));
  assert.ok(after.includes('width="1500" height="1500"'));
  assert.equal(synchronizeProductImages(after,[p]),after);
});
test('branded derivatives fail closed in the Merchant selector', () => {
  assert.throws(()=>cleanProductImage({slug:'bad',image:'/assets/images/product-images/website/bad.png'}),/cannot be used by Google/);
  assert.throws(()=>cleanProductImage({slug:'bad',image:'/assets/images/clean.png',merchantImage:'/assets/images/product-images/website/bad.png'}),/cannot be used by Google/);
});
test('external images, decorative logos, API routes and unrelated content stay untouched',()=>{
  const value='<head></head><img src="https://external.example/a.png"><img src="/assets/images/winigen-logo.png"><a href="/api/order-status">Status</a>';
  assert.equal(synchronizeProductImages(value,[{slug:'x',image:'/assets/images/a.png',imageKind:'chemical'}]),value);
});
test('all canonical image assignments are explicit; no website derivatives in feed or Product image',async()=>{
  const source=JSON.parse(await read('catalog/product-images.source.json'));
  const catalog=JSON.parse(await read('catalog/products.source.json'));
  const manifest=new Set((await read('cloudflare-site/public-assets.txt')).split('\n'));
  const feed=await read('feeds/google-merchant.xml');
  assert.ok(!feed.includes('/product-images/website/'));
  for (const [slug,r] of Object.entries(source.products)) {
    const p=catalog.products.find(p=>p.slug===slug);
    assert.equal(p.image,r.image);
    cleanProductImage(p);
    for (const path of [r.image,r.websiteImage].filter(Boolean)) {
      const local=new URL(path,'https://www.winigenmaterials.com').pathname.slice(1);
      assert.ok(manifest.has(local),local);
      assert.ok((await readFile(new URL('../'+local,import.meta.url))).length>0);
    }
    const page=await read(p.url.slice(1));
    for (const script of page.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.ok(!script[1].includes('/product-images/website/'),slug);
    }
  }
});

test('website branding and representative qualification are emitted once outside the figure',()=>{
  const p={slug:'sample',image:'/assets/images/product-images/merchant-materials/sample.png',websiteImage:'/assets/images/product-images/website/materials/sample.png',imageKind:'scientific',websiteImageWidth:1500,websiteImageHeight:1200,imageCaption:'Representative supplier SEM; not lot-specific.'};
  const source='<head></head><aside class="structure-panel"><img src="'+p.image+'"><a>TDS</a></aside>';
  const a=synchronizeProductImages(source,[p]);
  assert.equal((a.match(/product-image-caption/g)||[]).length,1);
  assert.ok(a.includes('data-website-branded="true"'));
  assert.equal(synchronizeProductImages(a,[p]),a);
});
