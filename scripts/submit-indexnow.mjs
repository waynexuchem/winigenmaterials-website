import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalOf, expectedCanonical, isCanonicalIndexablePage, SITE_ORIGIN } from '../seo/image-discovery.mjs';

export const INDEXNOW_KEY = 'b22ad449a57a2df14127071a7e045223';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultSiteRoot = resolve(scriptDirectory, '..');

export function validateIndexNowUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`IndexNow URL is invalid: ${value}`); }
  if (url.origin !== SITE_ORIGIN || url.username || url.password) {
    throw new Error(`IndexNow refuses off-domain or non-HTTPS URL: ${value}`);
  }
  url.hash = '';
  if (url.search) throw new Error(`IndexNow accepts canonical page URLs without query strings: ${value}`);
  if (url.pathname !== '/' && !url.pathname.endsWith('.html')) throw new Error(`IndexNow accepts Winigen canonical page URLs only: ${value}`);
  return url.href;
}

function pagePathOf(url) {
  return new URL(url).pathname === '/' ? 'index.html' : decodeURIComponent(new URL(url).pathname.slice(1));
}

function pageFileOf(siteRoot, url) {
  const pageFile = resolve(siteRoot, pagePathOf(url));
  if (pageFile !== siteRoot && !pageFile.startsWith(`${siteRoot}/`)) {
    throw new Error(`IndexNow URL escapes the public site root: ${url}`);
  }
  return pageFile;
}

export async function filterIndexNowUrls({ siteRoot = defaultSiteRoot, urls = [], deletedUrls = [] }) {
  const accepted = new Set();
  const ignored = [];
  for (const raw of urls) {
    const url = validateIndexNowUrl(raw);
    const pagePath = pagePathOf(url);
    const pageFile = pageFileOf(siteRoot, url);
    let html;
    try { html = await readFile(pageFile, 'utf8'); }
    catch {
      ignored.push({ url, reason: 'missing page; pass it explicitly with --deleted if removal notification is intended' });
      continue;
    }
    if (url !== expectedCanonical(pagePath) || !isCanonicalIndexablePage(pagePath, html) || canonicalOf(html).split('#')[0] !== expectedCanonical(pagePath)) {
      ignored.push({ url, reason: 'noindex, redirect, alias, or noncanonical page' });
      continue;
    }
    accepted.add(url);
  }
  for (const raw of deletedUrls) accepted.add(validateIndexNowUrl(raw));
  return { accepted: [...accepted].sort(), ignored };
}

export async function submitIndexNow({ urls, fetchImpl = fetch }) {
  if (!urls.length) return { submitted: 0, status: null };
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE_ORIGIN).hostname,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls
    })
  });
  const statusMessages = new Map([
    [200, 'URLs submitted successfully.'],
    [202, 'URLs received; IndexNow key validation is pending.'],
    [400, 'Invalid IndexNow request format.'],
    [403, 'IndexNow key is invalid or its verification file is unavailable.'],
    [422, 'Submitted URLs do not match the declared host or key schema.'],
    [429, 'IndexNow rate limit exceeded; retry the release-scoped submission later.']
  ]);
  const message = statusMessages.get(response.status) || `Unexpected IndexNow response.`;
  if (!response.ok) throw new Error(`IndexNow returned HTTP ${response.status}: ${message}`);
  return { submitted: urls.length, status: response.status, message };
}

export function parseArguments(argv) {
  const options = { urls: [], deletedUrls: [], files: [], dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--url') options.urls.push(argv[++index] || '');
    else if (argument === '--deleted') options.deletedUrls.push(argv[++index] || '');
    else if (argument === '--file') options.files.push(argv[++index] || '');
    else throw new Error(`Unknown IndexNow argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  for (const file of options.files) {
    const lines = (await readFile(resolve(process.cwd(), file), 'utf8')).split(/\r?\n/).map(value => value.trim()).filter(value => value && !value.startsWith('#'));
    options.urls.push(...lines);
  }
  if (!options.urls.length && !options.deletedUrls.length) {
    throw new Error('Provide release-scoped canonical URLs with --url/--file, or removed canonical URLs with --deleted.');
  }
  const keyContents = (await readFile(resolve(defaultSiteRoot, `${INDEXNOW_KEY}.txt`), 'utf8')).trim();
  if (keyContents !== INDEXNOW_KEY) throw new Error('The public IndexNow key-verification file is missing or inconsistent.');
  const result = await filterIndexNowUrls({ urls: options.urls, deletedUrls: options.deletedUrls });
  for (const item of result.ignored) console.log(`Ignored ${item.url}: ${item.reason}.`);
  if (!result.accepted.length) {
    console.log('No eligible release URLs to submit to IndexNow.');
    return;
  }
  if (options.dryRun) {
    console.log(`IndexNow dry run: ${result.accepted.length} eligible URL(s).`);
    result.accepted.forEach(url => console.log(url));
    return;
  }
  const submission = await submitIndexNow({ urls: result.accepted });
  console.log(`IndexNow accepted ${submission.submitted} URL(s) with HTTP ${submission.status}: ${submission.message}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error(`IndexNow submission failed safely: ${error.message}`);
    process.exitCode = 1;
  });
}
