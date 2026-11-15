"""Reproducible website-only factual panels, using canonical facts, not photos."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
products=json.loads((ROOT/'catalog/products.source.json').read_text())['products']
OUTPUT=ROOT/'assets/images/product-images/website/scientific-1cb';OUTPUT.mkdir(exist_ok=True,parents=True)
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(size):return ImageFont.truetype(FONT,size)
records=[]
for p in products:
 if p['slug'] not in ['latp-d-50-0-3-um','latp-d-50-0-4-um','latp-d-50-0-65-um','latp-slurry']:continue
 im=Image.new('RGB',(1500,1200),'#f2f6fa');d=ImageDraw.Draw(im)
 d.rounded_rectangle((90,100,1410,1100),radius=35,fill='white',outline='#d2dfe8',width=3)
 d.text((165,170),'WINIGEN MATERIALS',font=font(30),fill='#315d7a')
 d.text((165,275),'LATP',font=font(100),fill='#172d46')
 props={x['name']:x['value'] for x in p['additionalProperty']}
 d.text((165,420),'Slurry' if p['slug']=='latp-slurry' else 'Powder',font=font(46),fill='#172d46')
 selected=['D50 options','Carrier solvent'] if p['slug']=='latp-slurry' else ['D50 particle size','Water']
 y=545
 for key in selected:
  d.text((165,y),key.upper(),font=font(26),fill='#547087');d.text((165,y+48),props[key],font=font(37),fill='#172d46');y+=140
 d.line((165,910,1335,910),fill='#b48d3e',width=3)
 d.text((165,955),'PRODUCT INFORMATION',font=font(26),fill='#315d7a')
 d.text((165,1005),'Not a photograph or microscopy image',font=font(30),fill='#547087')
 target=OUTPUT/(p['slug']+'-information.png');im.save(target,optimize=True)
 records.append({'slug':p['slug'],'image':'/'+target.relative_to(ROOT).as_posix(),'kind':'factual-information-panel','alt':p['name']+' — factual product information; not a photograph or microscopy image','approval':'Checkpoint 1C-B website only','sourceFacts':{k:props[k] for k in selected},'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'dimensions':[1500,1200]})
(ROOT/'design/option-a/scientific-artwork/latp-panels.lock.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('Generated',len(records),'factual LATP website panels')
