import {publicCopy} from './public-copy.mjs';
import {scientificFigures} from './product-experience.mjs';
import {refinePage} from './refine-2f.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {header,footer,activeForPath} from './components.mjs';
import {blockAt,replaceRange} from './html-blocks.mjs';
import {fingerprintHtmlAssets} from '../../scripts/asset-fingerprint.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function publicShell(path,source){
 if(path.startsWith('private-orders/')||source.includes('data-expected-payment-total='))return source;
 let html=scientificFigures(source);
 if(!/<main\b/i.test(html)){
  if(!/legacy-redirect\.js/.test(html)||!/<meta name="robots" content="noindex/.test(html))throw Error('Unexpected public page without main: '+path);
  html=html.replace(/(<body\b[^>]*>)([\s\S]*?)(<\/body>)/i,'$1<main id="main" class="oa-legacy oa-redirect">$2</main>$3');
 }
 const body=html.match(/<body\b[^>]*>/i);if(!body)throw Error('Public page has no body: '+path);
 const wasOptionA=/class="[^"]*\boption-a\b/.test(body[0]);
 html=html.replace(body[0],body[0].includes('class=')?body[0].replace(/class="([^"]*)"/,(_m,c)=>`class="${[...new Set(['option-a',...c.split(/\s+/)])].join(' ')}"`):body[0].replace('>',' class="option-a">'));
 const mainAt=html.indexOf('<main');const firstHeader=html.indexOf('<header',html.indexOf('<body'));
 html=html.replace(/<a class="oa-skip"[^>]*>[\s\S]*?<\/a>/g,'');
 const h=html.indexOf('<header',html.indexOf('<body'));
 if(h>=0&&(mainAt<0||h< html.indexOf('<main')))html=replaceRange(html,blockAt(html,h,'header'),header(activeForPath(path)));
 else html=html.replace(/(<body\b[^>]*>)/i,'$1'+header(activeForPath(path)));
 if(path==='contact.html'&&!html.includes('data-oa-mailing'))html=html.replace('</main>','<section class="oa-container oa-mailing-panel" data-oa-mailing><h2>Mailing Address</h2><address>24 Park Ave<br>PO Box 116<br>Park Ridge, NJ 07656<br>USA</address><p>Mail correspondence only; not a customer-visiting location. <a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></p></section></main>');
 const f=html.indexOf('<footer');if(f>=0)html=replaceRange(html,blockAt(html,f,'footer'),footer(path));else html=html.replace('</body>',footer(path)+'</body>');
 html=html.replace(/<main\b([^>]*)>/i,(_m,attrs)=>{if(!/\bid=/.test(attrs))attrs+=' id="main"';if(!wasOptionA){if(attrs.includes('class='))attrs=attrs.replace(/class="([^"]*)"/,'class="$1 oa-legacy"');else attrs+=' class="oa-legacy"';}return '<main'+attrs+'>';});
 if(!html.includes('<main'))throw Error('Public page has no main content: '+path);
 // Canonical presentation assets are last in the cascade; functional legacy assets stay intact.
 html=html.replace(/<link\b[^>]*href="[^"]*assets\/css\/(?:option-a|option-a-site|option-a-2e)\.css[^>]*>\s*/g,'');
 html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/option-a.css"><link rel="stylesheet" href="/assets/css/option-a-site.css"><link rel="stylesheet" href="/assets/css/option-a-2e.css">\n</head>');
 const shared=['product-search-index','product-search','option-a-search','featured-session','option-a'];
 html=html.replace(/\s*<script\b[^>]*src="[^"]*assets\/js\/(?:product-search-index|product-search|option-a-search|featured-session|option-a)\.js[^>]*>[\s\S]*?<\/script>\s*/g,'');
 html=html.replace('</body>',shared.map(n=>`<script src="/assets/js/${n}.js" defer></script>`).join('\n')+'</body>');
 return refinePage(path,fingerprintHtmlAssets(html,root,path));
}
export async function buildPublicShell({check=false}={}){const paths=(await readFile(resolve(root,'cloudflare-site/public-assets.txt'),'utf8')).trim().split('\n').filter(p=>p.endsWith('.html'));const changes=[];for(const p of paths){const before=await readFile(resolve(root,p),'utf8'),after=await publicShell(p,before);if(before!==after){changes.push(p);if(!check)await writeFile(resolve(root,p),after);}}if(check&&changes.length)throw Error('Stale shared public shell: '+changes.join(', '));return changes;}
