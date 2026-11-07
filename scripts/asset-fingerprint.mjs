import { createHash } from 'node:crypto';

// Match the site's existing content-addressed, twelve-hex asset-token convention.
export function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}
