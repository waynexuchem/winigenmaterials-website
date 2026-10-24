// Wrangler 4.120 can print this notice to stdout even with --format json and CI=true.
// Do not search for arbitrary JSON or discard unrecognized output: readiness fails closed.
export function parseWranglerSecretNames(stdout) {
  const json = stdout.trim().replace(
    /^There is a newer version of Wrangler available \(current: \d+\.\d+\.\d+, latest: \d+\.\d+\.\d+\)\. Try upgrading, as it might support this configuration option\.\r?\n/,
    ''
  );
  let bindings;
  try { bindings = JSON.parse(json); }
  catch { throw new Error('Wrangler returned an unreadable production secret binding list.'); }
  if (!Array.isArray(bindings) || bindings.some(binding => (
    !binding || typeof binding !== 'object' || Array.isArray(binding)
    || typeof binding.name !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(binding.name) || binding.type !== 'secret_text'
  ))) throw new Error('Wrangler production secret binding response is invalid.');
  const names = new Set(bindings.map(binding => binding.name));
  if (names.size !== bindings.length) throw new Error('Wrangler production secret binding response contains duplicates.');
  return names;
}
