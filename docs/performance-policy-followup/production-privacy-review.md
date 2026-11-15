# Read-only production/privacy verification — 12 November 2026

No email, payment, tracking setting, Merchant setting or production configuration was changed.

## Verified account evidence

- contact@winigenmaterials.com: existing messages addressed to this alias are present in Wayne's connected inbox (including November messages); existing staff-sent mail uses the contact alias. This is evidence of an actively used, monitored mailbox, not a claim that a new test delivery was performed. No test message sent; no mail-routing rule changed.
- Merchant primary source: 424 items and **42 target countries**, read from the expanded data-source Countries cell. Exact countries are in merchant-return-settings.json. They were not inferred from cart destinations. One generic international website policy and one canonical URL are proposed; no country-specific pages.
- Existing Merchant policy: United States only, https://www.winigenmaterials.com/quality.html, defective-products-only acceptance, **Accept exchanges**, return-window summary N/A, cost Free. This differs from the prepared mapping. No checkbox, country, exchange selection or Save action was changed. The edit-summary was read and cancelled.
- GA4 web stream matches **G-4PD1MZYGLS** and reports active collection. Stream enhanced-measurement control was unchecked and its listed measurement was Page views. Do not describe automatic form/video/download tracking as confirmed enabled.
- GA4 retention: **event data 2 months; user data 14 months; reset on new activity enabled**. These do not govern all aggregated reports or business records.
- Google signals: not enabled (Turn on offered). Granular location/device collection: enabled. Ads personalization: allowed in 307/307 regions. That permission does not prove that an advertising campaign or audience export is running. User-provided-data onboarding is not completed; do not claim enhanced hashed-customer-data collection is enabled.
- Consent diagnostics: analytics_storage, ad_storage, ad_user_data and ad_personalization signals **inactive**. The UI's generic Good/no-issues label is not a legal compliance determination.

## Implemented data flows and verification limits

Inspected implementation: assets/js/main.js initializes GA4 on production hosts without a consent gate; cart.js stores cart/country/review state; purchase-tracking.js dispatches server-confirmed transaction/item data and uses a transaction-keyed local marker. No analytics/runtime code is changed here. The Privacy draft accurately discloses that a current on-page preference centre is absent.

The inspected contact workflow uses Cloudflare Turnstile, request tokens, D1 records and a queue, then the configured Resend provider. Hosted Stripe handles card entry; verified webhook state, not the redirect, determines payment. The static Worker has a CONTACT_API service binding. These implementation facts support the draft's provider/flow descriptions. This review does not authenticate production D1, inspect customer rows, expose environment values or claim a new provider-retention audit.

Direct production HTTP reads returned 403 and direct script navigation was blocked by the browser client. No protection was bypassed. Therefore no fresh byte-for-byte match of deployed main.js/commerce/contact code is claimed. The GA account configuration and mailbox delivery findings above were independently observed in authenticated read-only views. Production backend configuration and provider operational retention beyond these observations remain confirmation items, rather than invented assertions.

No universal purge deadline is implemented in the inspected application source. Confirm actual D1/backups/log retention, Resend retention, payment/accounting obligations and privacy-request ownership operationally before publishing Privacy. Do not infer those settings from provider defaults or test configuration.

## Minimum viable consent solution — proposal only

The verified Merchant audience includes EEA countries and the UK. Ordinary nonessential analytics/tracking generally requires prior consent there; Winigen's current GA configuration must not be assumed to qualify for narrow local statistical exemptions. This is a concrete implementation gap requiring review, not a reason to alter tracking silently.

The smallest conservative proposal is a **global basic opt-in** for optional analytics (avoids guessing geography): keep essential cart/security/payment functions available; equal, clear Accept analytics / Reject optional choices; no Google tag load, identifiers or analytics/purchase sends before affirmative consent; persistent first-party choice and an accessible withdrawal/preferences link. Do not use advanced cookieless pings as an unreviewed substitute for blocking. If consent is refused, do not queue purchases for later transmission or falsely mark an analytics dispatch sent. On acceptance, preserve server-authoritative purchase payloads and existing transaction deduplication. Keep advertising consent denied unless that separate purpose is approved and consented. Decide applicable US opt-out/GPC handling and provider settings with the privacy review; do not claim a universal legal exemption.

After Wayne approves wording and the necessary controls, publish **one dedicated /policies/privacy.html page** with a shared footer link and accessible pre-purchase policy access. No policy effective date is assigned until approval for actual publication. Returns remains a separate single generic page.

References (current primary guidance):
- https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm
- https://ico.org.uk/global/privacy-notice/visitors-to-our-website/
- https://support.google.com/analytics/answer/10000067
- https://support.google.com/analytics/answer/7667196
- https://support.google.com/merchants/answer/14011730

## Unapplied Merchant mapping

Keep defective-only acceptance; no general buyer-remorse returns or automatic exchanges. Do not turn the 7-day damage / 30-day specification reporting windows into an unrestricted 30-day physical-return promise. Do not promise customer-generated chemical labels. Five business days is refund initiation after approval/verification, not guaranteed customer receipt. Existing defective-only UI displays N/A for a general window; if later available fields require contradictory terms, leave the mapping unapplied and resolve the mismatch. No Merchant or feed changes are authorized at this checkpoint.
