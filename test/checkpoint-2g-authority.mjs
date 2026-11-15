import {expectedCompletionBytes} from './final-content-authority.mjs';
import {refinePublicCopy} from '../design/option-a/public-copy.mjs';
import {fingerprintHtmlAssets} from '../scripts/asset-fingerprint.mjs';
import {fileURLToPath} from 'node:url';
import {expectedPolicyBytes} from './performance-policy-authority.mjs';
import {expectedVisualBytes} from './visual-refinement-authority.mjs';
import {refineVisualPage} from '../design/option-a/visual-refinement.mjs';
import {refinePage} from '../design/option-a/refine-2f.mjs';
// Explicit 2G exceptions to historical checkpoint snapshots. Science and payment bytes remain guarded.
import {refineSeoPage} from '../design/option-a/build-2g.mjs';
export function projectedSeoPage(path,html){return refinePublicCopy(path,refineSeoPage(path,expectedCompletionBytes(path,Buffer.from(html)).toString()));}
export {projectedSeoPage as refineSeoPage};
export function expected2gSnapshot(path,bytes){
 bytes=expectedCompletionBytes(path,bytes);
 if(path.endsWith('.html'))return Buffer.from(path.startsWith('private-orders/')?bytes.toString():projectedSeoPage(path,refineVisualPage(path,bytes.toString())));
 if(path==='cloudflare-site/worker.js')return Buffer.from("import { productRedirects } from './product-redirects.js';\n"+bytes.toString().replace('    // Exact contact routes only;',`    // Exact, verified public product moves; retain attribution/query parameters.
    const movedProduct = productRedirects[url.pathname];
    if (movedProduct && (request.method === 'GET' || request.method === 'HEAD')) {
      const destination = new URL(url);
      destination.pathname = movedProduct;
      return applyResponseHeaders(Response.redirect(destination.toString(), 308), url);
    }

    // Exact contact routes only;`));
 return expectedPolicyBytes(path,expectedVisualBytes(path,bytes));
}

export async function finish2g(path,html){return projectedSeoPage(path,await refinePage(path,html));}
