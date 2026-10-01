# Kora live setup

The downloaded project starts in demo mode. Neon, Google OAuth, Paystack and Mailgun integrations are implemented; configure them on your own Vercel deployment. Demo carts, reviews and orders stay in their browser. Live account carts are stored in Neon and belong to the same verified Google account on every device. See START_HERE.md for the local and GitHub setup.

Enter secrets in the hosting environment settings. Do not paste API keys, database passwords or client secrets into chat or commit them to Git.

## What you need

| Service | Required environment values | Configuration |
| --- | --- | --- |
| Neon | DATABASE_URL | Copy the pooled PostgreSQL connection string, including TLS settings, from your project's Connect dialog. |
| Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Create a Web application OAuth client and configure its consent screen, audience and exact redirect URI. Add test users while the app is in testing. |
| Paystack | PAYSTACK_SECRET_KEY | Begin with the test secret key. Configure callback and webhook URLs. Complete business activation and settlement banking directly in Paystack before using live keys. |
| Mailgun | MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM, MAILGUN_API_BASE_URL | Use a server key with sending and delivery-event permissions, a verified sending domain and an appropriate sender address. |
| Store | APP_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, STORE_OWNER_EMAIL, EMAIL_TEST_OWNER_EMAIL | Choose the final HTTPS origin and verified owner email. Use a strong, stable session secret. |
| Courier automation | Courier merchant account, API credentials and webhook documentation | Select a courier before adding automatic shipment updates. Manual owner updates already work. |

Also provide real inventory, product photos and features, stock, delivery fees, support contacts and refund policies before opening the store.

## Exact URLs

Replace `https://your-store.vercel.app` below with your assigned Vercel domain or final custom domain. Use the same origin in every service setting.

| Setting | Your public deployment value |
| --- | --- |
| APP_URL and NEXTAUTH_URL | https://your-store.vercel.app |
| Google authorized JavaScript origin | https://your-store.vercel.app |
| Google authorized redirect URI | https://your-store.vercel.app/api/auth/callback/google |
| Paystack callback URL | https://your-store.vercel.app/checkout/success |
| Paystack webhook URL | https://your-store.vercel.app/api/paystack/webhook |

Google redirect URIs must match exactly. Payment webhooks need a publicly reachable HTTPS deployment. Check that deployment protection does not block Paystack from reaching your production webhook.

The Paystack hosted-redirect integration requires a server secret key; no browser public key is needed. Bank verification and settlement details belong in Paystack's dashboard, not in application source or chat.

## Mailgun

Set MAILGUN_API_BASE_URL to the region hosting the domain:

- US: https://api.mailgun.net
- EU: https://api.eu.mailgun.net

For production, verify the sending domain with Mailgun's exact SPF and DKIM DNS records. You need DNS access to that domain. MX records are for receiving mail; do not replace existing business-mail MX records just to send receipts.

For testing, a Mailgun sandbox is sufficient, but the recipient must be authorized in Mailgun and accept the verification invitation. It is not the production customer-email configuration.

MAILGUN_FROM can use a sender such as Kora <orders@yourdomain.com>. The server key must also read events to support the test page's delivery check.

## Activation

1. Configure local .env.local and hosted environment values. Keep them aligned; secrets do not belong in .openai/hosting.json.
2. Set DATABASE_URL, then run pnpm db:migrate and pnpm db:seed. The migrations include reviews and delivery events. Seed adds sample products without overwriting existing inventory.
3. Replace the sample catalog and policies with real store data.
4. Configure Google OAuth and a strong NEXTAUTH_SECRET of at least 32 characters.
5. Set APP_MODE=live with a Paystack **test** key for server-backed payment testing. APP_MODE=demo deliberately makes no payment requests.
6. Verify the complete account, payment, email and delivery flow before installing the live Paystack key.

Generate a session secret locally:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Keep it stable across deployments. Rotation signs users out and invalidates emailed tracking links.

Set a separate CRON_SECRET if scheduling maintenance. A scheduler can call GET /api/cron about every five minutes with Authorization: Bearer CRON_SECRET to release expired reservations and retry receipts. No external schedule has been created automatically.

## Test email delivery without paying

Mailgun testing requires no purchase or Paystack payment. On Vercel, configure Neon and Google authentication, then use live app mode to sign in as the verified owner. The Sites dispatcher can authorize email testing in demo mode on that host.

1. Configure owner authentication, the four Mailgun values and EMAIL_TEST_OWNER_EMAIL, then redeploy.
2. Open /email-test as the verified owner.
3. Enter a name and an email you control. Authorize it first if using the sandbox.
4. Send the test email. Invalid fields show red errors and sending has a loading state.
5. A success modal appears only after Mailgun accepts the message. Check delivery status, then the inbox and spam folder.

“Accepted” means queued by Mailgun; “delivered” means accepted by the recipient's mail server. Neither proves inbox placement. The test is labeled as a sample receipt and creates no order or payment.

## Reviews and delivery

Signed-in purchasers can publish or edit one review per item after a verified payment. Ratings and counts come from saved reviews. Public authors show a first name and last initial, not an email or account ID. Demo reviews are clearly labeled and never treated as verified purchases.

Customers can track a paid order from the receipt, account or confirmation email. The expiring email link grants limited delivery information without exposing a full address, email or phone.

The owner uses /admin/orders to record preparation, packed, courier, out-for-delivery and delivered stages. Add a courier name, tracking number, HTTPS tracking link, location or estimated date. Only record events that happened. Completed stages cannot be reversed, and concurrent updates are checked.

Tracking refreshes every 30 seconds and when returning to the tab. It displays recorded milestones; automatic courier feeds require the chosen provider's integration.

## End-to-end checks before launch

- Sign in with the same Google account on two devices and confirm its saved cart. Another account must not see it. Guest selections merge once; signing out keeps account items private.
- Complete a Paystack test payment and confirm stock changes once, purchased quantities leave the cart and repeated callbacks/webhooks remain safe.
- Confirm an itemized Naira email reaches a controlled mailbox and its tracking link works.
- Record an owner delivery update and confirm the customer sees it.
- Confirm only a purchaser can review that item, and editing does not add another review.
- Confirm real inventory, policies, monitoring, database backups and recovery procedures.

Automated local checks are separate from provider acceptance tests. A database configured on another preview host does not automatically supply credentials to Vercel. Configure and verify the target deployment's services before launch.

## Official references

- Google OAuth: https://developers.google.com/identity/openid-connect/openid-connect
- Neon connections: https://neon.com/docs/get-started/connect-neon
- Paystack webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack environments: https://paystack.com/docs/api/
- Mailgun DNS: https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-verify
- Mailgun sandbox: https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox
- Mailgun regions: https://documentation.mailgun.com/docs/mailgun/api-reference/api-overview
