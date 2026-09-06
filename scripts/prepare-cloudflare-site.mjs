import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(siteRoot, 'dist-cloudflare');

const publicRootFiles = Object.freeze([
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
  'llms.txt',
  'products.html',
  'quality.html',
  'robots.txt',
  'services.html',
  'site.webmanifest',
  'sitemap.xml'
]);
const publicDirectories = Object.freeze(['assets', 'feeds', 'knowledge', 'products']);
const forbiddenNames = /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.git|\.github|node_modules)(?:\/|$)/i;
const secretPatterns = Object.freeze([
  ['Stripe secret key', /sk_(?:live|test)_[A-Za-z0-9]{8,}/],
  ['Stripe webhook secret', /whsec_[A-Za-z0-9]{8,}/],
  ['Cloudflare API token', /CLOUDFLARE_API_TOKEN\s*[=:]/i],
  ['GitHub token', /(?:GITHUB_TOKEN\s*[=:]|github_pat_[A-Za-z0-9_]+)/i],
  ['Resend API key', /RESEND_API_KEY\s*[=:]/i],
  ['Internal checkout token', /INTERNAL_CHECKOUT_TOKEN\s*[=:]/i],
  ['Private key', /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/]
]);

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Public asset allowlist contains a symbolic link: ${relative(siteRoot, path)}`);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function copyPublicPath(relativePath) {
  const source = resolve(siteRoot, relativePath);
  if (!source.startsWith(`${siteRoot}${sep}`)) throw new Error(`Unsafe public path: ${relativePath}`);
  await stat(source);
  await cp(source, resolve(outputRoot, relativePath), { recursive: true, force: false, errorOnExist: true });
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const path of [...publicRootFiles, ...publicDirectories]) await copyPublicPath(path);

const preparedFiles = await listFiles(outputRoot);
const findings = [];
for (const path of preparedFiles) {
  const relativePath = relative(outputRoot, path).split(sep).join('/');
  if (forbiddenNames.test(relativePath)) findings.push(`${relativePath}: forbidden filename`);
  const content = await readFile(path);
  const text = content.toString('utf8');
  for (const [classification, pattern] of secretPatterns) {
    if (pattern.test(text)) findings.push(`${relativePath}: ${classification}`);
  }
}
if (findings.length) {
  await rm(outputRoot, { recursive: true, force: true });
  throw new Error(`Prepared bundle rejected:\n${findings.join('\n')}`);
}

console.log(`Prepared ${preparedFiles.length} public assets in ${relative(siteRoot, outputRoot)}.`);
