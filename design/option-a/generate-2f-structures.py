"""Explicit website-only ACS-inspired vector drawing from committed verified graphs.
RDKit 2025.09.3. No network, supplier imports, Merchant/PDF/source-image writes.
Run --prototype first; inspect representative salts, solvents and branched examples before --all.
16.272 pt is a Winigen review choice, 13% above ACS-inspired 14.4 pt, not an official hybrid standard.
"""
from pathlib import Path
import argparse, hashlib, json, re, xml.etree.ElementTree as ET
from rdkit import Chem, rdBase
from rdkit.Geometry import Point2D
from rdkit.Chem import rdDepictor, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/merchant-images/chemical-integration/approved-chemical-provenance.json'
REVIEW=ROOT/'outputs/editorial-refinement/structures'
PUBLIC=ROOT/'assets/images/product-images/website/structures-2f'
PROTO=['lithium-hexafluorophosphate-lipf6','lithium-bis-fluorosulfonyl-imide-lifsi',
 'lithium-bis-trifluoromethane-sulphonyl-imide-litfsi','lithium-bis-oxalato-borate-libob',
 'lithium-difluorobis-oxalato-phosphate-lidodfp','dimethyl-carbonate-dmc',
 'vinylene-carbonate-vc','1-3-2-dioxathiolane-2-2-dioxide-dtd',
 'ethoxy-pentafluoro-cyclotriphosphazene-pfpn','tetravinylsilane-tvsi',
 'triallyl-phosphate-tap','tris-trimethylsilyl-phosphate-tmsp','tris-2-2-2-trifluoroethyl-phosphate-tfep']
PALETTE={6:(.10,.15,.20),7:(.12,.29,.52),8:(.65,.15,.17),9:(.16,.39,.29),
 15:(.48,.32,.16),16:(.50,.38,.14),5:(.32,.28,.46),3:(.40,.24,.49),11:(.40,.24,.49),
 14:(.10,.15,.20),17:(.16,.39,.29),35:(.48,.25,.18)}

def prepare(record):
    mol=Chem.MolFromSmiles(record.get('isomericSmiles') or record.get('smiles'))
    if not mol: raise ValueError('Invalid verified graph: '+record['slug'])
    Chem.SanitizeMol(mol)
    assert Chem.MolToInchiKey(mol)==record['inchiKey'],record['slug']
    assert rdMolDescriptors.CalcMolFormula(mol)==record['formula'],record['slug']
    expected=record.get('fragmentCharges')
    charges=sorted(Chem.GetFormalCharge(m) for m in Chem.GetMolFrags(mol,asMols=True))
    if expected is not None: assert charges==sorted(expected),record['slug']
    definition=ROOT/'design/option-a/scientific-artwork/chemistry'/(record['slug']+'-definition.json')
    if definition.exists():
        d=json.loads(definition.read_text());assert Chem.MolToInchiKey(Chem.MolFromSmiles(d['smiles']))==record['inchiKey']
        conf=Chem.Conformer(mol.GetNumAtoms());conf.Set3D(False)
        # Atom indices belong to the approved definition's own graph ordering.
        mol=Chem.MolFromSmiles(d['smiles']);conf=Chem.Conformer(mol.GetNumAtoms());conf.Set3D(False)
        for i,(x,y) in d['coordinates'].items():conf.SetAtomPosition(int(i),(x,y,0))
        mol.RemoveAllConformers();mol.AddConformer(conf)
    else:rdDepictor.Compute2DCoords(mol,canonOrient=True,clearConfs=True)
    if record['slug']=='lithium-nitrate-lino3':
        # A horizontal N=O bond leaves the N+ superscript clear of the bond.
        # Coordinates change depiction only; the verified ionic graph is untouched.
        conf=mol.GetConformer();n=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==7)
        conf.SetAtomPosition(n.GetIdx(),(0,0,0));single=[]
        for a in n.GetNeighbors():
            if mol.GetBondBetweenAtoms(n.GetIdx(),a.GetIdx()).GetBondTypeAsDouble()==2:conf.SetAtomPosition(a.GetIdx(),(1.5,0,0))
            else:single.append(a.GetIdx())
        for i,y in zip(sorted(single),[1.299038,-1.299038]):conf.SetAtomPosition(i,(-.75,y,0))
        li=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==3);conf.SetAtomPosition(li.GetIdx(),(-4.1,0,0))
    # Recheck difficult coordination, ionic charges and ring counts independently.
    if record['slug']=='lithium-hexafluorophosphate-lipf6':
        p=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==15);assert p.GetDegree()==6 and p.GetFormalCharge()==-1
    if record['slug']=='lithium-bis-oxalato-borate-libob':
        b=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==5);assert b.GetDegree()==4 and b.GetFormalCharge()==-1
        assert sorted(map(len,mol.GetRingInfo().AtomRings()))==[5,5]
    if record['slug']=='lithium-difluorobis-oxalato-phosphate-lidodfp':
        p=next(a for a in mol.GetAtoms() if a.GetAtomicNum()==15);assert p.GetDegree()==6 and sorted(map(len,mol.GetRingInfo().AtomRings()))==[5,5]
    return mol,charges

def complexity(mol):
    heavy=mol.GetNumHeavyAtoms();carbon=sum(a.GetAtomicNum()==6 for a in mol.GetAtoms())
    return 'compact-inorganic' if carbon==0 and heavy<=12 else 'small-organic' if heavy<=12 else 'large-branched' if heavy>=20 or (heavy>=16 and max(a.GetDegree() for a in mol.GetAtoms())>=4) else 'medium'

def draw(mol,scale=1,png=False):
    drawer=rdMolDraw2D.MolDraw2DCairo(-1,-1) if png else rdMolDraw2D.MolDraw2DSVG(-1,-1,-1,-1,True)
    opt=drawer.drawOptions();mean=rdMolDraw2D.MeanBondLength(mol) or 1.5
    rdMolDraw2D.SetACS1996Mode(opt,mean)
    bond=18.7128 if complexity(mol)=='compact-inorganic' else 16.272
    opt.scalingFactor=bond*scale/mean;opt.bondLineWidth=.6*scale;opt.fixedFontSize=10*scale
    opt.fixedBondLength=bond*scale/mean
    opt.padding=.08 if complexity(mol)=='compact-inorganic' else .06 if complexity(mol)=='large-branched' else .10;opt.additionalAtomLabelPadding=.12;opt.updateAtomPalette(PALETTE);opt.clearBackground=False
    nitrate=next((a for a in mol.GetAtoms() if a.GetAtomicNum()==7 and a.GetFormalCharge()==1 and a.GetDegree()==3 and all(n.GetAtomicNum()==8 for n in a.GetNeighbors())),None)
    if nitrate is not None:opt.atomLabels[nitrate.GetIdx()]='N'
    drawer.DrawMolecule(mol)
    if nitrate is not None:
        # Preserve the graph's N+ but place the annotation above the horizontal N=O bond.
        xy=drawer.GetDrawCoords(nitrate.GetIdx());drawer.SetColour(PALETTE[7]);drawer.SetFontSize(7*scale)
        drawer.DrawString('+',Point2D(xy.x+5*scale,xy.y-9*scale),rawCoords=True)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()

def generate(all_products=False):
    REVIEW.mkdir(parents=True,exist_ok=True)
    rows=json.loads(SOURCE.read_text())['products'];catalog=json.loads((ROOT/'catalog/products.source.json').read_text())
    canonical={p['slug']:p for p in catalog['products']};records=[]
    for r in rows:
        if not all_products and r['slug'] not in PROTO:continue
        p=canonical[r['slug']];cas=next(x['value'] for x in p['additionalProperty'] if x['name']=='CAS Number')
        assert cas==r['cas'],(r['slug'],cas,r['cas'])
        mol,charges=prepare(r);raw=draw(mol)
        node=ET.fromstring(raw);w=float(node.attrib['width'].replace('px',''));h=float(node.attrib['height'].replace('px',''))
        # Native geometry-aware bounds retain atom-label padding without a uniform blank artboard.
        kind=complexity(mol)
        area=[round(w,5),round(h,5)]
        inner=raw[raw.index('>',raw.index('<svg'))+1:raw.rindex('</svg>')]
        inner=inner.replace('font-family:sans-serif','font-family:Arial,Helvetica,sans-serif')
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}" height="{h:g}" viewBox="0 0 {w:g} {h:g}" role="img" aria-label="{r["slug"]} molecular structure"><title>{r["slug"]} — verified molecular structure</title>{inner}</svg>\n'
        dest=PUBLIC if all_products else REVIEW/'prototype';dest.mkdir(parents=True,exist_ok=True);out=dest/(r['slug']+'.svg');out.write_text(svg)
        (REVIEW/(r['slug']+'.png')).write_bytes(draw(mol,6,True))
        records.append({'slug':r['slug'],'cas':cas,'formula':r['formula'],'inchiKey':r['inchiKey'],
          'canonicalSmiles':Chem.MolToSmiles(mol,isomericSmiles=True),'fragmentCharges':charges,
          'rings':sorted(map(len,mol.GetRingInfo().AtomRings())),'stereocenters':Chem.FindMolChiralCenters(mol,includeUnassigned=True),
          'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          'sourceURLs':r.get('sourceURLs',{}),'asset':out.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
          'layoutNote':'Nitrate N=O remains horizontal; graph N+ annotation placed explicitly above bond to prevent label clipping' if r['slug']=='lithium-nitrate-lino3' else 'Deterministic RDKit coordinates or existing approved coordinate definition',
          'complexityClass':kind,'artboardArea':area,'visualRefinement':'Geometry-aware bounds; compact inorganic bonds 15% longer than de76a44; validated graph unchanged',
          'preset':{'referenceBondLength':18.7128 if kind=='compact-inorganic' else 16.272,'referenceLineWidth':.6,'referenceAtomLabelSize':10,'drawingPadding':.08 if kind=='compact-inorganic' else .06 if kind=='large-branched' else .10,'font':'Arial/Helvetica sans-serif','palette':'Winigen override, not an official ACS color requirement'},
          'rdkit':rdBase.rdkitVersion,'validation':'Sanitized graph, CAS, formula, InChIKey, ionic fragments; retained approved coordinate overrides where available'})
    target=ROOT/'design/option-a/scientific-artwork/chemistry/structures-2f.lock.json' if all_products else REVIEW/'prototype-validation.json'
    target.write_text(json.dumps(records,indent=2)+'\n');print(len(records),'validated', 'public derivatives' if all_products else 'prototypes')

if __name__=='__main__':
    parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--prototype',action='store_true');group.add_argument('--all',action='store_true');args=parser.parse_args();generate(args.all)
