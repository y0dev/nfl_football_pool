# Stripe Billing — Go-Live Checklist

Everything in the codebase is already wired for Stripe; the billing routes stay
inert (HTTP 503) until the env vars below are set. This doc covers the two
things code can't do for you: the **database migration** and the **Stripe
account setup**.

## Current state (no Stripe yet)

- Plan limits are enforced everywhere regardless of billing:
  - `free`: 1 pool, 15 participants per pool
  - `standard`: 1 pool, 30 participants per pool (add-on pools raise the pool count)
  - Preseason-only pools (`season_scope = [1]`): **always free** on every plan —
    max **2 per commissioner**, max **15 participants** each. They don't count
    against plan pool limits, and re-scoping a pool between preseason and
    regular re-checks the destination limit.
- **Playoff tracking is Standard-only** (`scopeIncludesPlayoffs` in
  `src/lib/plan.ts`): a free-plan commissioner cannot create a pool whose
  `season_scope` includes the postseason (`season_type 3` — the "Playoffs
  Only", "Regular + Playoffs", and "Full Season" scope options), and cannot
  re-scope an existing pool into the postseason. What free users still get:
  regular-season pools, Q1–Q4 period standings, and preseason test pools.
  What the gate does **not** do: it doesn't touch pools that were already
  playoff-scoped before a downgrade (they're grandfathered until manually
  re-scoped), and it doesn't hide playoff pages for participants — the gate
  is on the commissioner's pool scope, which controls whether playoff weeks
  exist for the pool at all.
- **Email pick reminders are Standard-only** (`planAllowsReminders` in
  `src/lib/plan.ts`): the manual send (`/api/admin/send-reminders`) skips
  participants whose pool owner is on the free plan, and the hourly urgent
  check skips free-plan pools entirely. The manual route also now requires an
  authenticated admin caller, and the urgent-reminders cron route requires
  `CRON_SECRET` in production (header `x-cron-secret` or Bearer token) — set
  the same value in the cron service and the deployment env.
- Pricing UI is hidden in production (`/pricing` 404s, no nav links, `/upgrade`
  shows plan/limits with no dollar amounts). Dev shows it by default.
- Upgrades fall back to the manual mailto flow when Stripe is unset.

## 1. Database migration

Billing lives on the `commissioners` table (not `admins` — see the
admins/commissioners split), and `commissionersTable` / `paymentsTable` in
`src/lib/supabase.ts` already include the billing columns and the `payments`
table. Both are included in `scripts/setup-database.ts` (`npm run setup-db`),
so a fresh environment gets them automatically — no manual SQL needed anymore.

Notes:

- `src/lib/plan.ts` reads `addon_pools` defensively (`?? 0`).
- The webhook (and the reconciliation fallback — see below) treat a missing
  `payments` table as non-fatal (the plan update still applies), but it
  should exist in any environment provisioned via `npm run setup-db`.
- Also record schema changes in `docs/database-schema-updates.md`.

## 2. Stripe account setup

1. **Create the account** at <https://dashboard.stripe.com/register>.
2. **Create two products** (Product catalog → Add product), each with **two
   one-time prices** — a regular price and a sale price (pricing is per
   season, not a subscription):
   | Product | Regular price | Regular env var | Sale price | Sale env var |
   |---|---|---|---|---|
   | Sunday Huddle Standard (per season) | $50 | `STRIPE_PRICE_STANDARD` | $40 | `STRIPE_PRICE_STANDARD_SALE` |
   | Sunday Huddle Add-on Pool (per season) | $20 | `STRIPE_PRICE_ADDON_POOL` | $15 | `STRIPE_PRICE_ADDON_POOL_SALE` |

   The `_SALE` prices are only needed once you actually plan to run a
   promotion — see [Sale mode](#sale-mode-env-toggled) below.
3. **Create the webhook endpoint** (Developers → Webhooks → Add endpoint):
   - URL: `https://<your-domain>/api/stripe/webhook` — **use the exact
     canonical domain your host serves without a redirect** (e.g. if Vercel's
     Domains settings redirect the apex to `www`, or vice versa, register the
     `www` URL, not the apex). Stripe does not follow redirects when
     delivering a webhook — a 3xx response counts as a failed delivery and is
     retried, then eventually abandoned, with no plan update ever applied and
     no error visible anywhere in the app. Verify with:
     `curl -I -X POST https://<your-domain>/api/stripe/webhook` — it must
     return a 4xx (missing signature) or 200, never a 3xx.
   - Events: `checkout.session.completed`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET`
4. **Set the env vars** (in `.env.local` / Vercel):
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_STANDARD=price_...
   STRIPE_PRICE_ADDON_POOL=price_...
   NEXT_PUBLIC_ENABLE_PRICING=true
   ```
   `NEXT_PUBLIC_ENABLE_PRICING=true` is what unhides `/pricing`, the nav links,
   and the dollar amounts + Stripe buttons on `/upgrade`. Deploy after setting
   it (NEXT_PUBLIC vars are baked in at build time).
5. **Test in test mode first**: use `sk_test_...` keys + test-mode prices, pay
   with card `4242 4242 4242 4242`, and confirm the admin row's `plan` flips to
   `standard` and a `payments` row appears. For local webhook testing:
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Sale mode (env-toggled)

List and sale prices live in `src/lib/pricing.ts`: Standard is **$50 → $40**,
add-on pools are **$20 → $15**. Sale mode is a single boolean switch — set it,
redeploy, and the whole app (pricing display *and* checkout) switches together:

```
NEXT_PUBLIC_SALE=true                 # on: sale prices + badge shown, sale
                                       # Stripe prices charged at checkout.
                                       # off/unset: regular prices, no badge.
NEXT_PUBLIC_SALE_LABEL=Launch Special # optional badge text (default "Launch Special")
```

Unset (or set to `false`) and redeploy — these are build-time vars — to end
the sale.

**How the Stripe side stays in sync:** `getPriceId()` in `src/lib/stripe.ts`
reads `isSaleEnabled()` from `src/lib/pricing.ts` and picks
`STRIPE_PRICE_STANDARD_SALE` / `STRIPE_PRICE_ADDON_POOL_SALE` instead of the
regular price ids whenever the flag is on — there's no separate step to keep
the charged amount matching the displayed amount. If `NEXT_PUBLIC_SALE=true`
but a `_SALE` price id isn't set, checkout returns 503 ("Product is not
configured") rather than silently charging the regular price.

To change the actual dollar amounts (not just toggle the sale), edit the
`STANDARD_LIST` / `STANDARD_SALE` / `ADDON_LIST` / `ADDON_SALE` constants in
`src/lib/pricing.ts` and create matching Stripe prices — that file is the only
place the numbers live.

To add a future promotion (Black Friday, Kickoff, etc.) that needs a different
sale price than the standing one, update the `*_SALE` constants and Stripe
price ids for that window; the on/off flag and UI don't need to change.

## 3. How purchases flow (already implemented)

1. `/upgrade` → `POST /api/stripe/checkout` with `{ adminId, product, quantity }`
   → redirects to Stripe Checkout (`mode: payment`).
2. Stripe calls `POST /api/stripe/webhook` on `checkout.session.completed`,
   which applies the purchase via `applyCompletedCheckoutSession()` in
   `src/lib/purchases.ts`:
   - `standard` → `commissioners.plan = 'standard'`, trial cleared
   - `addon_pool` → `commissioners.addon_pools += quantity` (raises the pool
     limit; requires Standard, enforced at checkout)
   - a `payments` row is recorded (also the idempotency marker — redelivered
     events are skipped once a row with that `stripe_session_id` exists)
   - a confirmation email is sent to the admin (`sendUpgradeConfirmation` in
     `src/lib/email.ts`) — best-effort, a failed send never blocks the plan
     update or the payment record
3. The success redirect (`/upgrade?checkout=success`) polls `/api/admin/plan-status`
   for ~20s waiting for the webhook to land. If it still hasn't after that
   window, `/upgrade` calls `POST /api/stripe/reconcile` once — this asks
   Stripe directly for the admin's recent paid Checkout Sessions and applies
   any that are missing from `payments` (same `applyCompletedCheckoutSession()`
   function, so it's applied identically and stays idempotent). This is the
   self-heal path for a missed/failed webhook delivery — see the 2026-08-02
   incident below.

### Troubleshooting: "payment went through but nothing changed"

Since the plan/email/payment-record all happen in step 2 above, not on the
redirect, this symptom always means **the webhook never ran, or it ran and
failed silently**. Check, in order:

1. **Dashboard → Developers → Webhooks → (your endpoint) → recent events.**
   If the event isn't listed at all, Stripe never reached your server —
   usually the endpoint isn't registered (Dashboard) yet, or you're testing
   locally without `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   running (Stripe can't call `localhost` directly).
2. If the event **is** listed but shows a non-2xx (or 3xx) response, click it
   to see the response body/status. A signature mismatch (400) means
   `STRIPE_WEBHOOK_SECRET` in your deployment doesn't match the signing
   secret for *that* endpoint. A **307/301/302** means the registered URL
   is being redirected by your host before it ever reaches the app — see the
   incident below; fix by re-registering the endpoint at the exact
   non-redirecting URL.
3. **Check your hosting platform's function logs** for `/api/stripe/webhook`
   around the time of purchase. The webhook route logs unconditionally with
   `console.log`/`console.error` (not the app's dev-only `debugLog` helper)
   specifically so failures are visible in production — a DB write failure,
   missing `adminId`/`product` metadata, etc. will show up there. If there's
   no log line at all for that time window, the request never reached the
   app (same redirect/registration issue as #1/#2).
4. Also worth checking: `payments` table for a row with that
   `stripe_session_id` — if it's missing but the email/plan update happened,
   the DB write for the audit record failed independently (non-fatal by
   design) and should still be investigated.
5. As a stopgap for an affected account, `POST /api/stripe/reconcile` with
   `{ adminId }` re-applies any of that admin's paid Stripe sessions the
   webhook missed — but fix the underlying delivery issue too, since this is
   a fallback, not a replacement for a working webhook.

### Incident: apex-domain webhook silently failing (found 2026-08-02)

The webhook endpoint was registered at `https://sundayhuddle.net/api/stripe/webhook`,
but Vercel's Domains config redirects the apex domain to
`https://www.sundayhuddle.net` (307). Stripe does not follow redirects on
webhook delivery, so **every** `checkout.session.completed` event failed
silently for at least several days — `pending_webhooks` stayed `1` on every
event, several real (test-mode) purchases completed payment in Stripe with
no plan update ever applied, and `payments` had zero rows. Fixed by
re-registering the endpoint at the `www` URL. The `/api/stripe/reconcile`
self-heal path (see above) was added specifically so a repeat of this class
of failure degrades gracefully instead of silently stranding a purchase.

## Tax (always on)

Checkout always passes `automatic_tax: { enabled: true }` (see
`src/app/api/stripe/checkout/route.ts`) — Stripe collects the buyer's billing
address and adds calculated sales tax on top of the list/sale price. The
customer sees and pays the tax on the Stripe Checkout page itself (the total
shown there is higher than the `/pricing` / `/upgrade` number by the tax
amount); `/pricing` and `/upgrade` both say "prices shown are before tax" so
this isn't a surprise. There's no env flag — it's unconditional.

**This only works, and only collects real tax, once the account is set up**:

1. Dashboard → Settings → Tax → **Activate**. Checked via API on
   2026-07-31: sandbox is already `"status": "active"` with origin address
   San Francisco, CA — this step is done for test mode.
2. Add at least one **tax registration** for a state/country where you have
   nexus (Dashboard → Settings → Tax → Registrations). **Not done yet** —
   sandbox currently has zero registrations, so `automatic_tax` runs without
   erroring but calculates **$0.00 tax on every sale** until at least one
   registration exists. Add your home state (likely CA, matching the origin
   address) at minimum. Stripe Tax's monitoring can flag when you cross an
   economic-nexus threshold elsewhere and should register there too.
3. Test mode and live mode are activated/configured **separately** —
   repeat both steps for live mode before going live. Test-mode
   registrations don't require real tax IDs; live ones do.

Quick check from the CLI (swap `--api-key` for the mode you want to check):

```bash
stripe get /v1/tax/settings --api-key sk_test_...
stripe get /v1/tax/registrations --api-key sk_test_...
```

## Out of scope for now (revisit later)

- **Season expiry**: purchases are per-season but nothing auto-downgrades when
  the season ends — decide between a `plan_expires_at` column + cron, or a
  manual reset between seasons.
- **Refunds**: handle `charge.refunded` in the webhook if refunds should
  auto-downgrade.
