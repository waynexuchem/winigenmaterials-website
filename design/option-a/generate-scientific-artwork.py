"""Explicit offline artwork generation, not part of commerce/deployment builds.
Requires RDKit 2025.09.3 and Pillow. Does not rewrite frozen Merchant assets.
"""
from pathlib import Path
import json,hashlib,math
from rdkit import Chem,rdBase
from rdkit.Chem import rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D
ROOT=Path(__file__).resolve().parents[2]
MASTER=ROOT/'design/option-a/scientific-artwork/chemistry'
OUTPUT=ROOT/'assets/images/product-images/website/scientific-1cb'
OUTPUT.mkdir(parents=True,exist_ok=True)
records=[]
for definition in sorted(MASTER.glob('*-definition.json')):
 d=json.loads(definition.read_text());mol=Chem.MolFromSmiles(d['smiles']);assert mol
 assert Chem.MolToInchiKey(mol)==d['inchiKey']
 assert Chem.MolToInchiKey(Chem.MolFromMolFile(str(MASTER/(d['slug']+'-candidate.mol'))))==d['inchiKey']
 conf=Chem.Conformer(mol.GetNumAtoms());conf.Set3D(False)
 for idx,(x,y) in d['coordinates'].items():conf.SetAtomPosition(int(idx),(x,y,0.))
 mol.RemoveAllConformers();mol.AddConformer(conf)
 if d['slug'].startswith('lithium-'):
  p=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==15)
  assert p.GetDegree()==6 and sorted(map(len,mol.GetRingInfo().AtomRings()))==[5,5]
  assert sorted(Chem.GetFormalCharge(fragment) for fragment in Chem.GetMolFrags(mol,asMols=True))==[-1,1]
 if d['slug'].startswith('tetravinyl'):
  assert next(a for a in mol.GetAtoms() if a.GetAtomicNum()==14).GetDegree()==4
  assert sum(b.GetBondTypeAsDouble()==2 for b in mol.GetBonds())==4
 draw=rdMolDraw2D.MolDraw2DCairo(1500,1500);opt=draw.drawOptions();opt.bondLineWidth=5;opt.fixedFontSize=52;opt.padding=.12;opt.updateAtomPalette({6:(.11,.17,.21),8:(.72,.10,.12),9:(.09,.39,.23),15:(.52,.29,.12),14:(.11,.17,.21),3:(.40,.20,.57)})
 draw.DrawMolecule(mol);draw.FinishDrawing();out=OUTPUT/(d['slug']+'-website.png');out.write_bytes(draw.GetDrawingText())
 records.append({'slug':d['slug'],'inchiKey':d['inchiKey'],'formulaComputed':rdMolDescriptors.CalcMolFormula(mol),'websiteImage':'/'+out.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'definitionSHA256':hashlib.sha256(definition.read_bytes()).hexdigest(),'rdkit':rdBase.rdkitVersion,'approval':'Checkpoint 1C-B: reviewed graph-preserving layout; website only','sourceReferences':d.get('sourceURLs',{})})
(ROOT/'design/option-a/scientific-artwork/chemistry/website-artwork.lock.json').write_text(json.dumps(records,indent=2)+'\n')
print('Validated and generated',len(records),'website chemical images')
