import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const excludedRoots = new Set(['.git', '.codex', 'tmp', 'docs', 'dist-cloudflare', 'node_modules', 'outputs']);

export async function withIsolatedSiteFixture(siteRoot, callback) {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'winigen-site-generator-test-'));
  const isolatedRoot = join(temporaryParent, 'site');

  try {
    // Permit repository-local TMPDIR without copying ignored review/source outputs
    // into the fixture itself. All permitted source entries retain identical bytes.
    await mkdir(isolatedRoot);
    for (const entry of await readdir(siteRoot)) {
      if (!excludedRoots.has(entry)) {
        await cp(join(siteRoot, entry), join(isolatedRoot, entry), { recursive: true });
      }
    }
    return await callback(isolatedRoot);
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
}
