from pathlib import Path
import json,re,subprocess
from pypdf import PdfReader
import html
R=Path.cwd();manifest=json.loads((R/'assets/documents/tds/sse-tds-manifest.json').read_text())
for g,d in manifest['grades'].items():
 p=R/'products'/f'{g.lower()}.html';content=p.read_text();table=re.search(r'<table class="characterization-table">(.*?)</table>',content,re.S)[1];rows=[[html.unescape(td) for td in re.findall(r'<td>(.*?)</td>',tr)] for tr in re.findall(r'<tr>(.*?)</tr>',table,re.S) if '<td>' in tr];assert rows==d['rows'],g
 pdf=PdfReader(R/d['url'].lstrip('/'));assert len(pdf.pages)==2;assert pdf.metadata.title=='Technical Data Sheet';assert pdf.metadata['/SourceVersion']=='V02';assert pdf.metadata['/SourceReleaseDate']==d['sourceReleaseDate'];assert pdf.metadata['/WinigenIssueDate']=='2026-10-10'
 text=' '.join(p.extract_text() for p in pdf.pages);assert not re.search('[\u3400-\u9fff]',text);assert not re.search('English edition|Chinese chart|English rendering|original precision|rounding|source table precision|retain original|original chart precision',text,re.I)
 for row in rows:
  if row[0]!='Appearance':assert row[2] in re.sub(r'\s+',' ',text),(g,row)
 for target in re.findall(r'(?:href|src|data)="([^"]+)"',content):
  if target.startswith(('http','mailto','#')):continue
  path=target.split('?')[0].split('#')[0]
  if not path:continue
  resolved=R/path.lstrip('/') if path.startswith('/') else p.parent/path
  assert resolved.exists(),(g,target)
 for script in re.findall(r'<script type="application/ld\+json">(.*?)</script>',content,re.S):json.loads(script)
 print(g,'values, PDF metadata, Chinese scan, internal links, structured data PASS')
for f in ['ecommerce/catalog.source.json','ecommerce/supplemental-approved-pricing.source.json']:
 before=json.loads(subprocess.check_output(['git','-C',str(Path(__file__).resolve().parents[3]/'winigen_materials_site_v3'),'show','755809fcdac0c637610e10ab7c9d6a746e407962:'+f],text=True));after=json.loads((R/f).read_text())
 def normalize(x):
  if isinstance(x,dict):return {k:normalize(v) for k,v in x.items() if k!='name'}
  if isinstance(x,list):return [normalize(v) for v in x]
  return x
 assert normalize(before)==normalize(after),f
 print(f,'purchasing fields unchanged PASS')
