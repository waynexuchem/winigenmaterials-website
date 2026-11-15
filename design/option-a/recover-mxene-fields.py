"""Reproduce only five previously approved fields from an explicitly supplied, hash-locked PDF.
The supplier PDF is nonpublic and is never searched for, copied, or downloaded by this tool.
Normal static generation needs only the committed PNGs and source manifest.
"""
from pathlib import Path
import argparse,hashlib,io,json
from PIL import Image
from pypdf import PdfReader
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True,type=Path);parser.add_argument('--check',action='store_true');args=parser.parse_args()
records=json.loads((root/'design/option-a/scientific-artwork/mxene-recovered-fields.source.json').read_text())
raw=args.source.read_bytes();digest=hashlib.sha256(raw).hexdigest()
if any(r['sourcePDFSHA256']!=digest for r in records):raise SystemExit('Unapproved source PDF hash; no files written')
pdf=PdfReader(io.BytesIO(raw))
# Validate every field before allowing any output mutation.
outputs=[]
for r in records:
 images=[im for im in pdf.pages[r['page']-1].images if im.indirect_reference.idnum==r['object']]
 if len(images)!=1:raise SystemExit('Source object is absent or ambiguous')
 source=images[0].data
 if hashlib.sha256(source).hexdigest()!=r['sourceObjectSHA256']:raise SystemExit('Native object hash differs')
 im=Image.open(io.BytesIO(source)).convert('RGB');assert list(im.size)==json.loads(r['nativeDimensions'])
 im=im.crop(tuple(r['crop']));assert list(im.size)==r['deliveredDimensions'];assert hashlib.sha256(im.tobytes()).hexdigest()==r['pixelSHA256']
 out=io.BytesIO();im.save(out,format='PNG',optimize=False,compress_level=9);data=out.getvalue()
 if hashlib.sha256(data).hexdigest()!=r['sha256']:raise SystemExit('PNG encoder differs; pixel match alone is not permission to rewrite approved bytes')
 outputs.append((root/r['path'],data))
for path,data in outputs:
 if args.check:assert path.read_bytes()==data,path
 else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print(f'{len(outputs)} authentic fields: source, crop pixels and PNG bytes verified; no resizing or reconstruction')
