import hashlib,json,re,sys,unittest
from pathlib import Path
from lxml import html,etree
from PIL import Image
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];SLUG='ti3c2tx-mxene-accordion-multilayer-powder';SOURCE_MANIFEST=ROOT/'catalog/mxene-accordion-images.source.json'
class AccordionReview(unittest.TestCase):
 def setUp(self):self.p=next(p for p in json.loads((ROOT/'catalog/products.source.json').read_text())['products'] if p['slug']==SLUG);self.doc=html.parse(str(ROOT/self.p['url'].lstrip('/')))
 def test_distinct_identity_and_rfq_only(self):
  rows=json.loads((ROOT/'catalog/products.source.json').read_text())['products'];self.assertEqual(sum(p['family']=='mxene-materials' for p in rows),24);self.assertEqual(sum(p['sku']==self.p['sku'] for p in rows),1);self.assertEqual((self.p['purchaseMode'],self.p['commerceStatus'],self.p['schemaOfferEligible']),('rfq','rfq',False));self.assertNotIn(SLUG,(ROOT/'ecommerce/catalog.source.json').read_text())
 def test_no_offer_or_commerce_control(self):
  graphs=[json.loads(n.text) for n in self.doc.xpath('//script[@type="application/ld+json"]')];types=[x.get('@type') for g in graphs for x in g.get('@graph',[g])];self.assertIn('WebPage',types);self.assertNotIn('Product',types);self.assertNotIn('Offer',types);self.assertFalse(self.doc.xpath('//*[contains(text(),"Add to Cart")]'));self.assertNotIn(SLUG,(ROOT/'feeds/google-merchant.xml').read_text())
 def test_committed_source_records_and_approved_public_hashes(self):
  manifest=json.loads(SOURCE_MANIFEST.read_text());rows=manifest['records'];self.assertEqual([r['object'] for r in rows],[71,72,73]);self.assertTrue(all(r['page']==5 for r in rows));self.assertRegex(manifest['sourcePDFSHA256'],r'^[a-f0-9]{64}$')
  for r in rows:
   self.assertRegex(r['sourceSHA256'],r'^[a-f0-9]{64}$');self.assertRegex(r['nativeCleanSHA256'],r'^[a-f0-9]{64}$')
   left,top,right,bottom=r['crop'];self.assertGreaterEqual(left,0);self.assertGreaterEqual(top,0);self.assertLessEqual(right,r['nativeDimensions'][0]);self.assertLessEqual(bottom,r['nativeDimensions'][1]);self.assertEqual([right-left,bottom-top],r['retainedDimensions'])
   for key,size in [('merchant',(1500,1500)),('website',(1500,1200))]:
    path=ROOT/r[key].lstrip('/');self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),r[key+'SHA256'],str(path))
    with Image.open(path) as image:self.assertEqual(image.size,size)
  # Original/native pixel equality is an explicit private-source audit, never silently skipped here.
  self.assertTrue((ROOT/'test/verify_mxene_original_pixels.py').is_file())
 def test_navigation_dom_order(self):
  ids=[a.get('href')[1:] for a in self.doc.xpath('//nav[@aria-label="Product sections"]//a')];allids=[n.get('id') for n in self.doc.xpath('//*[@id]')];self.assertEqual(len(ids),len(set(ids)));self.assertEqual([allids.index(x) for x in ids],sorted(allids.index(x) for x in ids));self.assertIn('selection-guide',ids)
 def test_manifest_and_source_boundary(self):
  manifest=(ROOT/'cloudflare-site/public-assets.txt').read_text().splitlines();self.assertFalse(any(p.startswith('docs/') for p in manifest))
  for r in json.loads(SOURCE_MANIFEST.read_text())['records']:
   for k in ('website','merchant'):self.assertIn(r[k].lstrip('/'),manifest);self.assertTrue((ROOT/r[k].lstrip('/')).is_file())
 def test_disclaimers_no_fabricated_guarantees(self):
  text=' '.join(self.doc.xpath('//main//text()'));self.assertIn('10–100 S/cm',text);self.assertIn('15 ± 5 m²/g',text);self.assertIn('not guaranteed release specifications',text);self.assertNotIn('3.43',text);self.assertNotIn('≤2%',text);self.assertNotIn('guaranteed purity',text)
 def test_tds_english_and_representative(self):
  text=' '.join(' '.join(p.extract_text().split()) for p in PdfReader(ROOT/self.p['mxene']['tds'].lstrip('/')).pages);self.assertIn('TI3C2TX-ACC-ML-TDS-001',text);self.assertIn('not lot-specific release specifications',text);self.assertFalse(re.search('[\u4e00-\u9fff]|ZEISS|新烯',text));self.assertIn('10–100 S/cm',text)
 def test_search_sitemap_related(self):
  self.assertIn(SLUG,(ROOT/'assets/js/product-search-index.js').read_text());xml=etree.parse(str(ROOT/'sitemap.xml'));self.assertEqual(len(xml.xpath('//*[local-name()="loc" and text()="https://www.winigenmaterials.com/products/'+SLUG+'.html"]')),1);self.assertIn(SLUG,(ROOT/'products/ti3c2tx-mxene-multilayer-powder.html').read_text())
 def test_correct_qualitative_solubility_without_dispersion_inference(self):
  prop=next(x for x in self.p['additionalProperty'] if x['name']=='Water solubility');self.assertEqual(prop['value'],'Poor (supplier-reported, qualitative)')
  values=[json.dumps(self.p),''.join(self.doc.xpath('//main//text()'))]
  for value in values:
   self.assertNotRegex(value,r'(?i)water dispersibility|poor dispersibility|dispersion.stability|hydrophilicity|redispersibility|solvent compatibility')
  text=' '.join(' '.join(p.extract_text().split()) for p in PdfReader(ROOT/self.p['mxene']['tds'].lstrip('/')).pages);self.assertIn('Water solubility',text);self.assertIn('Poor (supplier-reported, qualitative)',text);self.assertNotIn('Water dispersibility',text)
 def test_fixed_issue_date_and_pdf_metadata(self):
  reader=PdfReader(ROOT/self.p['mxene']['tds'].lstrip('/'));self.assertEqual(len(reader.pages),3);m=reader.metadata;self.assertEqual(m.author,'Winigen Materials');self.assertEqual(m.title,'Winigen Materials — Ti₃C₂Tₓ MXene Accordion-Structured Multilayer Powder TDS');self.assertEqual(m.subject,'Representative Technical Data Sheet');self.assertEqual(m['/CreationDate'],"D:20261107120000+00'00'");self.assertEqual(m['/ModDate'],m['/CreationDate']);self.assertIn('Issue date: November 7, 2026',reader.pages[0].extract_text());self.assertIn('Measurement conditions and axis definitions were not provided.',' '.join(p.extract_text() for p in reader.pages))
 def test_sem_occupancy_and_unchanged_xrd_exports(self):
  rows=json.loads(SOURCE_MANIFEST.read_text())['records']
  for r in rows:
   if r['object']==73:
    self.assertEqual(r['merchantSHA256'],'7a65897677d7fa80558769bf9eefd4f368e23c47a00206946bb106c05b1dd38f');self.assertEqual(r['websiteSHA256'],'ce28328fc2e80eb37991bf28369623dd03eb785eeecd37c3a7d3bbb9ee57c0ab');continue
   for k in ('merchant','website'):
    rect=r['presentation'][k]['fieldPixels'];self.assertGreaterEqual(rect[2]/1500,.75);self.assertLessEqual(rect[2]/1500,.80);self.assertAlmostEqual(rect[2]/rect[3],910/768,places=2)
    if k=='website':self.assertLess(rect[1]+rect[3],1025)
 def test_new_record_never_gains_price_or_package_skus(self):
  self.assertFalse(any(k in self.p for k in ('price','prices','packages','variants','ecommerceSlug')));self.assertEqual(len(self.p['mxene']['technicalGradeOptions']),2)
if __name__=='__main__':unittest.main()
