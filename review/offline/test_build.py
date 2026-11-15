import importlib.util, pathlib, re, subprocess, unittest, json, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('offline_build',ROOT/'review/offline/build.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
class OfflineBoundary(unittest.TestCase):
 def test_private_and_transaction_modules_refused(self):
  for path in ['private-orders/confirmation.html','private-orders/pay-example.html','assets/js/contact.js','assets/js/private-order-checkout.js','assets/js/commerce-config.js','../secret.env']:
   self.assertFalse(build.allowed(path),path)
 def test_safe_shared_modules_allowed(self):
  for path in ['assets/js/cart.js','assets/js/ecommerce-catalog.js','products/lithium-salts.html']:
   self.assertTrue(build.allowed(path),path)
 def test_no_transaction_or_analytics_creator_in_preview(self):
  source=build.adapt_script('assets/js/main.js',build.released('assets/js/main.js').decode())
  self.assertNotIn('/api/create-checkout-session',source);self.assertNotIn('googletagmanager.com',source)
  self.assertNotIn('await import(',source);self.assertIn('initializeCartPage()',source)
 def test_page_sensitive_code_uses_virtual_location(self):
  for path in ['main','option-a','option-a-search','ecommerce-product-page','cart']:
   source=build.adapt_script('assets/js/'+path+'.js',build.released('assets/js/'+path+'.js').decode())
   self.assertNotRegex(source,r'\b(?:window|platform)\.location\.')
 def test_content_security_policy_has_no_network_authority(self):
  text=(ROOT/'review/offline/START-HERE.html').read_text()
  self.assertIn("connect-src 'none'",text);self.assertIn("form-action 'none'",text)
  self.assertNotRegex(text,r'http[s]?://')
 def test_no_runtime_file_fetch_or_modules(self):
  source=(ROOT/'review/offline/review.js').read_text()
  self.assertNotIn('fetch(',source);self.assertNotIn('import(',source)
  self.assertIn('new DOMParser()',source);self.assertIn("new Blob([bytes]",source)
 def test_required_page_identity_and_comparison_data_survives(self):
  source=(ROOT/'review/offline/review.js').read_text()
  self.assertIn("['application/json','application/ld+json'].includes(el.type)",source)
 def test_material_class_changes_are_bounded(self):
  data=json.loads((ROOT/'design/option-a/active-material-illustrations.source.json').read_text())['products']
  self.assertEqual(len(data),19);self.assertEqual(sum(x['presentationClass']['changedIn2E2'] for x in data),11)
  for x in data:
   self.assertEqual(hashlib.sha256((ROOT/x['asset']).read_bytes()).hexdigest(),x['sha256'])
   if 'foil' in x['slug']:self.assertFalse(x['presentationClass']['changedIn2E2'])
if __name__=='__main__':unittest.main()
