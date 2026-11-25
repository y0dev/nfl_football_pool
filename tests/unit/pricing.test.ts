// Sale calendar: the page and checkout pick prices from the same dates, and
// checkout refuses a Stripe price that doesn't match what the page shows.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SALES, getActiveSale, getStandardPrice, getAddonPoolPrice, STANDARD_LIST, ADDON_LIST } from '../../src/lib/pricing';
import { SALE_PRICE_ENV, getCheckoutPrice, checkoutPriceMismatch } from '../../src/lib/stripe';

const ENV_KEYS = ['NEXT_PUBLIC_SALE', 'STRIPE_PRICE_STANDARD', 'STRIPE_PRICE_STANDARD_SALE_THANKSGIVING', 'STRIPE_PRICE_ADDON_POOL_SALE'];
// Every test starts from no sale override and no configured price ids.
const clearEnv = () => { for (const k of ENV_KEYS) delete process.env[k]; };
clearEnv();
afterEach(clearEnv);

const et = (iso: string) => new Date(iso);

test('sales never overlap and each ends after it starts', () => {
  const spans = SALES.map(s => [Date.parse(s.starts), Date.parse(s.ends), s.id] as const).sort((a, b) => a[0] - b[0]);
  for (const [start, end, id] of spans) assert.ok(start < end, `${id} ends after it starts`);
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i - 1][1] <= spans[i][0], `${spans[i - 1][2]} overlaps ${spans[i][2]}`);
});

test('every sale has a Stripe price env var per product', () => {
  for (const s of SALES) assert.ok(SALE_PRICE_ENV[s.id], s.id);
});

test('Thanksgiving: $40 from midnight Eastern on Thanksgiving through Cyber Monday', () => {
  assert.equal(getActiveSale(et('2026-11-25T23:59:59-05:00')), null);
  const start = getStandardPrice(et('2026-11-26T00:00:00-05:00'));
  assert.deepEqual(start, { list: STANDARD_LIST, sale: 40, effective: 40, onSale: true, saleLabel: 'Thanksgiving Sale' });
  assert.equal(getStandardPrice(et('2026-11-30T23:59:59-05:00')).effective, 40);
  assert.equal(getActiveSale(et('2026-12-01T00:00:00-05:00')), null);
  assert.equal(getStandardPrice(et('2026-12-01T00:00:00-05:00')).effective, STANDARD_LIST);
});

test('playoffs $30 and preseason $50; add-ons $15 in every sale, $20 otherwise', () => {
  assert.equal(getStandardPrice(et('2027-01-20T12:00:00-05:00')).effective, 30);
  assert.equal(getStandardPrice(et('2027-08-15T12:00:00-04:00')).effective, 50);
  for (const s of SALES) assert.equal(getAddonPoolPrice(et(s.starts)).effective, 15, s.id);
  assert.deepEqual(getAddonPoolPrice(et('2026-12-15T12:00:00-05:00')), { list: ADDON_LIST, sale: null, effective: ADDON_LIST, onSale: false, saleLabel: null });
});

test('NEXT_PUBLIC_SALE=off cancels a running sale; a sale id forces it on', () => {
  const thanksgiving = et('2026-11-27T12:00:00-05:00');
  process.env.NEXT_PUBLIC_SALE = 'off';
  assert.equal(getStandardPrice(thanksgiving).effective, STANDARD_LIST);
  process.env.NEXT_PUBLIC_SALE = 'playoffs';
  assert.equal(getStandardPrice(et('2026-12-15T12:00:00-05:00')).effective, 30);
  process.env.NEXT_PUBLIC_SALE = 'true'; // legacy value: follow the calendar
  assert.equal(getStandardPrice(thanksgiving).effective, 40);
});

test('checkout uses the running sale\'s price id and refuses when it is not configured', () => {
  const thanksgiving = et('2026-11-27T12:00:00-05:00');
  process.env.STRIPE_PRICE_STANDARD = 'price_regular';
  assert.equal(getCheckoutPrice('standard', thanksgiving), null, 'no fallback to the regular price during a sale');
  process.env.STRIPE_PRICE_STANDARD_SALE_THANKSGIVING = 'price_tg';
  assert.deepEqual(getCheckoutPrice('standard', thanksgiving), { priceId: 'price_tg', amountCents: 4000, saleId: 'thanksgiving' });
  assert.deepEqual(getCheckoutPrice('standard', et('2026-12-15T12:00:00-05:00')), { priceId: 'price_regular', amountCents: 6000, saleId: null });
});

test('a Stripe price that differs from the page is refused', () => {
  const expected = { priceId: 'price_tg', amountCents: 4000, saleId: 'thanksgiving' as const };
  const ok = { active: true, type: 'one_time', currency: 'usd', unit_amount: 4000 };
  assert.equal(checkoutPriceMismatch(ok, expected), null);
  assert.match(checkoutPriceMismatch({ ...ok, unit_amount: 3000 }, expected)!, /3000 cents/);
  assert.match(checkoutPriceMismatch({ ...ok, active: false }, expected)!, /archived/);
  assert.match(checkoutPriceMismatch({ ...ok, type: 'recurring' }, expected)!, /recurring/);
  assert.match(checkoutPriceMismatch({ ...ok, currency: 'cad' }, expected)!, /cad/);
});
