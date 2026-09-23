import test from 'node:test';
import assert from 'node:assert/strict';
import { updateMerchantSkus } from '../../scripts/generate-google-merchant-feed.mjs';
const item=(id,price)=>`    <item>\n      <g:id>${id}</g:id>\n      <g:price>${price}</g:price>\n    </item>`;
const current=`header\n${item('A',300)}\n<!-- preserve -->\n${item('TTPI',10)}\nfooter\n`;
const generated=`header\n${item('A',325)}\n${item('TTPI',99)}\nfooter\n`;
test('scoped Merchant update preserves unselected items and surrounding bytes',()=>{
 const result=updateMerchantSkus(current,generated,['A']);
 assert.equal(result,current.replace(item('A',300),item('A',325)));
 assert.equal(updateMerchantSkus(result,generated,['A']),result);
});
test('scoped Merchant update rejects missing, duplicate and excluded SKU selections',()=>{
 for(const skus of [[],['A','A'],['UNKNOWN']]) assert.throws(()=>updateMerchantSkus(current,generated,skus));
 assert.throws(()=>updateMerchantSkus(current,item('TTPI',99),['A']));
 assert.throws(()=>updateMerchantSkus(current+item('A',300),generated,['A']));
});
