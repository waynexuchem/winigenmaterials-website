import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const SITE_ORIGIN = 'https://www.winigenmaterials.com';
export const IMAGE_NAMESPACE = 'http://www.google.com/schemas/sitemap-image/1.1';

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const UI_PATH_PATTERNS = [
  /^\/assets\/icons\//i,
  /\/winigen-logo(?:[.-]|$)/i,
  /\/(?:favicon|apple-touch-icon)(?:[.-]|$)/i,
  /\/(?:badge|placeholder|hero-pattern|og-default)(?:[.-]|$)/i
];

export function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function attributesOf(tag = '') {
  const attributes = {};
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

export function canonicalOf(html = '') {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if ((attributes.rel || '').toLowerCase().split(/\s+/).includes('canonical')) return attributes.href || '';
  }
  return '';
}

export function robotsDirectives(html = '') {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if ((attributes.name || '').toLowerCase() === 'robots') {
      return (attributes.content || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

export function isNoindex(html = '') {
  return robotsDirectives(html).includes('noindex');
}

export function expectedCanonical(pagePath) {
  return pagePath === 'index.html' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${pagePath}`;
}

export function isCanonicalIndexablePage(pagePath, html) {
  return !isNoindex(html) && canonicalOf(html).split('#')[0] === expectedCanonical(pagePath);
}

export function mergeLargeImagePreview(html = '') {
  if (isNoindex(html)) return html;
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)];
  const robotsTag = metaTags.find(match => (attributesOf(match[0]).name || '').toLowerCase() === 'robots');
  if (!robotsTag) {
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    return html.replace(/<\/head>/i, `<meta name="robots" content="index,follow,max-image-preview:large">${eol}</head>`);
  }
  const attributes = attributesOf(robotsTag[0]);
  const directives = (attributes.content || '').split(',').map(value => value.trim()).filter(Boolean);
  const merged = directives.filter(value => !/^max-image-preview:/i.test(value));
  merged.push('max-image-preview:large');
  const replacement = `<meta name="robots" content="${escapeXml(merged.join(','))}">`;
  return `${html.slice(0, robotsTag.index)}${replacement}${html.slice(robotsTag.index + robotsTag[0].length)}`;
}

function imageCandidatesFromJson(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => imageCandidatesFromJson(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const key of ['image', 'primaryImageOfPage']) {
    if (!(key in value)) continue;
    const candidates = Array.isArray(value[key]) ? value[key] : [value[key]];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') output.push(candidate);
      else if (candidate && typeof candidate === 'object') output.push(candidate.contentUrl || candidate.url || '');
    }
  }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('ImageObject')) output.push(value.contentUrl || value.url || '');
  Object.values(value).forEach(child => imageCandidatesFromJson(child, output));
  return output;
}

function normalizeImageUrl(rawValue, pageUrl) {
  if (!rawValue || /^(?:data|blob|javascript):/i.test(rawValue)) return null;
  let url;
  try { url = new URL(decodeHtml(rawValue), pageUrl); }
  catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== new URL(SITE_ORIGIN).hostname) return null;
  const extension = url.pathname.match(/\.[^.\/]+$/)?.[0]?.toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  url.hash = '';
  url.search = '';
  return url.href;
}

export function isUiOrDecorativeImage(imageUrl) {
  let pathname;
  try { pathname = new URL(imageUrl).pathname; }
  catch { return true; }
  return UI_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

export function collectPageImages({ html, pageUrl, excludedPaths = new Set() }) {
  const candidates = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if (attributes.src) candidates.push(attributes.src);
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if (['og:image', 'og:image:secure_url'].includes((attributes.property || '').toLowerCase())) {
      candidates.push(attributes.content || '');
    }
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if ((attributes.rel || '').toLowerCase().split(/\s+/).includes('image_src')) candidates.push(attributes.href || '');
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { candidates.push(...imageCandidatesFromJson(JSON.parse(match[1]))); }
    catch { /* JSON-LD syntax is enforced by the main SEO validator. */ }
  }

  const images = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate, pageUrl);
    if (!normalized || seen.has(normalized) || isUiOrDecorativeImage(normalized)) continue;
    const pathname = decodeURIComponent(new URL(normalized).pathname);
    if (!pathname.startsWith('/assets/images/') || excludedPaths.has(pathname)) continue;
    seen.add(normalized);
    images.push(normalized);
  }
  return images.sort();
}

export async function assertPublicImageFile(siteRoot, imageUrl) {
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:') throw new Error(`Image sitemap URL is not HTTPS: ${imageUrl}`);
  if (url.hostname !== new URL(SITE_ORIGIN).hostname) throw new Error(`Image sitemap URL is outside the approved host: ${imageUrl}`);
  if (!url.pathname.startsWith('/assets/images/')) throw new Error(`Image sitemap URL is outside the approved public image directory: ${imageUrl}`);
  const target = resolve(siteRoot, `.${decodeURIComponent(url.pathname)}`);
  const imageRoot = resolve(siteRoot, 'assets/images');
  if (target !== imageRoot && !target.startsWith(`${imageRoot}/`)) throw new Error(`Image sitemap path escapes the public image directory: ${imageUrl}`);
  await access(target);
  return target;
}

export async function verifyImageSitemapExclusions({ siteRoot, entries, readFileImpl = readFile }) {
  if (!Array.isArray(entries)) throw new Error('seo/image-sitemap-exclusions.json must be an array.');
  const paths = new Set();
  const imageRoot = resolve(siteRoot, 'assets/images');
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Each image sitemap exclusion must be an object.');
    const { path, sha256, reason } = entry;
    if (typeof path !== 'string' || !path.startsWith('/assets/images/')) throw new Error('Each image sitemap exclusion must use a public /assets/images/ path.');
    if (!/^[a-f0-9]{64}$/.test(sha256 || '')) throw new Error(`Image sitemap exclusion ${path} must include a lowercase SHA-256 hash.`);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`Image sitemap exclusion ${path} must include a reason.`);
    if (paths.has(path)) throw new Error(`Duplicate image sitemap exclusion: ${path}`);
    const target = resolve(siteRoot, `.${decodeURIComponent(path)}`);
    if (target === imageRoot || !target.startsWith(`${imageRoot}/`)) throw new Error(`Image sitemap exclusion escapes the public image directory: ${path}`);
    let contents;
    try { contents = await readFileImpl(target); }
    catch { throw new Error(`Image sitemap exclusion file is missing: ${path}`); }
    const actualSha256 = createHash('sha256').update(contents).digest('hex');
    if (actualSha256 !== sha256) {
      throw new Error(`Stale image sitemap integrity exclusion for ${path}: expected SHA-256 ${sha256}, found ${actualSha256}; re-review the replacement image before retaining or removing the exclusion.`);
    }
    paths.add(path);
  }
  return paths;
}

export async function loadImageSitemapExclusions(siteRoot) {
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'seo/image-sitemap-exclusions.json'), 'utf8'));
  return verifyImageSitemapExclusions({ siteRoot, entries });
}

export async function buildSitemapEntries({ siteRoot, pages, excludedPaths }) {
  const entries = [];
  for (const [pagePath, html] of pages) {
    if (!isCanonicalIndexablePage(pagePath, html)) continue;
    const url = expectedCanonical(pagePath);
    const images = collectPageImages({ html, pageUrl: url, excludedPaths });
    for (const imageUrl of images) await assertPublicImageFile(siteRoot, imageUrl);
    entries.push({ pagePath, url, images });
  }
  return entries.sort((a, b) => a.url.localeCompare(b.url));
}

export function renderSitemap(entries) {
  const body = entries.map(({ url, images }) => {
    if (!images.length) return `  <url><loc>${escapeXml(url)}</loc></url>`;
    const imageXml = images.map(image => `    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`).join('\n');
    return `  <url>\n    <loc>${escapeXml(url)}</loc>\n${imageXml}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="${IMAGE_NAMESPACE}">\n${body}\n</urlset>\n`;
}

export function parseAndValidateSitemapXml(xml) {
  if (!xml.includes(`xmlns:image="${IMAGE_NAMESPACE}"`)) throw new Error('Sitemap image namespace is missing or invalid.');
  if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)) throw new Error('Sitemap contains an unescaped ampersand.');
  const stack = [];
  for (const match of xml.matchAll(/<([^>]+)>/g)) {
    const token = match[1].trim();
    if (!token || token.startsWith('?') || token.startsWith('!')) continue;
    if (token.endsWith('/')) continue;
    if (token.startsWith('/')) {
      const name = token.slice(1).trim();
      if (stack.pop() !== name) throw new Error(`Sitemap XML has a mismatched closing tag: ${name}.`);
    } else {
      stack.push(token.split(/\s+/)[0]);
    }
  }
  if (stack.length) throw new Error(`Sitemap XML has unclosed tags: ${stack.join(', ')}.`);

  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1];
    const locs = [...block.matchAll(/<loc>([^<]+)<\/loc>/g)];
    if (locs.length !== 1) throw new Error('Each sitemap URL entry must contain exactly one page loc.');
    const images = [...block.matchAll(/<image:image>\s*<image:loc>([^<]+)<\/image:loc>\s*<\/image:image>/g)].map(value => decodeHtml(value[1]));
    entries.push({ url: decodeHtml(locs[0][1]), images });
  }
  return entries;
}
