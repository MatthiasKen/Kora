# Verification record

Reviewed on 1 October 2026 for local VS Code development and Vercel deployment.

## Dependencies and installation

- Verified with Node 24.19.0 and pnpm 11.25.0.
- Updated Next.js to 16.3.6 and Drizzle ORM to 0.45.2, resolving their published security advisories.
- Scoped the legacy Drizzle Kit loader to patched esbuild 0.25.12. Its real schema-generation command loads all nine tables and reports no schema changes against the committed migrations.
- `pnpm audit --json` reports zero known vulnerabilities, including development dependencies, at the review date.
- The source archive was extracted into a clean folder. `pnpm install --frozen-lockfile --strict-peer-dependencies`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass without copied modules, private environment files or previous build output.
- Type checking generates the current Next.js route declarations before running TypeScript. Generated next-env.d.ts is excluded from Git.
- vercel.json pins install and build to pnpm 11.25.0, preserving the workspace build-script policy. The documented Vercel framework is Next.js with the default output directory.

Some adapter/tooling dependencies still emit upstream deprecation notices. Installation, peer checks, schema generation, tests and the production build succeed; these notices are not suppressed.

## Commerce verification

All 38 tests across seven suites pass. They apply both committed migrations to embedded PostgreSQL (PGlite) and exercise the actual commerce services. Coverage includes:

- Server-side pricing, checkout retries, inventory reservations and overselling prevention.
- Matching successful NGN payments to saved references, amounts and customers; duplicate finalization and late-payment handling.
- Cart cleanup that preserves later additions; guest/account merge, logout privacy, account isolation, stale-session rejection and concurrent device reconciliation.
- Verified-purchaser reviews, one editable review per item and saved rating aggregates.
- Delivery beginning only after verification, idempotent milestones, version checks and limited tracking output.
- Expiring tracking links, raw-body webhook signatures, escaped receipts, Mailgun request/error/status handling, Nigerian delivery validation and bounded JSON requests.
- Product matching, combined price/stock/rating filters and safe persisted selections.

Mailgun and payment checks use mocked provider responses. They do not charge a card or prove delivery to an external mailbox.

## Responsive browser checks

The production build was inspected in Chromium at widths of **320, 360, 390, 414, 640, 700, 701, 768, 900, 901, 1024 and 1440 pixels**, including the transitions between mobile, tablet and desktop styles. The 101 page/panel states cover the home page, catalog, product detail, account, help, email-test access page, tracking entry and wishlist, plus mobile navigation, search, filters, bag and checkout. No horizontal page overflow, offscreen panel content or browser runtime errors occurred after panel animations settled. Intentional inner scrolling, including comparison tables and product rails, is kept inside its container.

Focused normal-animation checks at **320×640**, **320×280** and **844×390** verify that:

- Search results scroll inside the available panel height while the input, close button and footer remain reachable.
- The bag's item list remains available in short/landscape viewports. The whole panel scrolls there; its close button stays in the sticky heading when reaching checkout.
- Search and bag close controls have 44×44px touch targets and work without a keyboard.
- Large cached quantities and Naira totals remain inside the panel.

The add-to-bag notification is dismissed when opening the bag, so it no longer covers the mobile heading and close control. Comparison headings reserve space for their close control. Unrated comparison items show “No reviews yet” instead of a zero-star rating; demo review labels are limited to demo mode. Search, bag and checkout screenshots were visually inspected.

A final shopping smoke check uses the extracted source's production build: mobile search and comparison, bag controls, sign-in/cart restoration, sold-out controls, validated demo checkout, receipt and tracking. Light and dark views are checked at mobile and desktop widths. Demo activity is labeled and takes no payment.

These are browser viewport checks on Linux, not a claim of testing native Safari, a physical phone, Windows, or an actual Vercel deployment. Inspect the final store on your devices after deployment.

## External service setup

The exported source contains placeholders in .env.example and no private credentials. Local review uses demo mode and isolated test data. A Neon connection configured on a different host must also be added to Vercel; it is not included in the archive.

Google authentication, Paystack acceptance, real Mailgun delivery and courier activity must be checked with the target deployment's credentials and exact public URLs. Mailgun email testing on Vercel requires a verified Google owner session and the live-mode database setup; it does not require paying for an order. Automatic courier integration is separate from the implemented manual delivery milestones. See START_HERE.md, README.md and LIVE_SETUP.md.

The optional Cloudflare/Sites adapter remains in the repository. This review targets the standard Next.js build used by Vercel; it does not publish or redeploy the existing preview.
