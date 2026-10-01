# Kora — Everyday, elevated.

A complete Next.js e-commerce storefront for Nigeria with a working browser demo and a server-backed live mode. The live integrations are implemented; your service credentials and database migration are required to activate them.

**Downloading for VS Code / GitHub / Vercel?** Start with [START_HERE.md](START_HERE.md). It includes Windows commands, the production build and the Vercel settings. Open the extracted folder containing package.json; the download has no nested kora-shop directory.

## Run the demo

Requires Node.js 22 or newer and pnpm 11.25.0.

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
pnpm dev
```

Open http://localhost:3000. If pnpm is missing, install it with `npm install -g pnpm@11.25.0`. On macOS/Linux, copy the environment file using `cp .env.example .env.local`.

The demo has 31 products, including 3 sold-out items. It includes a persistent bag and wishlist, quick views, keyboard search (Ctrl/⌘ K), comparison for up to 3 products, recently viewed products, URL-persisted price/stock/rating filters, sorting, delivery estimates, daily-deal timers, light/dark themes, preview accounts, validated delivery forms, sample receipts and order history with Buy again. Sold-out items remain visible with disabled purchase buttons. Reviews accept 1–5 stars, and cards show a five-star scale with an explicit unrated state. Sample orders are marked as demos. They take no payment and send no email. Account bags survive refresh and are restored when that account signs back in; signing out shows a fresh guest bag. Demo account data is not a real Google session.

## Connect the live services

### 1. Neon PostgreSQL

Create a Neon project and copy its pooled PostgreSQL connection string into `DATABASE_URL` in `.env.local`. Include the connection string's TLS parameters. This app uses Drizzle and Neon's serverless driver; single queries use HTTPS and interactive transactions use WebSockets.

```powershell
pnpm db:migrate
pnpm db:seed
```

Committed SQL migrations live in `drizzle/`. The seed adds 31 illustrative products, including 3 with zero stock. Existing products are preserved. Replace the sample catalog, prices, stock, photographs, ratings, support details and store policies before trading. Edit the catalog with your database console or Drizzle Studio; an admin inventory dashboard is outside this project brief. Store timestamps as UTC; deal deadlines are rendered as countdowns. Demo campaigns reset at Lagos midnight. Live campaign deadlines come from `products.deal_ends_at` and do not reset automatically.

Tables: `users`, `products`, `carts`, `cart_items`, `orders`, `order_items`, `email_outbox`, `product_reviews` and `delivery_events`. Foreign keys, unique payment references, quantity checks, price checks and non-negative inventory constraints are included.

### 2. Google OAuth

In Google Cloud Console, configure the OAuth consent screen and create a Web Application OAuth client. In testing, add your Google account as a test user.

Authorized JavaScript origins:

```text
http://localhost:3000
https://your-store-domain.com
```

Authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://your-store-domain.com/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`. Generate a session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Auth uses NextAuth with verified Google email addresses, JWT sessions, database user IDs and server-side ownership checks. Profile/order APIs return 401 without a session. The `/account/orders` route redirects unauthenticated customers to sign-in. No Google access or refresh tokens are exposed to the client.

### 3. Paystack

Start with a Paystack **test secret key** in `PAYSTACK_SECRET_KEY`. Keep it server-only. The app uses Paystack's hosted redirect checkout; no public key or card entry form is needed in your source.

In the Paystack dashboard set:

```text
Callback URL: https://your-store-domain.com/checkout/success
Webhook URL:  https://your-store-domain.com/api/paystack/webhook
```

`APP_URL` must be the canonical store origin. Mutating cart/checkout/profile requests must originate from this origin. When using another localhost port, update both `APP_URL` and `NEXTAUTH_URL` to match it. The server calculates item prices and delivery fees, then sends **kobo** to Paystack (`naira × 100`). Card, bank transfer and USSD channels are requested, subject to the methods available on your Paystack account.

Pending orders reserve inventory for 30 minutes. The callback and webhook both verify the payment with Paystack. A transaction is finalized only if its successful status, reference, NGN currency, exact amount and customer email match the saved order. Webhooks validate HMAC SHA-512 on the original request body using constant-time comparison.

The payment transaction updates order status, stock, reservations and the purchased cart quantities together. Repeated callback/webhook deliveries do not deduct stock or create orders twice. Cart additions made after starting checkout are preserved. If an expired reservation receives a successful late payment and stock cannot be fulfilled, the payment is recorded as `fulfillment_review` for merchant fulfilment/refund handling.

### 4. Mailgun

Verify your sending domain with Mailgun and configure its DNS records. Set:

```text
MAILGUN_API_KEY=your-server-key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM=Kora <orders@mg.yourdomain.com>
MAILGUN_API_BASE_URL=https://api.mailgun.net
```

For an EU domain, use `https://api.eu.mailgun.net`. Sandbox domains can send only to authorized recipients. The app sends HTML and plain-text receipts containing the full order ID, payment reference, Lagos date/time, quantity, original/discounted unit price, line totals, delivery charge, total paid and shipping address. User-provided content is escaped in HTML.

A durable outbox entry is inserted inside the verified-payment database transaction. Delivery is attempted immediately after the commit. A Mailgun failure does not undo a paid order. Leases prevent concurrent send attempts and failures back off for later retry. Delivery is at-least-once: a crash between provider acceptance and recording delivery can produce a duplicate receipt. A stable Message-ID helps reconciliation; it is not a claim of Mailgun exactly-once delivery.

#### Test email delivery without a purchase

Open `/email-test` as the store owner. The page previews the receipt, sends a clearly marked test email to your chosen recipient, and checks Mailgun events for that message. It does not require a purchase or Paystack. On Vercel, owner authentication requires configured Google login, an initialized database and live app mode. On Sites, the verified dispatcher can authorize this tool while the shop remains in demo mode. Test emails do not create orders, take payment, reduce stock or clear any bag. The API key stays on the server.

Set `EMAIL_TEST_OWNER_EMAIL` to the verified owner email. On Sites, access requires the authenticated dispatcher's identity to match this allowlist. On another host, it requires a verified Google session matching that address. Browser demo sign-ins never authorize email sending. On Sites, configure runtime variables through its hosting environment settings; do not put secrets in source or hosting.json. A redeployment applies configuration changes.

Enter a recipient name and email, click **Send test email**, then **Check delivery status**. Invalid inputs show red field messages. During sending the form is locked and a loading indicator appears; a success modal opens only after the server confirms Mailgun acceptance. Errors and unconfigured providers never show a successful-send modal. `accepted` means Mailgun queued the message; `delivered` means the recipient's mail server accepted it. Check the inbox and spam folder to confirm its placement. Permanent and temporary failures are shown separately. A sending-only API key may not have permission to read events; use an appropriate server API key for the status check.

For recovery and reservation cleanup:

```powershell
pnpm email:retry
```

Or set `CRON_SECRET` and configure your hosting scheduler to call `GET /api/cron` about every five minutes with `Authorization: Bearer YOUR_CRON_SECRET`. The endpoint releases expired reservations and retries queued receipts. Scheduling this maintenance task is a deployment step; no external schedule has been created by this project.

### 5. Enable live mode

After migration, catalog replacement, OAuth configuration, a successful Paystack test payment and Mailgun validation, set:

```text
APP_MODE=live
APP_URL=https://your-store-domain.com
NEXTAUTH_URL=https://your-store-domain.com
```

Restart/redeploy so the configuration takes effect. Missing live credentials produce explicit service errors; the real checkout never silently creates a demo order. Do not commit `.env.local` or paste keys into chat.

## Cart persistence

Live account carts follow the same verified Google account across devices. The visible bag refreshes on focus, reconnection and every 20 seconds while active. Concurrent writes reapply this device's quantity changes to the current server bag instead of silently replacing another device's additions. Explicit removals remain removals. Sync errors provide a retry action without blocking account or product pages.

Guest carts use opaque, HttpOnly, SameSite cookies; only a SHA-256 token hash is saved in the database. Signing in locks and merges the guest bag into the account bag once. Signing out leaves the account bag saved privately and starts a new, empty guest session. Signing back into that account restores its saved items; any new guest selections merge once. A different account never inherits the previous account's bag. Cart writes carry the expected session owner and are rejected if sign-in changes during a request. Optimistic revisions prevent silent overwrites from different tabs. Google sign-in and checkout flush pending changes first.

Authenticated APIs derive the user from the server session, never a submitted user ID. Guest receipts require an opaque receipt cookie; account receipts require ownership. Live account bags remain in the database; browser storage backs up guest selections and keeps wishlists. Demo bags use separate browser keys for each account and for guests. The live server is authoritative for inventory and payment amounts.

## Production launch checks

Product pages include an About this item section and ratings calculated from customer reviews. Verified purchasers can submit or edit one review per item. Demo reviews are explicitly labeled. The price filter and numeric maximum support ₦5,000,000.

Verified payments start a delivery timeline. Customers can track their orders from receipts, their account or a signed, expiring email link exposing limited delivery details. The owner manages milestones at /admin/orders. Updates check versions and idempotency keys and cannot skip or reverse completed steps. Courier automation requires a provider-specific integration; the owner workflow supports manual updates now.

Before accepting customer orders:

- Replace illustrative products, photos, ratings, inventory, delivery fees, support contacts and policies with verified store data.
- Apply migrations to Neon, confirm TLS, configure backups, and test restoring them.
- Verify Google login and sign-out with the exact production callback URL and account/cart isolation.
- Complete a Paystack test transaction, a failed/cancelled payment, and duplicate callback/webhook checks; reconcile provider and database totals before switching to live keys.
- Verify Mailgun domain DNS, send a receipt to a mailbox you control, check its delivery event and inbox/spam placement, and enable the outbox retry scheduler.
- Configure host monitoring and alerts for API errors, failed receipts and orders requiring fulfilment review.
- Keep credentials in host secret storage; verify the host, OAuth and Paystack origin settings after any domain change.

JSON mutation endpoints enforce a 64 KiB byte limit and return 400/413/415/422 for malformed, oversized, incorrectly typed and invalid requests. The Paystack webhook separately limits the exact raw body used for signature verification. Form schemas run on both client and server. Email and checkout submissions are guarded while in flight; email timeouts explain how to check the provider before retrying.

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm build
```

The automated tests run against embedded PostgreSQL (PGlite), using the committed migrations and the actual commerce services. They cover price tampering, stock reservation, overselling prevention, duplicate payment processing, cart cleanup, late payments, account isolation, stale-session cart writes, Mailgun message formatting and delivery status, webhook signature validation, deal expiry, delivery validation and HTML escaping. Live third-party services require an end-to-end test with your own credentials; they have not been exercised against external accounts here.

See [QA.md](QA.md) for the verification record and [LIVE_SETUP.md](LIVE_SETUP.md) for the complete service activation checklist.

## Deployment

**Vercel:** import the GitHub repository, select Next.js and the folder containing package.json, and keep the default Output Directory. The included `vercel.json` pins both install and build to pnpm 11.25.0. Configure server variables in the dashboard and use the exact public deployment origin for APP_URL, NEXTAUTH_URL, Google redirects and Paystack callbacks. Migrate the target Neon database once; configuration changes require redeployment. See [START_HERE.md](START_HERE.md).

**Node hosting:** use `pnpm build` then `pnpm start` on a persistent Node host with the same environment variables. Keep secrets in the host's secret manager.

**Cloudflare:** OpenNext configuration is included. Use `pnpm build:worker` and `pnpm preview:worker`. The generated Worker is `.open-next/worker.js`; assets are in `.open-next/assets`. The configuration enables Node compatibility. An owner-private demo is supplied separately through ChatGPT Sites. The downloaded project can be deployed to your own host.

Production builds explicitly use Webpack. The Worker build clears both Next.js and OpenNext output to prevent stale manifests and duplicate environment exports. This prevents the deployed OpenNext Worker from attempting to load unresolved Turbopack server chunks at runtime.

`pnpm build:artifact` also bundles the Worker locally without uploading it, then prepares `dist/server/index.js`, `dist/client` and the hosting metadata for Sites.

## Project map

```text
src/app/                 Pages, layouts and API routes
src/components/          Storefront, bag, account, checkout and receipt UI
src/components/ui/       Radix/shadcn components and Aceternity Spotlight
src/db/                  Drizzle schema and Neon connection factory
src/lib/                 Auth, cart merge, pricing, payment and email services
drizzle/                 Versioned PostgreSQL migrations
scripts/                 Migrate, seed and email retry commands
tests/                   Database integration and security tests
public/images/           Local product photographs and custom hero
```

Design: crisp white and ink surfaces with cobalt accents, DM Sans, responsive shopping grids, a matching dark theme through next-themes, a cmdk search palette, accessible Radix dialogs/sheets/accordions, Framer Motion transitions, reduced-motion support and an Aceternity Spotlight. Images and fonts are bundled locally, so the store doesn't depend on remote image availability.

## Integration references

- [Paystack: accept payments](https://paystack.com/docs/payments/accept-payments/)
- [Paystack: verify payments](https://paystack.com/docs/payments/verify-payments/)
- [Paystack: webhook validation](https://paystack.com/docs/payments/webhooks/)
- [Mailgun: send a message](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages)
- [Neon and Drizzle](https://orm.drizzle.team/docs/get-started/neon-new)
- [NextAuth Google provider](https://next-auth.js.org/providers/google)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare/get-started)
- [shadcn/ui](https://ui.shadcn.com)
- [Aceternity Spotlight](https://ui.aceternity.com/components/spotlight)
