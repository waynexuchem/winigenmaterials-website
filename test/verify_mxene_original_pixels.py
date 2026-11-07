"""Explicit read-only scientific audit; private fixtures are never part of ordinary tests.

Requires authorized existing extracted source JPEGs and native crops, not copied into Git.
No files are created, modified or reconstructed. Run --help for required locations.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify(source_root, supplier_pdf):
    source_root = Path(source_root).resolve(strict=True)
    supplier_pdf = Path(supplier_pdf).resolve(strict=True)
    config = json.loads((ROOT / 'catalog/mxene-accordion-images.source.json').read_text())
    require(digest(supplier_pdf) == config['sourcePDFSHA256'], 'Unauthorized/mismatched supplier PDF bytes')
    public = set((ROOT / 'cloudflare-site/public-assets.txt').read_text().splitlines())
    results = []
    for record in config['records']:
        paths = {}
        for key in ('source', 'nativeClean'):
            relative = record[key]
            require(relative.startswith('docs/mxene-accordion-phase1/'), 'Unexpected private source root')
            require(relative not in public, 'Private source entered the public manifest')
            path = (source_root / relative).resolve(strict=True)
            require(path.is_relative_to(source_root), 'Private source escapes the authorized directory')
            require(digest(path) == record[key + 'SHA256'], f'{key} hash mismatch: object {record["object"]}')
            paths[key] = path
        with Image.open(paths['source']) as original:
            require(list(original.size) == record['nativeDimensions'], 'Original dimensions mismatch')
            expected = original.convert('RGBA').crop(record['crop'])
        if record['object'] == 73:
            # Previously approved non-data toolbar treatment, never applied to diffraction data.
            expected.paste((32, 32, 32, 255), (985, 496, 1226, 515))
        with Image.open(paths['nativeClean']) as native:
            actual = native.convert('RGBA')
            require(actual.size == expected.size and actual.tobytes() == expected.tobytes(),
                    f'Scientific pixel comparison failed: object {record["object"]}')
        results.append({'object': record['object'], 'sourceHashVerified': True,
                        'nativeHashVerified': True, 'approvedPixelOperationMatches': True})
    return {'supplierPDFHashVerified': True, 'objects': results, 'writes': 0,
            'comparisonBasis': 'Approved hash-locked extracted source JPEGs; not PDF-stream byte identity'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', required=True,
                        help='Authorized existing directory containing the private docs/mxene-accordion-phase1 inputs')
    parser.add_argument('--supplier-pdf', required=True, help='Authorized original supplier PDF (read only)')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.source_root, args.supplier_pdf), indent=2))
    except (OSError, ValueError) as exc:
        parser.exit(1, f'Private-source verification FAILED: {exc}\n')
