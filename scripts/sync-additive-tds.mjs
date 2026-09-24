import { formatProductChemistry } from './format-product-chemistry.mjs';
import { basename } from 'node:path';

export const isFinalizedAdditive = product => product.qualityDocumentation?.specificationBasis === 'finalized-tds';
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const property = (product, name) => product.additionalProperty.find(item => item.name === name)?.value || '';
export const documentationCopy = 'Technical specifications and representative quality-control data are available in the TDS. Lot-specific Certificate of Analysis and SDS are available upon request.';

// Normalize historical display names without changing public slugs or images.
export function synchronizeAdditiveIdentities(html, products) {
  const historicalNames = {
    'vinylene-carbonate-vc': 'Vinylene carbonate',
    '1-5-2-4-dioxadithiane-2-2-4-4-tetraoxide-mmds': '1,5,2,4-dioxadithiane-2,2,4,4-tetraoxide',
    'tris-trimethylsilyl-phosphate-tmsp': 'Tris-(trimethylsilyl)-phosphate'
  };
  for (const [slug, oldName] of Object.entries(historicalNames)) {
    const product = products.find(p => p.slug === slug && isFinalizedAdditive(p));
    if (!product) continue;
    const name = product.name.replace(/ \([A-Za-z]+\)$/, '');
    html = html.split(oldName).join(name).split(encodeURIComponent(oldName)).join(encodeURIComponent(name));
  }
  return html;
}

// Legacy pages retain their application copy; specifications and identity are canonical.
export function synchronizeAdditiveTds(html, products, path) {
  const product = products.find(item => isFinalizedAdditive(item) && basename(item.url) === basename(path));
  if (!product) return html;
  html = synchronizeAdditiveIdentities(html, [product]);
  const summary = `Specifications: ${product.additionalProperty.filter(item => product.qualityDocumentation.keySpecifications.includes(item.name) && !['CAS Number', 'Formula'].includes(item.name)).map(item => `${item.name}: ${item.value}`).join('; ')}. ${documentationCopy}`;
  html = html.replace(/<details><summary>What specifications are shown for [\s\S]*?<\/summary><p>[\s\S]*?<\/p><\/details>/i,
    `<details><summary>What specifications are shown for ${escape(product.name)}?</summary><p>${escape(summary)}</p></details>`);
  html = html.replace(/(<p class="detail-kicker">Technical Profile<\/p>\s*)<p>[\s\S]*?<\/p>/i,
    `$1<p>${escape(product.name)} (${escape(property(product, 'Formula'))}), CAS ${escape(property(product, 'CAS Number'))}, is an electrolyte additive for battery-electrolyte formulation and research.</p>`);
  html = html.replace(/<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g, (block, attrs, text) => {
    const schema = JSON.parse(text);
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      if (value['@type'] === 'Question' && /^What specifications are shown/.test(value.name || '')) {
        value.name = `What specifications are shown for ${product.name}?`;
        value.acceptedAnswer.text = summary;
      }
      for (const child of Object.values(value)) if (typeof child === 'object') {
        if (Array.isArray(child)) child.forEach(walk); else walk(child);
      }
    };
    walk(schema);
    return `<script${attrs}>${JSON.stringify(schema, null, 2)}</script>`;
  });
  html = html.replace(/href="\.\.\/contact\.html\?inquiry_type=Request%20for%20Quote&amp;product_interest=[^"]*?&amp;(?:quantity_scale|message)=[^"]*"/gi, `href="../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}"`);
  html = html.replace(/<p class="related-note"><strong>Need COA\?<\/strong>[\s\S]*?<\/p>/i, '');
  return formatProductChemistry(html);
}
