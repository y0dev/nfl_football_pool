# Stripe Sandbox Testing Notes

Local test URL: http://localhost:3000/upgrade

## Test card numbers (Stripe test mode — no real charge)

| Scenario | Card number | Result |
|---|---|---|
| Success | 4242 4242 4242 4242 | Payment succeeds |
| Requires authentication (3D Secure) | 4000 0025 0000 3155 | Triggers 3DS challenge modal |
| Declined | 4000 0000 0000 0002 | Card declined (generic) |
| Insufficient funds | 4000 0000 0000 9995 | Declined — insufficient funds |

For all test cards:
- **Expiry**: any future date (e.g. 12/34)
- **CVC**: any 3 digits (4 for Amex)
- **ZIP**: any 5 digits (e.g. 12345)
- **Name / email**: anything

## This project's sandbox setup

- Sandbox account: "Sunday Huddle sandbox" (acct_1TuNnoKBaPwVuMkD)
- Products created:
  - Standard (per season) — `price_1TxzjIKBaPwVuMkDfB9JmcDY` — $30.00
  - Add-on Pool (per season) — `price_1TxzjJKBaPwVuMkDsnvD88Ze` — $15.00
- Local webhook forwarding:
  ```
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  ```
  Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## What to verify after a test purchase

1. Toast on `/upgrade?checkout=success`.
2. `admins.plan` flips to `standard` in Supabase (for the Standard product).
3. A row appears in the `payments` table.
4. `stripe listen` terminal shows `checkout.session.completed` forwarded with a 200 response.
