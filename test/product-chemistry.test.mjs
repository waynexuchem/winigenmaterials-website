import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { formatProductChemistry } from '../scripts/format-product-chemistry.mjs';

test('chemical display handles decimals, variables, groups and leaves specifications/identifiers alone', () => {
  assert.equal(globalThis.WinigenChemicalTypography.html('Li5.5PS4.5ClxBr1.5-x, D50 4.5 ± 1.5 µm'), 'Li<sub>5.5</sub>PS<sub>4.5</sub>Cl<sub>x</sub>Br<sub>1.5-x</sub>, D50 4.5 ± 1.5 µm');
  assert.equal(globalThis.WinigenChemicalTypography.html('LiN(CF3SO2)2 SiOx Ti3C2Tx'), 'LiN(CF<sub>3</sub>SO<sub>2</sub>)<sub>2</sub> SiO<sub>x</sub> Ti<sub>3</sub>C<sub>2</sub>T<sub>x</sub>');
  const identifiers = 'NMC811 NCA622 GSB01 D50 D90 1.0 M 99.9% 2,2-Difluoroethyl WM-LS-LiPF6 21324-40-3 Ti₃C₂Tₓ';
  assert.equal(globalThis.WinigenChemicalTypography.html(identifiers), identifiers);
});

test('markup preserves machine data, scripts, styles, links and existing subscripts', () => {
  const source = '<title>LiPF6</title><meta content="LiPF6"><script type="application/ld+json">{"name":"LiPF6"}</script><style>.LiPF6{}</style><a href="/LiPF6" data-search="LiPF6">LiPF6</a><p>LiPF<sub>6</sub></p>';
  const result = formatProductChemistry(source);
  assert.equal(result, source.replace('>LiPF6</a>', '>LiPF<sub>6</sub></a>'));
  assert.equal(formatProductChemistry(result), result);
});

test('every local product/catalog page has passed the formatter and remains idempotent', async () => {
  const root = new URL('../', import.meta.url);
  const paths = ['products.html', ...(await readdir(new URL('products/', root))).filter(p => p.endsWith('.html')).map(p => `products/${p}`)];
  for (const path of paths) {
    const html = await readFile(new URL(path, root), 'utf8');
    assert.equal(formatProductChemistry(html), html, path);
  }
});
