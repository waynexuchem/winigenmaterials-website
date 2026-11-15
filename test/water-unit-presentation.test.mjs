import test from 'node:test';import assert from 'node:assert/strict';
import {waterValue,waterText,waterHtml,waterCatalog,waterRevision} from '../design/option-a/water-units.mjs';
import {auditSpecificationRows} from '../design/option-a/card-geometry.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('Water-only mass units preserve numbers, operators and unrelated units',()=>{
 assert.equal(waterValue('Water','≤30 µg/g'),'≤30 ppm');assert.equal(waterValue('Water (KF)','≤15 μg/g'),'≤15 ppm');
 for(const label of ['Chloride','Metals','Water solubility'])assert.equal(waterValue(label,'≤30 µg/g'),'≤30 µg/g');
 for(const unit of ['µg/mL','mg/L','ppmv'])assert.equal(waterValue('Water','≤30 '+unit),'≤30 '+unit);
 assert.equal(waterText('water ≤20 µg/g; chloride ≤1 µg/g'),'water ≤20 ppm; chloride ≤1 µg/g');
 const html='<dl><div><dt>Water</dt><dd>≤30 µg/g</dd></div><div><dt>Chloride</dt><dd>≤1 µg/g</dd></div></dl>';
 assert.equal(waterHtml(html),html.replace('≤30 µg/g','≤30 ppm'));assert.equal(waterHtml(waterHtml(html)),waterHtml(html));
});
test('Canonical unit projection is reversible and changes only recorded fields',()=>{
 const data=JSON.parse(readFileSync(new URL('../catalog/products.source.json',import.meta.url)));
 assert.deepEqual(waterCatalog(data),data);assert.deepEqual(waterCatalog(waterCatalog(data,{historical:true})),data);
 for(const r of waterRevision.PDFs){assert.equal(createHash('sha256').update(readFileSync(new URL('../'+r.path.slice(1),import.meta.url))).digest('hex'),r.sha256);assert.equal(r.edits.length,2);}
});
test('Inner geometry detects label, value and separator regressions separately',()=>{
 const card={grid:'g',top:0,slug:'a',facts:[{label:10,value:30,separator:60,align:'right',clipped:false}]};
 assert.equal(auditSpecificationRows([card,{...card,slug:'b'}]).errors.length,0);
 for(const part of ['label','value','separator'])assert.ok(auditSpecificationRows([card,{...card,slug:'b',facts:[{...card.facts[0],[part]:card.facts[0][part]+3}]}]).errors.some(x=>x.part===part));
});
