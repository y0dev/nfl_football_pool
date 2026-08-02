# Fix (or verify) the live-mode Stripe webhook URL

Context: the **test-mode** webhook endpoint was found registered at the apex
domain (`sundayhuddle.net`), which Vercel 307-redirects to
`www.sundayhuddle.net` — Stripe never follows redirects on webhook delivery,
so every event failed silently. That was already fixed for test mode via the
API. Live mode is a **separate** endpoint/config and needs the same check —
run these yourself with your live secret key (never paste it to anyone,
including here).

Requires the [Stripe CLI](https://stripe.com/docs/stripe-cli) installed.
Replace `sk_live_...` with your real live secret key in every command below.

## 1. List live-mode webhook endpoints

```bash
stripe get /v1/webhook_endpoints --api-key sk_live_...
```

Look at the `url` field on each result.

- If one is registered at `https://sundayhuddle.net/api/stripe/webhook`
  (apex, no `www`) → go to step 2.
- If one is already registered at `https://www.sundayhuddle.net/api/stripe/webhook`
  → skip to step 3 to confirm it's actually reachable.
- If the list is empty → live mode has no webhook at all yet; go to step 2b
  instead of 2 to create one.

## 2. Update the existing endpoint's URL

Grab the endpoint's `id` (looks like `we_...`) from step 1's output.

```bash
stripe post /v1/webhook_endpoints/we_XXXXXXXXXXXX \
  -d url="https://www.sundayhuddle.net/api/stripe/webhook" \
  --api-key sk_live_...
```

### 2b. Or, if no live endpoint exists yet, create one

```bash
stripe post /v1/webhook_endpoints \
  -d url="https://www.sundayhuddle.net/api/stripe/webhook" \
  -d "enabled_events[]"="checkout.session.completed" \
  -d "enabled_events[]"="charge.refunded" \
  --api-key sk_live_...
```

Copy the `secret` (`whsec_...`) from the response into your production
`STRIPE_WEBHOOK_SECRET` env var (Vercel) — this is only shown once, at
creation time.

## 3. Verify the URL is actually reachable (no redirect)

```bash
curl -I -X POST https://www.sundayhuddle.net/api/stripe/webhook
```

Expected: `HTTP/2 400` (missing `stripe-signature` header — this means the
request reached the app). If you instead see `HTTP/2 307` (or any 3xx) with
a `location:` header, the domain is still redirecting and needs to be fixed
at the Vercel Domains level, or the webhook needs to point at whichever
domain doesn't redirect.

## 4. Confirm end to end

Make a real (or Stripe-CLI-triggered) live purchase, then check:
`stripe get /v1/events?type=checkout.session.completed --api-key sk_live_...`
— the corresponding event's `pending_webhooks` should be `0`, not `1`.
