# Google Merchant feed policy

`/feeds/google-merchant.xml` is generated from `catalog/products.source.json`
and `ecommerce/catalog.source.json`. It is not a separate pricing or product
database.

## Eligibility

The feed includes only products that are publicly marked for active checkout,
are `ONLINE_CHECKOUT` in the commerce catalog, have an approved active package,
and have a public landing page and product image. RFQ products and products that
require shipping or order review before payment are excluded.

`in_stock` means the storefront currently accepts an online order for the
package. It does not claim a specific physical inventory quantity.

## Identifiers and brand

Winigen is publicly presented as a specialist supplier/distributor, not as the
manufacturer of every cataloged material. The feed therefore does not invent a
brand, GTIN, UPC, EAN, ISBN, or MPN. CAS numbers are chemical identifiers, not
GTINs, and are never submitted as GTINs. Internal package SKUs are stable feed
item IDs but are not asserted to be manufacturer part numbers.

Each item uses `identifier_exists=no` until a legitimate manufacturer-assigned
identifier set is approved for that product. Package variants share the
canonical product's stable `skuBase` as `item_group_id` and expose package size
through `variant_option`.

Each package offer links to the canonical product page with a stable
`package=<package SKU>` query parameter. The shared product-page runtime uses
that canonical SKU to activate the matching package card and visible price;
unknown package values safely fall back to the product's normal default. The
HTML canonical URL remains the base product URL without the package parameter.

## Shipping

The feed does not publish shipping attributes. Routine shipping is included in
listed prices for eligible destinations, while products requiring pre-payment
shipping review are excluded. Supported destinations and any Merchant Center
shipping-service configuration must be maintained at the Merchant Center
account level and remain consistent with the storefront.

## Build

From `stripe-worker/`:

```sh
npm run build:merchant-feed
npm run validate:merchant-feed
```

The normal store build also regenerates and validates the feed. The generator
uses an explicit public-field allowlist and fails on duplicate IDs, invalid
prices, malformed public URLs, missing required fields, or forbidden internal
data patterns.
