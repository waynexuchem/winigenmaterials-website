import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { COPYFILE_EXCL } from 'node:constants';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultSiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputRoot = resolve(defaultSiteRoot, 'dist-cloudflare');
const defaultManifestPath = resolve(defaultSiteRoot, 'cloudflare-site/public-assets.txt');

const publicRootFiles = new Set([
  '404.html',
  'about.html',
  'apple-touch-icon.png',
  'applications.html',
  'b22ad449a57a2df14127071a7e045223.txt',
  'cart.html',
  'checkout-cancel.html',
  'checkout-success.html',
  'contact.html',
  'favicon-16.png',
  'favicon-192.png',
  'favicon-32.png',
  'favicon-48.png',
  'favicon-512.png',
  'favicon.ico',
  'favicon.svg',
  'index.html',
  'knowledge.html',
  'knowledge/articles.registry.json',
  'llms.txt',
  'private-orders/confirmation.html',
  'private-orders/wq20260922-01.html',
  'private-orders/wq20260923-01.html',
  'products.html',
  'quality.html',
  'robots.txt',
  'services.html',
  'site.webmanifest',
  'sitemap.xml'
]);
const forbiddenPath = /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.git|\.github|node_modules|references|drafts|source-data)(?:\/|$)/i;
const forbiddenFilename = /(?:^|\/)(?:\.DS_Store|Thumbs\.db|[^/]+ \d+(?:\.[^/]*)?|[^/]+(?:~|\.bak|\.orig|\.swp|\.tmp))$/i;
const secretPatterns = Object.freeze([
  ['Stripe secret key', /sk_(?:live|test)_[A-Za-z0-9]{8,}/],
  ['Stripe webhook secret', /whsec_[A-Za-z0-9]{8,}/],
  ['Cloudflare API token', /CLOUDFLARE_API_TOKEN\s*[=:]/i],
  ['GitHub token', /(?:GITHUB_TOKEN\s*[=:]|github_pat_[A-Za-z0-9_]+)/i],
  ['Resend API key', /RESEND_API_KEY\s*[=:]/i],
  ['Internal checkout token', /INTERNAL_CHECKOUT_TOKEN\s*[=:]/i],
  ['Private key', /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/]
]);
const referenceSourceExtensions = new Set(['.css', '.html', '.js', '.webmanifest', '.xml']);
const publicAssetExtensions = new Set([
  '.avif', '.css', '.gif', '.ico', '.jpeg', '.jpg', '.js', '.pdf', '.png', '.svg', '.webmanifest', '.webp', '.woff', '.woff2'
]);
const publicHosts = new Set(['winigenmaterials.com', 'www.winigenmaterials.com']);

function hasExtension(path, extensions) {
  return extensions.has(extname(path).toLowerCase());
}

export function validatePublicAssetPath(path) {
  if (!path || path.trim() !== path || path.includes('\\') || path.startsWith('/') || path.split('/').includes('..')) {
    throw new Error(`Unsafe public asset path: ${path}`);
  }
  if (forbiddenPath.test(path) || forbiddenFilename.test(path) || path.split('/').some((segment) => segment.startsWith('.'))) {
    throw new Error(`Forbidden public asset path: ${path}`);
  }
  if (publicRootFiles.has(path)) return path;

  const segments = path.split('/');
  const allowed =
    (segments.length === 2 && segments[0] === 'products' && hasExtension(path, new Set(['.html']))) ||
    (segments.length === 2 && segments[0] === 'knowledge' && hasExtension(path, new Set(['.html']))) ||
    (segments.length === 2 && segments[0] === 'feeds' && hasExtension(path, new Set(['.xml']))) ||
    (segments.length === 3 && segments[0] === 'assets' && segments[1] === 'css' && hasExtension(path, new Set(['.css']))) ||
    (segments.length === 3 && segments[0] === 'assets' && segments[1] === 'js' && hasExtension(path, new Set(['.js']))) ||
    (segments.length === 3 && segments[0] === 'assets' && segments[1] === 'icons' && hasExtension(path, new Set(['.svg']))) ||
    (segments.length >= 3 && segments[0] === 'assets' && segments[1] === 'images' && hasExtension(path, new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']))) ||
    (segments.length === 4 && segments[0] === 'assets' && segments[1] === 'documents' && ['coa', 'tds'].includes(segments[2]) && hasExtension(path, new Set(['.pdf'])));

  if (!allowed) throw new Error(`Unrecognized public asset path: ${path}`);
  return path;
}

export function parsePublicAssetManifest(content) {
  const paths = content.split(/\r?\n/).filter(Boolean);
  if (!paths.length) throw new Error('Public asset manifest is empty.');
  for (const path of paths) validatePublicAssetPath(path);
  if (new Set(paths).size !== paths.length) throw new Error('Public asset manifest contains duplicate paths.');
  const sorted = [...paths].sort();
  if (!paths.every((path, index) => path === sorted[index])) {
    throw new Error('Public asset manifest must be sorted.');
  }
  return paths;
}

function decodeReferencePath(path, sourcePath) {
  try {
    return decodeURIComponent(path);
  } catch {
    throw new Error(`Malformed public asset reference in ${sourcePath}: ${path}`);
  }
}

function assertReferenceDoesNotEscape(reference, sourcePath) {
  const unescaped = reference.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  let rawPath = unescaped;
  if (/^https?:\/\//i.test(unescaped)) {
    rawPath = unescaped.replace(/^https?:\/\/[^/]+/i, '');
  }
  rawPath = rawPath.split(/[?#]/, 1)[0];
  const decoded = decodeReferencePath(rawPath, sourcePath);
  const escapesSiteRoot = !decoded.startsWith('/') && posix.normalize(posix.join(posix.dirname(sourcePath), decoded)).startsWith('../');
  const escapesAbsoluteRoot = decoded.startsWith('/') && decoded.split('/').includes('..');
  if (decoded.includes('\\') || escapesSiteRoot || escapesAbsoluteRoot) {
    throw new Error(`Public asset reference escapes approved roots in ${sourcePath}: ${reference}`);
  }
}

function stripJavaScriptComments(content) {
  let output = '';
  let state = 'code';
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (state === 'line-comment') {
      if (character === '\n' || character === '\r') {
        output += character;
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (character === '*' && nextCharacter === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'code' && character === '/' && nextCharacter === '/') {
      output += '  ';
      index += 1;
      state = 'line-comment';
      continue;
    }
    if (state === 'code' && character === '/' && nextCharacter === '*') {
      output += '  ';
      index += 1;
      state = 'block-comment';
      continue;
    }

    output += character;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (state !== 'code' && character === '\\') {
      escaped = true;
      continue;
    }
    if (state === 'code' && character === "'") state = 'single-quote';
    else if (state === 'single-quote' && character === "'") state = 'code';
    else if (state === 'code' && character === '"') state = 'double-quote';
    else if (state === 'double-quote' && character === '"') state = 'code';
    else if (state === 'code' && character === '`') state = 'template';
    else if (state === 'template' && character === '`') state = 'code';
  }

  return output;
}

function stripNonRuntimeReferenceText(content, sourcePath) {
  const extension = extname(sourcePath).toLowerCase();
  if (extension === '.js') return stripJavaScriptComments(content);
  if (extension === '.css') return content.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (extension === '.xml') return content.replace(/<!--[\s\S]*?-->/g, ' ');
  if (extension !== '.html') return content;

  return content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:pre|code)\b[^>]*>[\s\S]*?<\/(?:pre|code)>/gi, ' ')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_match, open, body, close) => `${open}${stripJavaScriptComments(body)}${close}`)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open, body, close) => `${open}${body.replace(/\/\*[\s\S]*?\*\//g, ' ')}${close}`);
}

function normalizePublicAssetReference(reference, sourcePath) {
  let normalizedReference = reference.trim().replace(/^["']|["']$/g, '').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  if (!normalizedReference || /^(?:#|data:|blob:|mailto:|tel:|javascript:)/i.test(normalizedReference)) return null;
  if (normalizedReference.includes('${')) return null;
  if (!/\.(?:avif|css|gif|ico|jpe?g|js|pdf|png|svg|webmanifest|webp|woff2?)(?:[?#]|$)/i.test(normalizedReference)) return null;
  if (normalizedReference.startsWith('assets/')) normalizedReference = `/${normalizedReference}`;
  assertReferenceDoesNotEscape(normalizedReference, sourcePath);

  let url;
  try {
    url = new URL(normalizedReference, `https://www.winigenmaterials.com/${sourcePath}`);
  } catch {
    return null;
  }
  if (!publicHosts.has(url.hostname.toLowerCase())) return null;
  if (/^\/(?:api|cdn-cgi)(?:\/|$)/i.test(url.pathname)) return null;

  const pathname = decodeReferencePath(url.pathname, sourcePath);
  const assetPath = posix.normalize(pathname).replace(/^\/+/, '');
  if (!publicAssetExtensions.has(extname(assetPath).toLowerCase())) return null;
  validatePublicAssetPath(assetPath);
  return assetPath;
}

export function collectLocalPublicAssetReferences(content, sourcePath) {
  const referenceContent = stripNonRuntimeReferenceText(content, sourcePath);
  const candidates = [];
  const addMatches = regex => {
    for (const match of referenceContent.matchAll(regex)) candidates.push(match[1]);
  };

  addMatches(/\b(?:content|href|poster|src)\s*=\s*["']([^"']+)["']/gi);
  addMatches(/["']?(?:href|image|poster|src|url)["']?\s*:\s*["']([^"']+)["']/gi);
  addMatches(/\bsrcset\s*=\s*["']([^"']+)["']/gi);
  addMatches(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi);
  addMatches(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  addMatches(/(?<![A-Za-z0-9._~-])((?:https?:\\?\/\\?\/(?:www\.)?winigenmaterials\.com|assets\/|(?:\.\.\/|\.\/|\/))(?:[^\s"'`()<>]|&amp;)+?\.(?:avif|css|gif|ico|jpe?g|js|pdf|png|svg|webmanifest|webp|woff2?)(?:[?#][^\s"'`()<>]*)?)/gi);

  const references = new Set();
  for (const candidate of candidates) {
    const values = candidate.includes(',') && !candidate.trim().startsWith('data:')
      ? candidate.split(',').map(part => part.trim().split(/\s+/, 1)[0])
      : [candidate];
    for (const value of values) {
      const assetPath = normalizePublicAssetReference(value, sourcePath);
      if (assetPath) references.add(assetPath);
    }
  }
  return [...references].sort();
}

export async function validatePublicAssetClosure({ siteRoot = defaultSiteRoot, manifest } = {}) {
  const resolvedSiteRoot = resolve(siteRoot);
  const realSiteRoot = await realpath(resolvedSiteRoot);
  const manifestPaths = manifest || parsePublicAssetManifest(
    await readFile(resolve(resolvedSiteRoot, 'cloudflare-site/public-assets.txt'), 'utf8')
  );
  const manifestSet = new Set(manifestPaths);
  const referencedBy = new Map();

  for (const manifestPath of manifestPaths) {
    const source = resolve(resolvedSiteRoot, manifestPath);
    let sourceInfo;
    try {
      sourceInfo = await lstat(source);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`Public manifest path does not exist: ${manifestPath}`);
      throw error;
    }
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw new Error(`Public asset is not a regular file: ${manifestPath}`);
    }
    const realSource = await realpath(source);
    if (!realSource.startsWith(`${realSiteRoot}${sep}`)) {
      throw new Error(`Public asset resolves outside the site root: ${manifestPath}`);
    }
    if (!referenceSourceExtensions.has(extname(manifestPath).toLowerCase())) continue;

    const content = await readFile(source, 'utf8');
    for (const assetPath of collectLocalPublicAssetReferences(content, manifestPath)) {
      if (!referencedBy.has(assetPath)) referencedBy.set(assetPath, new Set());
      referencedBy.get(assetPath).add(manifestPath);
    }
  }

  for (const [assetPath, sources] of referencedBy) {
    const source = resolve(resolvedSiteRoot, assetPath);
    try {
      const sourceInfo = await lstat(source);
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error('not a regular file');
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`Referenced public asset does not exist: ${assetPath} (referenced by ${[...sources].join(', ')})`);
      }
      throw error;
    }
    if (!manifestSet.has(assetPath)) {
      throw new Error(`Referenced public asset is missing from cloudflare-site/public-assets.txt: ${assetPath} (referenced by ${[...sources].join(', ')})`);
    }
  }

  return { referenceCount: referencedBy.size, referencedBy };
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Prepared bundle contains a non-file entry: ${path}`);
  }
  return files;
}

export async function prepareCloudflareSite({
  siteRoot = defaultSiteRoot,
  outputRoot = defaultOutputRoot,
  manifestPath = defaultManifestPath
} = {}) {
  const resolvedSiteRoot = resolve(siteRoot);
  const resolvedOutputRoot = resolve(outputRoot);
  if (!resolvedOutputRoot.startsWith(`${resolvedSiteRoot}${sep}`)) {
    throw new Error(`Output directory must be inside the site root: ${resolvedOutputRoot}`);
  }

  const manifest = parsePublicAssetManifest(await readFile(manifestPath, 'utf8'));
  const realSiteRoot = await realpath(resolvedSiteRoot);
  await validatePublicAssetClosure({ siteRoot: resolvedSiteRoot, manifest });
  await rm(resolvedOutputRoot, { recursive: true, force: true });
  await mkdir(resolvedOutputRoot, { recursive: true });

  try {
    for (const assetPath of manifest) {
      const source = resolve(resolvedSiteRoot, assetPath);
      const sourceInfo = await lstat(source);
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
        throw new Error(`Public asset is not a regular file: ${assetPath}`);
      }
      const realSource = await realpath(source);
      if (!realSource.startsWith(`${realSiteRoot}${sep}`)) {
        throw new Error(`Public asset resolves outside the site root: ${assetPath}`);
      }
      const destination = resolve(resolvedOutputRoot, assetPath);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination, COPYFILE_EXCL);
    }

    const preparedFiles = await listFiles(resolvedOutputRoot);
    const preparedPaths = preparedFiles.map((path) => relative(resolvedOutputRoot, path).split(sep).join('/')).sort();
    if (preparedPaths.length !== manifest.length || preparedPaths.some((path, index) => path !== manifest[index])) {
      throw new Error('Prepared bundle does not exactly match the public asset manifest.');
    }

    const findings = [];
    for (const path of preparedFiles) {
      const relativePath = relative(resolvedOutputRoot, path).split(sep).join('/');
      const content = await readFile(path);
      const text = content.toString('utf8');
      for (const [classification, pattern] of secretPatterns) {
        if (pattern.test(text)) findings.push(`${relativePath}: ${classification}`);
      }
    }
    if (findings.length) throw new Error(`Prepared bundle rejected:\n${findings.join('\n')}`);

    return { assetCount: preparedFiles.length, outputRoot: resolvedOutputRoot };
  } catch (error) {
    await rm(resolvedOutputRoot, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await prepareCloudflareSite();
  console.log(`Prepared ${result.assetCount} public assets in ${relative(defaultSiteRoot, result.outputRoot)}.`);
}
