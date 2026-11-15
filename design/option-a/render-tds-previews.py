"""Explicit local-only first-page rendering. Reads approved public PDFs, never private originals.
Requires the review environment's Pillow and pypdfium2. Not part of commerce or deployment.
Use --check to verify the committed previews without writing files.
"""
from pathlib import Path
import hashlib, io, json, sys
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[2]
records = json.loads((root / 'catalog/tds-branding-release.source.json').read_text())['previews']
for record in records:
    source = root / record['pdf'].lstrip('/')
    target = root / record['image'].lstrip('/')
    if hashlib.sha256(source.read_bytes()).hexdigest() != record['pdfSHA256']:
        raise ValueError('Unapproved PDF source: ' + record['code'])
    document = pdfium.PdfDocument(str(source))
    page = document[0]
    image = page.render(scale=record['width'] / page.get_width()).to_pil().convert('RGB')
    output = io.BytesIO()
    image.save(output, format='PNG', optimize=True)
    data = output.getvalue()
    if hashlib.sha256(data).hexdigest() != record['sha256']:
        raise ValueError('Rendering differs from approved preview; review renderer versions: ' + record['code'])
    if '--check' in sys.argv:
        if data != target.read_bytes():
            raise ValueError('Stale preview: ' + record['code'])
    else:
        target.write_bytes(data)
print('Verified four exact first-page previews.' if '--check' in sys.argv else 'Rendered four approved first-page previews.')
