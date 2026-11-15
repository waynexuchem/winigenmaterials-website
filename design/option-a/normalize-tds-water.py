"""Deterministic, unit-only revisions from frozen, previously public Winigen PDF masters.
Never accepts private supplier originals; the explicit manifest and hashes are the boundary.
Run with the review Python runtime (pypdf, pdfplumber, pypdfium2, Pillow).
"""
from pathlib import Path
import io,json,re,hashlib,copy,sys
from pypdf import PdfReader,PdfWriter
from pypdf.generic import ContentStream,ByteStringObject,TextStringObject,NameObject
import pdfplumber,pypdfium2 as pdfium
from PIL import ImageChops,ImageDraw
r=Path(__file__).resolve().parents[2];source=r/'catalog/water-units.source.json';out=r/'outputs/option-a-release-readiness-20261114';sha=lambda b:hashlib.sha256(b).hexdigest()
def raw(x):return x.original_bytes if isinstance(x,TextStringObject)else bytes(x)
def signature(x):
 if isinstance(x,(ByteStringObject,TextStringObject)):return ('text',raw(x).hex())
 if isinstance(x,(list,tuple)):return[signature(v)for v in x]
 return str(x)
def images(pdf):return[[sha(im.data)for im in p.images]for p in pdf.pages]
def numbers(pdf):return[re.findall(r'[≤≥<>±×]|[-+]?\d+(?:\.\d+)?',p.extract_text())for p in pdf.pages]
def revise(data):
 old=PdfReader(io.BytesIO(data));w=PdfWriter();w.clone_document_from_reader(old);edits=[]
 for pi,p in enumerate(w.pages):
  s=ContentStream(p.get_contents(),w);waterIndex=None;changed=[]
  for i,(a,op)in enumerate(s.operations):
   if op!=b'Tj':continue
   b=raw(a[0]);text=b.decode('latin1')
   if text.startswith('Water'):waterIndex=i
   replacement=None
   if waterIndex is not None and i>waterIndex and i-waterIndex<65 and re.fullmatch(rb'.g/g',b):replacement=b'ppm';waterIndex=None
   if re.search(rb'.g/g\s+water\b',b):replacement=re.sub(rb'.g/g(?=\s+water\b)',b'ppm',b)
   if replacement is not None:
    s.operations[i][0][0]=ByteStringObject(replacement);changed.append(i);edits.append({'page':pi+1,'operation':i,'beforeHex':b.hex(),'afterHex':replacement.hex()})
  if changed:p[NameObject('/Contents')]=w._add_object(s)
 assert len(edits)==2,edits
 w.add_metadata({'/Subject':'Water unit presentation revision WU-20261114: ppm (w/w). Specification limits and representative numerical results remain unchanged.'})
 stream=io.BytesIO();w.write(stream);new=stream.getvalue();check=PdfReader(io.BytesIO(new));assert numbers(old)==numbers(check)and images(old)==images(check)
 for pi,(a,b)in enumerate(zip(old.pages,check.pages)):
  x=ContentStream(a.get_contents(),old).operations;y=ContentStream(b.get_contents(),check).operations;assert len(x)==len(y)
  changed={e['operation']:e for e in edits if e['page']==pi+1}
  for i,((ax,ox),(ay,oy))in enumerate(zip(x,y)):
   assert ox==oy
   if signature(ax)!=signature(ay):assert i in changed and ox==b'Tj'and raw(ax[0]).hex()==changed[i]['beforeHex']and raw(ay[0]).hex()==changed[i]['afterHex']
 return new,edits
if not source.exists():
 inventory=json.loads((out/'tds-text-inventory.internal.json').read_text());affected=[x for x in inventory if x['massMicrogramWater']];records=[];byHash={};masters=r/'design/option-a/tds-unit-masters';masters.mkdir(exist_ok=True)
 for x in affected:
  p=r/x['path'];data=p.read_bytes();h=sha(data)
  if h not in byHash:
   master=masters/p.name;master.write_bytes(data);byHash[h]=str(master.relative_to(r))
  records.append({'path':'/'+x['path'],'classification':'C — backward-compatible Winigen-controlled alias'if p.name.endswith('TFEC_Representative_TDS_RevB.pdf')else'A — Winigen-controlled current TDS','sourceMaster':byHash[h],'beforeSHA256':h})
 source.write_text(json.dumps({'revision':'WU-20261114','date':'2026-11-14','scope':'Water-only mass-concentration unit presentation; 1 µg/g = 1 ppm (w/w). No limit or representative value changes.','method':'Original authoring projects were not available in the canonical repository. Regenerate from the frozen, previously public Winigen-controlled PDF masters by substituting only the water-unit text operands. All other drawing operations, images and numbers are checked.','PDFs':records},indent=2)+'\n')
manifest=json.loads(source.read_text());report=[]
for rec in manifest['PDFs']:
 original=(r/rec['sourceMaster']).read_bytes();assert sha(original)==rec['beforeSHA256'];current,edits=revise(original);assert revise(original)[0]==current
 if rec.get('sha256'):assert sha(current)==rec['sha256']
 target=r/rec['path'].lstrip('/');rec['sha256']=sha(current);rec['edits']=edits;rec['numericOperatorsAndImagesUnchanged']=True
 # Independent rendering: every pixel outside the two edited text lines is identical.
 with pdfplumber.open(io.BytesIO(original))as a,pdfplumber.open(io.BytesIO(current))as b:
  frames=[]
  for pi,(ap,bp)in enumerate(zip(a.pages,b.pages)):
   aa=ap.extract_text_lines();bb=bp.extract_text_lines();assert len(aa)==len(bb);rects=[]
   for x,y in zip(aa,bb):
    if x['text']==y['text']:continue
    assert ('water'in x['text'].lower()or x['text'].startswith('Water'))and re.sub(r'[µμ]g/g','ppm',x['text'])==y['text'],(target.name,x['text'],y['text'])
    rects.append([min(x['x0'],y['x0'])-2,min(x['top'],y['top'])-2,max(x['x1'],y['x1'])+2,max(x['bottom'],y['bottom'])+2])
   da=pdfium.PdfDocument(original);db=pdfium.PdfDocument(current);ia=da[pi].render(scale=1.5).to_pil().convert('RGB');ib=db[pi].render(scale=1.5).to_pil().convert('RGB');diff=ImageChops.difference(ia,ib);draw=ImageDraw.Draw(diff)
   for box in rects:draw.rectangle(tuple(v*1.5 for v in box),fill='black')
   assert diff.getbbox()is None,(target.name,'pixels outside water-unit edits changed')
   if '--check'not in sys.argv:
    d=out/'pdf-renders'/target.stem;d.mkdir(parents=True,exist_ok=True);ia.save(d/f'before-{pi+1}.png');ib.save(d/f'after-{pi+1}.png')
   frames.append({'page':pi+1,'editedLineBounds':rects,'allOtherPixelsIdentical':True})
 if '--check'in sys.argv:assert target.read_bytes()==current,target
 else:target.write_bytes(current)
 report.append({**rec,'renderChecks':frames})
if '--check'not in sys.argv:source.write_text(json.dumps(manifest,indent=2)+'\n');(out/'pdf-integrity.json').write_text(json.dumps(report,indent=2))
print('Verified'if'--check'in sys.argv else'Revised',len(report),'PDF paths; numbers, graphics, non-water units and unedited pixels unchanged.')
