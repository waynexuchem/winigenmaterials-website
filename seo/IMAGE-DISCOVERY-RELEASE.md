# Image discovery release procedure

The normal SEO build regenerates `sitemap.xml` from canonical, indexable HTML and its approved public image associations. It also maintains the canonical sitemap declaration in `robots.txt` and grants large image previews on eligible pages.

IndexNow is deliberately separate from builds and tests. After the static site has been published, place only the canonical page URLs materially changed by that release in a newline-delimited file and run:

```sh
cd stripe-worker
npm run submit:indexnow -- --file ../path/to/release-urls.txt --dry-run
npm run submit:indexnow -- --file ../path/to/release-urls.txt
```

Use `--url https://www.winigenmaterials.com/example.html` for individual additions or updates and `--deleted` for a canonical URL removed in the release. Do not submit cache-token-only changes, noindex pages, redirects, aliases, unfinished Knowledge pages, or the historical sitemap on first activation.

The public verification file is `b22ad449a57a2df14127071a7e045223.txt`. Its value is a public ownership token, not a private credential. A failed IndexNow request exits with an error for operational visibility but cannot affect the already-published website.
