import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const identityFamilies = new Set(['lithium-salts', 'battery-solvents', 'electrolyte-additives', 'next-generation-salts']);
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const property = (product, name) => product.additionalProperty?.find(item => item.name === name)?.value || '';
const notation = value => escapeHtml(value).replace(/(\d+)/g, '<sub>$1</sub>');
export function identityAliases(product) {
  // The migrated families use explicit approved fields only. Legacy `aliases` is a
  // compatibility projection, never an input: old seed fragments must not return.
  if (!identityFamilies.has(product.family) && !product.primaryAbbreviation) return product.approvedSynonyms || product.aliases || [];
  return [...new Set([product.primaryAbbreviation, ...(product.alternateAbbreviations || []), ...(product.approvedSynonyms || [])].filter(Boolean))];
}

export function cardIdentity(product) {
  // Never infer acronyms from names, URLs or product codes.
  const primary = product.primaryAbbreviation || property(product, 'Abbreviation') || property(product, 'Formula');
  const shorthand = (product.displayAbbreviations || [primary]).filter(Boolean).join(' / ');
  const suffix = ` (${property(product, 'Abbreviation')})`;
  const name = product.chemicalName || (primary && product.name.endsWith(suffix) ? product.name.slice(0, -suffix.length) : product.name);
  return { shorthand, name, cas: property(product, 'CAS Number') };
}

export function displayIdentity(product) {
  if (!identityFamilies.has(product.family)) return product.name;
  const { name, shorthand } = cardIdentity(product);
  return shorthand ? `${name} (${shorthand})` : name;
}

export function accessibilityIdentity(product) {
  const { shorthand, name, cas } = cardIdentity(product);
  const displayed = product.displayAbbreviations || [product.primaryAbbreviation || property(product, 'Abbreviation') || property(product, 'Formula')];
  const seen = new Set([...displayed, shorthand, name, `CAS ${cas}`].map(value => value.toLowerCase()));
  const alternates = identityAliases(product).filter(alias => {
    const key = alias.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...new Set([shorthand, name, `CAS ${cas}`, ...alternates].filter(Boolean))].join('; ');
}

export function synchronizeRfqIdentity(html, product) {
  // Replace only the human-readable query value. Preserve route, parameter order,
  // inquiry type, quantity/message parameters and fragments byte-for-byte.
  return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi, (match, before, href, after) => {
    if (!/^(?:\.\.\/|\/)?contact\.html\?/.test(href)) return match;
    const updated = href.replace(/([?&](?:amp;)?product_interest=)[^&#]*/,
      (_, prefix) => prefix + encodeURIComponent(displayIdentity(product)));
    return before + updated + after;
  });
}

function synchronizeImageIdentity(html, product) {
  const identity = escapeHtml(displayIdentity(product));
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src || '/' + src.replace(/^(?:\.\.\/|\/)+/, '') !== product.image) return tag;
    const alt = `${identity}${product.image.includes('/chemical-structures/') ? ' chemical structure' : ' product image'}`;
    return /\balt="[^"]*"/.test(tag) ? tag.replace(/\balt="[^"]*"/, `alt="${alt}"`) : tag.replace(/\s*\/?>$/, ` alt="${alt}">`);
  });
}

export function synchronizeCatalogCardIdentities(html, products) {
  const bySlug = new Map(products.filter(product => identityFamilies.has(product.family)).map(product => [product.slug, product]));
  return html.replace(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi, article => {
    const href = article.match(/class="product-detail-link"[^>]*href="([^"]+)"/i)?.[1];
    const product = bySlug.get(href?.split('/').pop().replace(/\.html(?:[?#].*)?$/, ''));
    if (!product) return article;
    const { shorthand, name, cas } = cardIdentity(product);
    article = synchronizeRfqIdentity(synchronizeImageIdentity(article, product), product);
    article = article.replace(/<a\b[^>]*class="product-media-link"[^>]*>/gi, tag => {
      const label = `View details for ${escapeHtml(displayIdentity(product))}`;
      return /aria-label="[^"]*"/.test(tag) ? tag.replace(/aria-label="[^"]*"/, `aria-label="${label}"`) : tag.replace(/>$/, ` aria-label="${label}">`);
    });
    const title = `<div class="product-card__identity" data-display-identity="${escapeHtml(displayIdentity(product))}"><h3 class="product-card__identity-title"><a class="product-detail-link" href="${href}" aria-label="${escapeHtml(accessibilityIdentity(product))}">${shorthand ? `<span class="product-card__identifier">${notation(shorthand)}</span> <span class="product-card__chemical-name">${escapeHtml(name)}</span>` : escapeHtml(name)}</a></h3>${cas ? `<p class="product-card__cas"><span>CAS:</span> ${escapeHtml(cas)}</p>` : ''}</div>`;
    article = article.replace(/<div class="product-card__identity"[^>]*>[\s\S]*?<\/div>|<h3\b[^>]*>[\s\S]*?<\/h3>(?:\s*<p class="product-card__cas">[\s\S]*?<\/p>)?/, title);
    article = article.replace(/(<span class="product-card__category"[^>]*>)[\s\S]*?(<\/span>)/, `$1${escapeHtml(product.cardCategory || product.category)}$2`);
    const search = escapeHtml([product.category, displayIdentity(product), name, ...identityAliases(product), cas, property(product, 'Formula')].join(' ').toLowerCase());
    article = article.replace(/\bdata-search="[^"]*"/, `data-search="${search}"`);
    return article.replace(/<li><strong>(?:Alternate Abbreviation|Abbreviation):<\/strong>\s*[\s\S]*?<\/li>/gi, '');
  });
}

export function synchronizeProductPresentation(html, products, pagePath = '') {
  html = synchronizeCatalogCardIdentities(html, products);
  const selected = products.filter(p => identityFamilies.has(p.family));
  html = html.split(/(<(?:script|style|title|code|pre)\b[^>]*>[\s\S]*?<\/(?:script|style|title|code|pre)\s*>|<!--[\s\S]*?-->|<[^>]*>)/gi).map(part => {
    if (part.startsWith('<')) return part;
    for (const p of selected) for (const oldName of p.legacyChemicalNames || []) part = part.split(oldName).join(escapeHtml(p.chemicalName));
    return part;
  }).join('');
  const product = selected.find(p => ('/' + pagePath.replaceAll('\\', '/')).endsWith(p.url));
  if (product) {
    html = synchronizeRfqIdentity(synchronizeImageIdentity(html, product), product);
    const {shorthand, name, cas} = cardIdentity(product);
    const heading = `<span class="product-identity__identifier">${notation(shorthand || name)}</span>${shorthand ? ` <span class="product-identity__name">${escapeHtml(name)}</span>` : ''}`;
    html = html.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>(?:\s*<p class="product-identity__cas">[\s\S]*?<\/p>)?/, (_, attributes) => {
      attributes = attributes.replace(/\sdata-product-identity="true"/, '');
      return `<h1${attributes} data-product-identity="true">${heading}</h1><p class="product-identity__cas">CAS: ${escapeHtml(cas)}</p>`;
    });
    const identityData = `<script type="application/json" id="product-identity-data">${JSON.stringify({shorthand, name, cas, displayIdentity: displayIdentity(product), aliases: identityAliases(product)}).replace(/</g, '\\u003c')}</script>`;
    html = /<script type="application\/json" id="product-identity-data">[\s\S]*?<\/script>/.test(html)
      ? html.replace(/<script type="application\/json" id="product-identity-data">[\s\S]*?<\/script>/, identityData)
      : html.replace('</head>', `${identityData}\n</head>`);
    html = html.replace(/(<dt>Abbreviation<\/dt>\s*<dd>)[\s\S]*?(<\/dd>)/gi, `$1${notation(shorthand)}$2`);
    const keywords = escapeHtml([displayIdentity(product), ...identityAliases(product), cas, property(product, 'Formula')].join(', '));
    const meta = `<meta name="keywords" content="${keywords}">`;
    html = /<meta\s+name="keywords"[^>]*>/i.test(html) ? html.replace(/<meta\s+name="keywords"[^>]*>/i, meta) : html.replace('</head>', `${meta}\n</head>`);
    html = html.replace(/<div\b[^>]*>\s*<dt>Alternate Abbreviation<\/dt>\s*<dd>[\s\S]*?<\/dd>\s*<\/div>/gi, '');
    html = html.replace(/<tr\b[^>]*>\s*<(?:td|th)>Alternate Abbreviation<\/(?:td|th)>[\s\S]*?<\/tr>/gi, '');
  }
  // Preserve offers, identifiers and SEO copy; update only canonical identity fields in schema.
  html = html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi, (original, open, json, close) => {
    let data; try { data = JSON.parse(json); } catch { return original; }
    let changed = false;
    const set = (node, key, value) => { if (JSON.stringify(node[key]) !== JSON.stringify(value)) { node[key] = value; changed = true; } };
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (node['@type'] === 'ItemList') {
        for (const entry of node.itemListElement || []) {
          const url = entry.url || (typeof entry.item === 'string' ? entry.item : entry.item?.url || entry.item?.['@id']);
          const p = selected.find(p => typeof url === 'string' && url.split('#')[0].endsWith(p.url));
          if (p) set(entry, 'name', displayIdentity(p));
        }
      }
      if (['Product','ProductGroup'].includes(node['@type'])) {
        const p = selected.find(p => node.url?.endsWith(p.url) || node.sku === p.sku) || (product && !node.url ? product : null);
        if (p) {
          set(node, 'alternateName', identityAliases(p));
          set(node, 'name', displayIdentity(p));
          if (node.molecularFormula) set(node, 'molecularFormula', property(p, 'Formula'));
          if (Array.isArray(node.additionalProperty)) {
            const props = node.additionalProperty.filter(x => x.name !== 'Alternate Abbreviation').map(x => ['Abbreviation','Formula','CAS Number'].includes(x.name) ? {...x, value: property(p, x.name)} : x);
            set(node, 'additionalProperty', props);
          }
        }
      }
      Object.values(node).forEach(value => { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); });
    };
    visit(data);
    return changed ? `${open}\n${JSON.stringify(data, null, 2)}\n${close}` : original;
  });
  // The family FAQ follows the same canonical water limit as the LiPF6 product.
  if (pagePath.endsWith('products/lithium-salts.html')) {
    const lipf6 = selected.find(p => p.familyFaqWaterProperty);
    if (lipf6) {
      const limit = property(lipf6, lipf6.familyFaqWaterProperty);
      html = html.replace(/The LiPF(?:6|<sub>6<\/sub>) product page lists (?:&lt;=|<=|≤)\s*\d+\s*ppm water as a target specification\./g,
        match => `The ${match.includes('<sub>') ? 'LiPF<sub>6</sub>' : 'LiPF6'} product page lists ${limit} water as a target specification.`);
    }
  }
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const { products } = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
  const paths = ['products.html', ...[...identityFamilies].map(family => `products/${family}.html`), ...products.filter(p => identityFamilies.has(p.family)).map(p => p.url.slice(1))];
  for (const path of paths) {
    const file = resolve(root, path);
    const before = await readFile(file, 'utf8');
    const after = synchronizeProductPresentation(before, products, file);
    if (after !== before) await writeFile(file, after);
  }
  console.log(`Synchronized canonical identities across ${paths.length} catalog/detail pages.`);
}
