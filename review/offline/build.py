"""Build an allowlisted, browser-only review; never a production build/deploy."""
from pathlib import Path
import base64, hashlib, html, json, mimetypes, re, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[2]
BASE = 'f0fa509523eff76923585291bb62f325b405eafe'
OUT = ROOT / 'outputs/checkpoint-2e-2/universal-review'
SKIP = {'assets/js/contact.js', 'assets/js/private-order-checkout.js',
        'assets/js/stripe-live-test.js', 'assets/js/purchase-tracking.js',
        'assets/js/commerce-session-routing.js', 'assets/js/checkout-state.js',
        'assets/js/commerce-config.js', 'assets/js/legacy-redirect.js',
        'assets/css/private-order.css'}

def released(path):
    # Deliberately exclude unrelated dirty private-payment changes.
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)

def allowed(path):
    return (not path.startswith('private-orders/') and path not in SKIP
            and not path.startswith('.') and '..' not in Path(path).parts)

def production_scripts(source):
    source = source.replace('initializeGoogleTag();', '')
    start = source.index('function initializeGoogleTag()')
    end = source.index('function loadSharedScript(', start)
    source = source[:start] + source[end:]
    start = source.index('async function initializeEcommerce()')
    end = source.index('function initializeGlobalFooter()', start)
    source = source[:start] + '''function initializeEcommerce() {
      initializeCartNavigation(); initializeCartPage();
      window.dispatchEvent(new CustomEvent('winigen:ecommerce-ready'));
    }
    ''' + source[end:]
    # No transaction-creation code is shipped, even behind a disabled control.
    start = source.index("  root.querySelector('#cart-proceed')?.addEventListener")
    end = source.index('\n}\n', start)
    source = source[:start] + '''  root.querySelector('#cart-proceed')?.addEventListener('click', () =>
      window.parent.WinigenReview.notice('This is a website design preview. Checkout is disabled.'));
    ''' + source[end:]
    source = re.sub(r"const ga4MeasurementId = .*?;\n", '', source)
    return source

def adapt_script(path, source):
    if path == 'assets/js/main.js': source = production_scripts(source)
    # Virtual canonical location preserves existing page-sensitive presentation.
    source = re.sub(r'\b(?:window|platform|global|root)\.location\b', 'window.WinigenReviewLocation', source)
    source = re.sub(r'(?<![.\w])location\.', 'window.WinigenReviewLocation.', source)
    source = re.sub(r'\b(?:window|platform)\.history\b', 'window.WinigenReviewHistory', source)
    source = re.sub(r'(?<![.\w])history\.', 'window.WinigenReviewHistory.', source)
    return source

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'media').mkdir(exist_ok=True)
    image_policy=json.loads((ROOT/'design/option-a/active-material-illustrations.source.json').read_text())
    image_hashes={p['asset']:p['sha256'] for p in image_policy['products']}
    manifest = released('cloudflare-site/public-assets.txt').decode().splitlines()
    pages, texts, assets, inventory, exclusions = {}, {}, {}, [], []
    for path in manifest:
        if not allowed(path): exclusions.append(path); continue
        suffix = Path(path).suffix
        if suffix not in {'.html','.png','.webp','.jpg','.jpeg','.svg','.ico','.pdf','.css','.js'}: continue
        data = released(path)
        if path.startswith('assets/images/illustrations/active-materials/'):
            data = (ROOT / path).read_bytes()
            if hashlib.sha256(data).hexdigest()!=image_hashes.get(path):
                raise ValueError('Unreviewed illustrative image bytes: '+path)
        if suffix == '.html':
            content = data.decode()
            noindex = re.search(r'<meta[^>]*name="robots"[^>]*content="[^"]*noindex',content,re.I)
            if noindex and path != 'cart.html': exclusions.append(path); continue
            pages[path] = content
        elif suffix in {'.js','.css'}:
            texts[path] = adapt_script(path, data.decode()) if suffix == '.js' else data.decode()
        else:
            digest=hashlib.sha256(data).hexdigest()
            chunk='media/'+digest+'.js'
            (OUT/chunk).write_text('window.WINIGEN_REVIEW_MEDIA['+json.dumps(digest)+']='+json.dumps(base64.b64encode(data).decode())+';\n')
            assets[path] = [mimetypes.guess_type(path)[0] or 'application/octet-stream',digest,chunk]
        inventory.append({'path':path,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
    catalog = json.loads(released('catalog/products.source.json'))
    assert len(catalog['products']) == 124
    assert all(p['url'].lstrip('/') in pages for p in catalog['products'])
    forbidden = re.compile(r'sk_(?:live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|/Users/|127\.0\.0\.1|localhost|WQ2026',re.I)
    payload = {'pages':pages,'texts':texts,'assets':assets}
    for path, source in {**pages,**texts}.items():
        if forbidden.search(source): raise ValueError('Private/development reference: '+path)
    (OUT/'review-data.js').write_text('window.WINIGEN_REVIEW_DATA='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
    for path in ['START-HERE.html','review.js','review.css','READ-ME-FIRST.txt']:
        (OUT/path).write_bytes((ROOT/'review/offline'/path).read_bytes())
    for path in pages:
        target=OUT/'pages'/path;target.parent.mkdir(parents=True,exist_ok=True)
        prefix='../' * len(Path(path).parts)
        target.write_text('<!doctype html><meta charset="utf-8"><title>Winigen Website Review</title><script>location.replace('+json.dumps(prefix+'START-HERE.html')+'+"#"+encodeURIComponent('+json.dumps('/'+path)+'+location.search+location.hash));</script>')
    report={'baseline':BASE,'pages':len(pages),'productPages':124,'assets':len(assets),'publicDocuments':sum(p.endswith('.pdf') for p in assets),'scriptsAndStyles':len(texts),'excludedCount':len(exclusions),'inventory':inventory,'network':'CSP connect-src none; original transaction and contact modules excluded','privatePages':0}
    (OUT/'PACKAGE-INVENTORY.json').write_text(json.dumps(report,indent=2))
    output=OUT.parent/'Winigen-Website-Review-Universal.zip'
    pending=output.with_suffix('.building.zip')
    with zipfile.ZipFile(pending,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        approved={'START-HERE.html','review.js','review.css','review-data.js','READ-ME-FIRST.txt','PACKAGE-INVENTORY.json',
                  *('pages/'+p for p in pages),*(a[2] for a in assets.values())}
        for path in sorted(approved):
            p=OUT/path
            info=zipfile.ZipInfo(path,(2026,11,9,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,p.read_bytes())
    pending.replace(output)
    report.pop('inventory');report['zipBytes']=output.stat().st_size;report['zipSHA256']=hashlib.sha256(output.read_bytes()).hexdigest()
    (OUT.parent/'package-audit.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='excluded'},indent=2))

if __name__ == '__main__': build()
