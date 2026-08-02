# Stripe CLI — Launch Sale Pricing Setup

Companion to `docs/stripe-billing-setup.md`. Documents the exact `stripe`
CLI commands used to create the launch-sale prices in the **sandbox** (test
mode) account, and the equivalent commands to run against **production**
(live mode) when you're ready to go live.

Feature code: `src/lib/pricing.ts` (list/sale dollar amounts + `NEXT_PUBLIC_SALE`
flag) and `src/lib/stripe.ts` (sale-aware Stripe price ID lookup).

## ⚠️ Price mismatch found while setting this up

The existing **regular** (non-sale) sandbox prices don't match what the code
displays:

| | Code shows (`src/lib/pricing.ts`) | Sandbox Stripe price actually charges |
|---|---|---|
| Standard | $50 | **$30** (`price_1TxzjIKBaPwVuMkDfB9JmcDY`) |
| Add-on Pool | $20 | **$15** (`price_1TxzjJKBaPwVuMkDsnvD88Ze`) |

This predates the sale feature — Standard was already mismatched before this
change; Add-on became mismatched because this change raised its list price
from $15 → $20. It only under-charges (never over-charges), so it's not
urgent, but it means `/pricing` promises one number and checkout bills
another. Section 2 below includes commands to fix it — run them only if you
want to; they're independent of the sale prices.

## 1. What's already done in the sandbox

Ran against the sandbox account (`acct_1TuNnoKBaPwVuMkD`, confirmed via
`stripe config --list`) using the existing Standard/Add-on products:

```bash
stripe prices create \
  --product prod_Uxva8stQZfuVsq \
  --currency usd \
  --unit-amount 4000 \
  --nickname "Standard Sale"
# -> price_1TzGOXKBaPwVuMkD2UZSMN2t  ($40.00)

stripe prices create \
  --product prod_UxvapLjDIJV0Q1 \
  --currency usd \
  --unit-amount 1500 \
  --nickname "Add-on Pool Sale"
# -> price_1TzGObKBaPwVuMkDWo233zCY  ($15.00)
```

`.env.local` already has these wired up:

```
STRIPE_PRICE_STANDARD_SALE=price_1TzGOXKBaPwVuMkD2UZSMN2t
STRIPE_PRICE_ADDON_POOL_SALE=price_1TzGObKBaPwVuMkDWo233zCY
```

Set `NEXT_PUBLIC_SALE=true` locally and restart the dev server to preview it.

## 2. Production (live mode) — commands to run yourself

These charge real cards once wired up, so run them deliberately rather than
copy-pasting blind. Every command below takes `--api-key sk_live_...`
explicitly so it doesn't depend on whatever account your CLI is currently
logged into — swap in your real live secret key each time (Dashboard →
Developers → API keys). You can also `stripe login` against the live account
and drop the `--api-key` flag if you prefer.

### 2a. Find or create the live products

Check whether the live Standard/Add-on products already exist (they may, if
`docs/stripe-billing-setup.md` step 2 was already done for live mode):

```bash
stripe products list --api-key sk_live_... --active true --limit 20
```

Look for `"Sunday Huddle Standard (per season)"` and
`"Sunday Huddle Add-on Pool (per season)"` in the output and note their
`prod_...` ids. If they don't exist yet, create them:

```bash
stripe products create --api-key sk_live_... \
  --name "Sunday Huddle Standard (per season)"
# -> note the returned prod_... id as $STANDARD_PRODUCT

stripe products create --api-key sk_live_... \
  --name "Sunday Huddle Add-on Pool (per season)"
# -> note the returned prod_... id as $ADDON_PRODUCT
```

### 2b. Create the sale prices (required for this feature)

Substitute the product ids from 2a:

```bash
stripe prices create --api-key sk_live_... \
  --product prod_STANDARD_LIVE_ID \
  --currency usd \
  --unit-amount 4000 \
  --nickname "Standard Sale"
# -> STRIPE_PRICE_STANDARD_SALE

stripe prices create --api-key sk_live_... \
  --product prod_ADDON_LIVE_ID \
  --currency usd \
  --unit-amount 1500 \
  --nickname "Add-on Pool Sale"
# -> STRIPE_PRICE_ADDON_POOL_SALE
```

### 2c. Optional — fix the regular-price mismatch (see warning above)

Only run these if you want the "regular" (non-sale) live prices to actually
match the $50 / $20 shown in the code. If live `STRIPE_PRICE_STANDARD` /
`STRIPE_PRICE_ADDON_POOL` already point at correct $50/$20 prices, skip this.

```bash
stripe prices create --api-key sk_live_... \
  --product prod_STANDARD_LIVE_ID \
  --currency usd \
  --unit-amount 5000 \
  --nickname "Standard"
# -> new STRIPE_PRICE_STANDARD

stripe prices create --api-key sk_live_... \
  --product prod_ADDON_LIVE_ID \
  --currency usd \
  --unit-amount 2000 \
  --nickname "Add-on Pool"
# -> new STRIPE_PRICE_ADDON_POOL
```

Stripe prices are immutable — this doesn't touch the old $30/$15 prices, it
just creates new ones. Existing customers keep their `payments` history
either way.

### 2d. Set production env vars

In your hosting provider's environment variable settings (not `.env.local` —
that file isn't deployed, see the pricing-page redirect issue from earlier),
set:

```
STRIPE_PRICE_STANDARD_SALE=price_...     # from 2b
STRIPE_PRICE_ADDON_POOL_SALE=price_...   # from 2b
NEXT_PUBLIC_SALE=true                    # flips the whole app into sale mode
NEXT_PUBLIC_SALE_LABEL=Launch Special    # optional, this is the default
```

If you ran 2c, also update `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_ADDON_POOL`
to the new price ids. Redeploy — `NEXT_PUBLIC_*` vars are inlined at build
time.

### 2e. Verify

```bash
stripe prices retrieve <price_id> --api-key sk_live_...
```

Confirm `unit_amount` matches what you intended, then do one real end-to-end
checkout (or `stripe checkout sessions list --api-key sk_live_... --limit 1`
after a test purchase) to confirm the webhook flips `admins.plan` correctly.
