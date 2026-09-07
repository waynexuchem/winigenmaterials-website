import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const excludedRoots = new Set(['.git', 'dist-cloudflare', 'node_modules']);

export async function withIsolatedSiteFixture(siteRoot, callback) {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'winigen-site-generator-test-'));
  const isolatedRoot = join(temporaryParent, 'site');

  try {
    await cp(siteRoot, isolatedRoot, {
      recursive: true,
      filter(source) {
        const path = relative(siteRoot, source);
        const root = path.split(/[\\/]/, 1)[0];
        return path === '' || !excludedRoots.has(root);
      }
    });
    return await callback(isolatedRoot);
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
}
