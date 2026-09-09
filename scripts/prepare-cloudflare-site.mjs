import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { COPYFILE_EXCL } from 'node:constants';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
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
