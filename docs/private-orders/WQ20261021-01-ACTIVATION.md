# WQ20261021-01 activation checklist

This release is based on origin/main 4d09573d48617567fc7620e0ecce022730acc9b4.
The owner has authorized controlled production activation at USD 1,290 with zero sales tax, card-only Checkout, no additional fees, and creation of an unpaid Session for verification. Payment submission and sending the link to Google are not authorized.
The owner explicitly approved a narrow exception for the five Worker and six root test failures proven identical to the untouched baseline. No new regression failures or other safeguards are waived. Unrelated Knowledge/product WIP must not be included.

## Quotation and accounting

The supplied quotation is WQ20261021-01, issued October 21, 2026, valid through October 31, 2026.
The source workbook SHA-256 is a94208372d61d8f9130a841df94d982dc82ce0b166b00c850b0a8082a42d4fe3.
Quotation rows 22–25 give package quantities 4 / 1 / 1 / 1 and unit cents 9600 / 12000 / 9600 / 15000.
Product subtotal is 75000 cents, discount 0, freight 54000, quoted tax 0, total 129000 USD cents.
Freight is one fixed line, not a Stripe shipping charge. No carrier is specified.
SP 200 and freight use explicitly internal WM-PRIVATE identifiers, not asserted manufacturer SKUs.
The original workbook is unchanged and is not a public deployment asset.

Settings-sheet sample/Ilika terms, provisional-tax notes, bank details and the pre-existing Settings!B34 #REF! error are not Google commercial terms.
The historical September order and retired September 22 page retain their existing definitions and behavior.

## Required commercial decision

- Obtain explicit approval that charging exactly USD 1,290 with zero sales tax is correct for this order.
- Otherwise issue a revised quotation and separately review the necessary tax implementation before payment activation.
- Do not infer exemption from Google, its domain, DAP, or the zero tax shown in the quotation.
- If automatic tax is separately authorized, verify registrations, delivery location, classifications and freight treatment before implementation. This candidate does not enable automatic tax.
- Confirm missing customer PO/invoice reference only if operationally required. None is invented here.
- No payer email was supplied. Checkout must collect the actual payer billing information; never reuse the September customer's email or Stripe Customer.

## Controlled activation steps

1. Recheck current origin/main and reconcile only the reviewed candidate; preserve unrelated WIP.
2. Compare full-suite failures with the untouched baseline. Only the explicitly approved five Worker and six root failures may remain; stop on any new failure or production mismatch.
3. Re-run private-order, webhook, email, publishing-boundary and full regression suites using disposable local state and mocked transports.
4. Verify the new order's complete server-held configuration and SHA-256 commercial configuration hash.
5. Keep COMMERCE_ENABLED, Stripe/email modes, bindings, secrets, notification recipients, smoke-test controls and existing routes at their approved values.
6. No new D1 migration is required by this candidate. At activation, read-only verify the deployed schema includes existing private_checkout_attempts migration 0008 and the current baseline requirements.
7. Preserve the consignee phone in the server-held fulfillment definition only. Check it is absent from static HTML/review JSON, customer-safe API/status payloads, customer receipts and analytics.
8. Confirm internal notifications retain the approved recipients and use the agreed Google delivery address rather than the payer's billing address. Customer receipt goes only to the verified payer email.
9. After explicit zero-tax approval, authorize setting PRIVATE_ORDER_WQ20261021_01_ZERO_TAX_APPROVED=true for the intended payment environment. Missing, false or any non-exact value keeps only this new order disabled.
10. Remove data-private-order-review="true" from the new page only in that separately approved activation change. Until then, the page always shows REVIEW ONLY — PAYMENT DISABLED, even if mistakenly served on the production hostname.
    Retain the existing commerce-config.js script and verify its approved API origin/checkout enablement at activation. Review rendering works even without that configuration and ignores it for payment.
11. Deploy the approved server and public static manifest changes through the existing release procedure only after authorization. The public manifest remains an explicit allowlist.
12. Under separately authorized live verification, inspect a newly created one-time Session: five fixed lines, USD 129000, billing required, card-only configuration, Adaptive Pricing disabled, no automatic tax, promotion codes, recurring prices, future-use authorization or second shipping charge.
13. Verify Session and PaymentIntent order/quotation metadata and configuration hash; verify reuse, expiry replacement and paid/closed lockout. Never replace a session that might still be payable.
14. Verify signature-checked webhook processing, event/notification idempotency, PAID / NOT_RELEASED separation, customer confirmation and private-order analytics suppression.
15. Verify noindex,nofollow and absence from public navigation, catalog/search, sitemap, Merchant feed, Product schema and IndexNow. Noindex/unlisted status does not provide authentication.

Quotation validity remains informational, consistent with the current private-order policy. The date is displayed but does not automatically close payment or expire the order.
Explicit order closure and Stripe Session expiry remain separate lifecycle controls.
