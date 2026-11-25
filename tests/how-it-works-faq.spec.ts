import { test, expect } from '@playwright/test';
import { getStandardPrice } from '../src/lib/pricing';

test.describe('How It Works & FAQ pages', () => {
  test('how-it-works page loads and links to FAQ', async ({ page }) => {
    await page.goto('/how-it-works');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'How It Works', exact: true })).toBeVisible();
    await expect(page.getByText('Playoff Pools Work Differently')).toBeVisible();

    await page.getByRole('link', { name: /View FAQ/i }).click();
    await expect(page).toHaveURL(/\/faq$/);
  });

  test('faq page loads, accordion toggles, and links back to How It Works', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'FAQ', exact: true })).toBeVisible();

    const question = page.getByRole('button', { name: 'How many confidence points do I get each week?' });
    await expect(question).toBeVisible();

    const answer = page.getByText('Each value can only be used once', { exact: false });
    await expect(answer).not.toBeVisible();
    await question.click();
    await expect(answer).toBeVisible();

    await page.getByRole('link', { name: 'Read How It Works' }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
  });

  test('landing page nav links to How It Works and FAQ', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav').getByRole('link', { name: 'How It Works' }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
  });
});

test.describe('Pricing page', () => {
  test('loads plan cards and links to signup', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Run Your Season/i })).toBeVisible();
    // Add-ons are a cost band below the two plans, not a third plan card
    await expect(page.getByText('Add-Ons', { exact: true })).toBeVisible();
    await expect(page.getByText('Extra Pools', { exact: true })).toBeVisible();
    await expect(page.getByText('Most popular')).toHaveCount(0);

    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('standard plan shows sale comparison when a sale is running', async ({ page }) => {
    // Same calendar and NEXT_PUBLIC_SALE override the page uses (src/lib/pricing.ts)
    const { config } = await import('dotenv');
    config({ path: '.env.local' });
    const price = getStandardPrice();

    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    if (price.onSale) {
      // Struck-through list price, the sale price and the sale's badge
      await expect(page.getByLabel(`Regular price $${price.list}`).first()).toBeVisible();
      await expect(page.getByText(`$${price.effective}`, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(price.saleLabel!, { exact: true }).first()).toBeVisible();
    } else {
      await expect(page.getByText(`$${price.list}`, { exact: true }).first()).toBeVisible();
    }
  });

  test('is reachable from the landing page nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav').getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing$/);
  });
});

test.describe('404 page', () => {
  test('shows on-brand not-found page and links home', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Incomplete Pass' })).toBeVisible();
    await expect(page.getByText('Looking for a pool?')).toBeVisible();

    await page.getByRole('button', { name: 'Go Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
