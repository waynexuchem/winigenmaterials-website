"""Read-only public image inventory. Requires Pillow; outputs stay ignored/nonpublic.
No product, image, Merchant, sitemap or publishing policy is modified.
"""
import argparse,csv,hashlib,html,json,re
from collections import defaultdict,Counter
from pathlib import Path
from urllib.parse import urlparse,urljoin,unquote
from PIL import Image
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[2]
PRIORITY={'lithium-difluorobis-oxalato-phosphate-lidodfp','tris-trimethylsilyl-phosphate-tmsp','triallyl-phosphate-tap','tetravinylsilane-tvsi'}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def public_path(value,page='index.html'):
 u=urlparse(urljoin('https://www.winigenmaterials.com/'+page,value))
 return unquote(u.path).lstrip('/') if u.hostname in ['www.winigenmaterials.com','winigenmaterials.com'] and re.search(r'\.(png|jpe?g|webp|svg|gif|avif)$',u.path,re.I) else None
class Images(HTMLParser):
 def __init__(self):super().__init__();self.in_main=False;self.images=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='main':self.in_main=True
  if self.in_main:
   if tag=='img' and a.get('src'):self.images.append((a['src'],a.get('alt',''),a.get('class','')))
   for k,v in attrs:
    if 'fallback' in k and v and re.search(r'\.(png|jpe?g|webp)$',v):self.images.append((v,'Runtime fallback','fallback'))
 def handle_endtag(self,tag):
  if tag=='main':self.in_main=False

def audit(out):
 out.mkdir(parents=True,exist_ok=True)
 catalog=json.loads((ROOT/'catalog/products.source.json').read_text());products=catalog['products'];by_slug={p['slug']:p for p in products}
 chemical={p['slug']:p for p in json.loads((ROOT/'docs/merchant-images/chemical-integration/approved-chemical-provenance.json').read_text())['products']}
 mx={r['path']:r for r in csv.DictReader((ROOT/'docs/merchant-images/mxene-visual-qa/source-to-product.csv').open())}
 for r in json.loads((ROOT/'catalog/mxene-accordion-images.source.json').read_text())['records']:
  for role in ['merchant','website']:mx[r[role].lstrip('/')]=dict(r,technique='XRD' if 'xrd' in r['role'] else 'SEM',nativeDimensions=json.dumps(r['nativeDimensions']),qualityWarning=r['qualification'],scaleBarStatus=r.get('scaleBar',''))
 usage=defaultdict(lambda:defaultdict(set));alts=defaultdict(set)
 def add(slug,value,role,page=None,alt=''):
  path=public_path(value,page or by_slug[slug]['url'].lstrip('/'))
  if path:usage[slug][path].add(role);alts[(slug,path)].add(alt)
 for p in products:
  slug=p['slug'];page=p['url'].lstrip('/');s=(ROOT/page).read_text();parser=Images();parser.feed(s)
  for i,(src,alt,cls) in enumerate(parser.images):add(slug,src,'runtime fallback' if cls=='fallback' else 'hero' if i==0 else 'characterization / supporting',page,alt)
  for key,role in [('image','canonical / Merchant candidate'),('websiteImage','website canonical')]:
   if p.get(key):add(slug,p[key],role)
 # Actual category/master references, linked back to canonical identities.
 for file in [ROOT/'products.html',*(ROOT/f['url'].lstrip('/') for f in catalog['families'])]:
  s=file.read_text()
  for m in re.finditer(r'<article\b[^>]*>[\s\S]*?</article>',s):
   block=m[0];slug=next((x for x in by_slug if f'href="{x}.html"' in block or f'href="products/{x}.html"' in block or f'href="/products/{x}.html"' in block),None)
   if not slug:continue
   for img in re.finditer(r'<img\b[^>]*src="([^"]+)"[^>]*>',block):add(slug,img[1],'catalog card',file.relative_to(ROOT).as_posix())
 # Merchant actual use, rather than assuming every canonical candidate is submitted.
 sku={p.get('sku'):p['slug'] for p in products if p.get('sku')}
 commerce=json.loads((ROOT/'ecommerce/catalog.source.json').read_text())['products']
 sku.update({p['skuBase']:p['slug'] for p in commerce})
 feed=(ROOT/'feeds/google-merchant.xml').read_text()
 for item in re.findall(r'<item>[\s\S]*?</item>',feed):
  group=re.search(r'<g:item_group_id>([^<]+)',item);slug=sku.get(group[1]) if group else None
  if slug:
   for tag,v in re.findall(r'<g:(image_link|additional_image_link)>([^<]+)',item):add(slug,html.unescape(v),'Merchant primary' if tag=='image_link' else 'Merchant supplementary')
 manifest=set((ROOT/'cloudflare-site/public-assets.txt').read_text().splitlines())
 # Publicly deployed approved derivatives must be audited even when unassigned.
 for record in json.loads((ROOT/'catalog/mxene-accordion-images.source.json').read_text())['records']:
  for role in ['merchant','website']:
   path=record[role].lstrip('/')
   if path in manifest and path not in usage['ti3c2tx-mxene-accordion-multilayer-powder']:
    usage['ti3c2tx-mxene-accordion-multilayer-powder'][path].add('public manifest only; unassigned '+role+' derivative')

 rows=[];reuse=defaultdict(set)
 for slug,refs in usage.items():
  for path in refs:reuse[path].add(slug)
 for p in products:
  slug=p['slug'];refs=usage[slug]
  if not refs:
   rows.append(dict(product_id=p.get('sku') or slug,slug=slug,family=p['family'],public_url=p['url'],role='existing formula / identity panel (not an image)',path='',sha256='',dimensions='',file_type='NON_IMAGE',source='Published canonical product HTML',grade_sample='grade-dependent; no photograph claimed',website_usage='formula panel',merchant_usage='none',scientific_status='Preserve factual panel; do not invent photo',marks_status='not applicable',legibility='text panel',desktop_display='pending browser measurement',mobile_display='pending browser measurement',severity='MEDIUM',recommendation='Photograph / grade documentation require authority; formula panel can remain',approval='NO_NEW_PHOTOGRAPH_APPROVED',shared_products=''))
  for path,roles in refs.items():
   file=ROOT/path;exists=file.is_file();dimensions='';ft='MISSING'
   if exists:
    if file.suffix.lower()=='.svg':ft='SVG';dimensions='vector'
    else:
     with Image.open(file) as im:dimensions=f'{im.width} x {im.height}';ft=im.format
   ch=chemical.get(slug);m=mx.get(path)
   source='Legacy public asset; original photographic authenticity not independently established'
   status='No new scientific certification from file existence';marks='PENDING current visual review';legibility='PENDING current visual review';severity='MEDIUM';recommendation='Review original source / captions; preserve until reviewed';approval='REVIEW_PENDING'
   if ch and path in [ch.get(k,'').lstrip('/') for k in ['website','merchant','oldImage']]:
    source='Approved chemical graph / master; committed chemical-integration provenance'
    status='Recorded CAS/formula/connectivity verification; current visual review pending'
    severity='HIGH' if slug in PRIORITY else 'MEDIUM';recommendation='Graph-preserving geometry correction proposed; approval required' if slug in PRIORITY else 'Inspect branch geometry, labels and spacing';approval='PRIOR_RECORD_VERIFIED; 1C_REVIEW_PENDING'
   if m:
    source='Native supplier PDF / legacy extraction; committed MXene source-to-product mapping'
    status='Representative, not lot-specific; correct mapping must be retained'
    legibility=m.get('scaleBarStatus',m.get('scaleBar',''))+' '+m.get('qualityWarning','')
    severity='HIGH' if 'mo2ctx' in path or 'No scale bar' in legibility else 'MEDIUM';recommendation='Use larger original if available; do not reconstruct data';approval='PRIOR_FROZEN_ASSET; 1C_SOURCE_REVIEW_PENDING'
   if ('latp-' in path or slug.startswith('latp')) and ('photo' in path or 'representative-powder' in path):
    severity='HIGH';status='Photographic authenticity unverified; no authoritative grade-photo evidence';marks='No mark observed in contact review; not proof of authenticity';
    if 'latp-300nm-powder-photo' in path:status='Visible Doubao AI-generated attribution; NOT authenticated product photography';marks='DOUBAO AI-generated mark observed at native size';recommendation='Replace website photograph with factual product-information panel unless authentic authorized photo supplied; Merchant decision requires separate approval';approval='BLOCKED_AS_AUTHENTIC_PRODUCT_PHOTOGRAPH'
   if not exists:severity='CRITICAL';recommendation='Unresolved source reference; stop publication'
   rows.append(dict(product_id=p.get('sku') or slug,slug=slug,family=p['family'],public_url=p['url'],role='; '.join(sorted(roles)),path=path,sha256=sha(file) if exists else '',dimensions=dimensions,file_type=ft,source=source,grade_sample=next((x['value'] for x in p['additionalProperty'] if x['name']=='Grade'),'See product / source mapping'),website_usage=str(any('website' in r or 'hero' in r or 'catalog' in r or 'supporting' in r for r in roles)),merchant_usage='; '.join(r for r in roles if 'Merchant' in r),scientific_status=status,marks_status=marks,legibility=legibility,desktop_display='pending browser measurement',mobile_display='pending browser measurement',severity=severity,recommendation=recommendation,approval=approval,shared_products='; '.join(sorted(reuse[path]))))
 fields=list(rows[0]);
 with (out/'scientific-image-audit.csv').open('w',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 (out/'scientific-image-audit.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 unique=sorted({r['path'] for r in rows if r['path']});summary={'products':len(products),'associations':sum(bool(r['path']) for r in rows),'uniqueReferencedImages':len(unique),'formulaOnlyProducts':sum(not r['path'] for r in rows),'missingPaths':[x for x in unique if not (ROOT/x).is_file()],'notManifestListed':[x for x in unique if x not in manifest],'countsBySeverityAssociation':dict(Counter(r['severity'] for r in rows)),'assetHashes':{x:sha(ROOT/x) for x in unique if (ROOT/x).is_file()}}
 (out/'image-inventory-summary.json').write_text(json.dumps(summary,indent=2));return rows,summary
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'outputs/checkpoint-1c');args=parser.parse_args();rows,summary=audit(args.output);print(json.dumps({k:v for k,v in summary.items() if k!='assetHashes'},indent=2))
