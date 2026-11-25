// Sale calendar: the page and checkout take prices from the same dates, and
// checkout charges exactly the amount the page shows (Stripe price_data).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SALES, getActiveSale, getStandardPrice, getAddonPoolPrice, STANDARD_LIST, ADDON_LIST } from '../../src/lib/pricing';
import { getCheckoutPrice, getStripeProductId } from '../../src/lib/stripe';

const ENV_KEYS = ['NEXT_PUBLIC_SALE', 'STRIPE_PRODUCT_STANDARD', 'STRIPE_PRICE_STANDARD'];
// Every test starts from no sale override and no configured Stripe ids.
const clearEnv = () => { for (const k of ENV_KEYS) delete process.env[k]; };
clearEnv();
afterEach(clearEnv);

const et = (iso: string) => new Date(iso);

test('sales never overlap and each ends after it starts', () => {
  const spans = SALES.map(s => [Date.parse(s.starts), Date.parse(s.ends), s.id] as const).sort((a, b) => a[0] - b[0]);
  for (const [start, end, id] of spans) assert.ok(start < end, `${id} ends after it starts`);
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i - 1][1] <= spans[i][0], `${spans[i - 1][2]} overlaps ${spans[i][2]}`);
});

test('Thanksgiving: $40 from midnight Eastern on Thanksgiving through Cyber Monday', () => {
  assert.equal(getActiveSale(et('2026-11-25T23:59:59-05:00')), null);
  const start = getStandardPrice(et('2026-11-26T00:00:00-05:00'));
  assert.deepEqual(start, { list: STANDARD_LIST, sale: 40, effective: 40, onSale: true, saleLabel: 'Thanksgiving Sale' });
  assert.equal(getStandardPrice(et('2026-11-30T23:59:59-05:00')).saleLabel, 'Thanksgiving Sale');
});

test('the price never returns to $60 between Thanksgiving and the end of the season', () => {
  // Every hour from Thanksgiving to the Feb 14 rollover is in some sale.
  for (let t = Date.parse('2026-11-26T00:00:00-05:00'); t < Date.parse('2027-02-14T00:00:00-05:00'); t += 3_600_000) {
    assert.ok(getActiveSale(new Date(t)), `no sale at ${new Date(t).toISOString()}`);
  }
  assert.deepEqual(getStandardPrice(et('2026-12-15T12:00:00-05:00')), { list: STANDARD_LIST, sale: 40, effective: 40, onSale: true, saleLabel: 'Rest of Season' });
  assert.equal(getStandardPrice(et('2027-01-10T23:59:59-05:00')).effective, 40);
  assert.equal(getStandardPrice(et('2027-01-11T00:00:00-05:00')).effective, 30);
  assert.equal(getStandardPrice(et('2027-02-14T00:00:00-05:00')).effective, STANDARD_LIST, 'new season: full price');
});

test('preseason $50; add-ons $15 in every sale, $20 otherwise', () => {
  assert.equal(getStandardPrice(et('2027-08-15T12:00:00-04:00')).effective, 50);
  for (const s of SALES) assert.equal(getAddonPoolPrice(et(s.starts)).effective, 15, s.id);
  assert.deepEqual(getAddonPoolPrice(et('2027-03-15T12:00:00-04:00')), { list: ADDON_LIST, sale: null, effective: ADDON_LIST, onSale: false, saleLabel: null });
});

test('NEXT_PUBLIC_SALE=off cancels a running sale; a sale id forces it on', () => {
  const thanksgiving = et('2026-11-27T12:00:00-05:00');
  process.env.NEXT_PUBLIC_SALE = 'off';
  assert.equal(getStandardPrice(thanksgiving).effective, STANDARD_LIST);
  process.env.NEXT_PUBLIC_SALE = 'playoffs';
  assert.equal(getStandardPrice(et('2027-03-15T12:00:00-04:00')).effective, 30);
  process.env.NEXT_PUBLIC_SALE = 'true'; // legacy value: follow the calendar
  assert.equal(getStandardPrice(thanksgiving).effective, 40);
});

test('checkout charges the amount the page shows at that moment', () => {
  assert.deepEqual(getCheckoutPrice('standard', et('2026-11-27T12:00:00-05:00')), { amountCents: 4000, saleId: 'thanksgiving' });
  assert.deepEqual(getCheckoutPrice('standard', et('2027-01-20T12:00:00-05:00')), { amountCents: 3000, saleId: 'playoffs' });
  assert.deepEqual(getCheckoutPrice('addon_pool', et('2026-12-15T12:00:00-05:00')), { amountCents: 1500, saleId: 'rest_of_season' });
  assert.deepEqual(getCheckoutPrice('standard', et('2027-03-15T12:00:00-04:00')), { amountCents: 6000, saleId: null });
  for (const s of SALES) {
    const t = et(s.starts);
    assert.equal(getCheckoutPrice('standard', t).amountCents, getStandardPrice(t).effective * 100, s.id);
    assert.equal(getCheckoutPrice('addon_pool', t).amountCents, getAddonPoolPrice(t).effective * 100, s.id);
  }
});

test('the Stripe product comes from STRIPE_PRODUCT_* without calling Stripe', async () => {
  assert.equal(await getStripeProductId('standard'), null, 'nothing configured');
  process.env.STRIPE_PRODUCT_STANDARD = 'prod_standard';
  assert.equal(await getStripeProductId('standard'), 'prod_standard');
});
