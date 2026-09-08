// Master catalog ordering shared by the narrow updater and MXene page generation.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
const searchContext = {};
runInNewContext(await readFile(new URL('../assets/js/product-search.js', import.meta.url), 'utf8'), searchContext);
export const sectionOrder = Array.from(searchContext.WinigenProductSearch.SECTION_ORDER);
export function reconcileMxeneCatalogOrder(html) {
  return html.replace(/(<nav class="catalog-filter-bar"[^>]*><div class="tabs">)([\s\S]*?)(<\/div><\/nav>)/, (_, start, tabs, end) => {
    const links = new Map([...tabs.matchAll(/<a\b[^>]*href="#([^"]+)"[^>]*>[\s\S]*?<\/a>/g)].map(m => [m[1], m[0]]));
    for (const id of sectionOrder) if (!links.has(id)) throw new Error(`Missing catalog tab: ${id}`);
    return start + sectionOrder.map(id => links.get(id).replace(/class="[^"]*"/, `class="tab${id === 'formulations' ? ' tab--rfq-start' : ''}"`)).join('') + end;
  }).replace(/const sectionOrder = \[[^\]]*\];/, `const sectionOrder = [${sectionOrder.map(id => `'${id}'`).join(', ')}];`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = fileURLToPath(new URL('../products.html', import.meta.url));
  await writeFile(path, reconcileMxeneCatalogOrder(await readFile(path, 'utf8')));
}
