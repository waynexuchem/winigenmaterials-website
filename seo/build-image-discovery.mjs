import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildSitemapEntries,
  isCanonicalIndexablePage,
  loadImageSitemapExclusions,
  mergeLargeImagePreview,
  renderSitemap,
  SITE_ORIGIN
} from './image-discovery.mjs';

async function listHtml(siteRoot, directory = siteRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory() && directory === siteRoot && ['knowledge', 'products'].includes(entry.name)) {
      files.push(...await listHtml(siteRoot, fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.html') {
      files.push(relative(siteRoot, fullPath));
    }
  }
  return files.sort();
}

export async function buildImageDiscovery({ siteRoot, scope = 'all' }) {
  const htmlFiles = await listHtml(siteRoot);
  const robotsTargets = scope === 'all'
    ? htmlFiles
    : htmlFiles.filter(pagePath => pagePath === 'products.html' || pagePath.startsWith('products/'));
  let largePreviewPages = 0;
  let largePreviewPagesChanged = 0;
  for (const pagePath of robotsTargets) {
    const fullPath = resolve(siteRoot, pagePath);
    const original = await readFile(fullPath, 'utf8');
    if (!isCanonicalIndexablePage(pagePath, original)) continue;
    const html = mergeLargeImagePreview(original);
    largePreviewPages += 1;
    if (html !== original) {
      await writeFile(fullPath, html);
      largePreviewPagesChanged += 1;
    }
  }

  const pages = new Map();
  for (const pagePath of htmlFiles) pages.set(pagePath, await readFile(resolve(siteRoot, pagePath), 'utf8'));
  const excludedPaths = await loadImageSitemapExclusions(siteRoot);
  const sitemapEntries = await buildSitemapEntries({ siteRoot, pages, excludedPaths });
  await writeFile(resolve(siteRoot, 'sitemap.xml'), renderSitemap(sitemapEntries));

  const robotsPath = resolve(siteRoot, 'robots.txt');
  const originalRobots = await readFile(robotsPath, 'utf8');
  const canonicalDeclaration = `Sitemap: ${SITE_ORIGIN}/sitemap.xml`;
  const declarations = [...originalRobots.matchAll(/^Sitemap:\s*\S+\s*$/gim)];
  let robots = originalRobots;
  if (declarations.length !== 1 || declarations[0][0].trim() !== canonicalDeclaration) {
    robots = `${originalRobots.replace(/^Sitemap:\s*\S+\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trimEnd()}\n\n${canonicalDeclaration}\n`;
  }
  if (robots !== originalRobots) await writeFile(robotsPath, robots);

  return {
    sitemapUrls: sitemapEntries.length,
    pagesWithImages: sitemapEntries.filter(entry => entry.images.length).length,
    imageAssociations: sitemapEntries.reduce((total, entry) => total + entry.images.length, 0),
    largePreviewPages,
    largePreviewPagesChanged
  };
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const siteRoot = resolve(scriptDirectory, '..');
  buildImageDiscovery({ siteRoot, scope: process.env.SEO_SCOPE || 'all' })
    .then(result => console.log(`Image discovery build: ${JSON.stringify(result)}`))
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
