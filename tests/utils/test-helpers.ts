import { Page, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// TestHelpers
// ─────────────────────────────────────────────────────────────

export class TestHelpers {
  constructor(private page: Page) {}

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(selector: string, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  async fillField(selector: string, value: string) {
    await this.page.fill(selector, value);
  }

  async clickElement(selector: string) {
    await this.page.click(selector);
  }

  async expectElementContainsText(selector: string, text: string) {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async expectElementVisible(selector: string) {
    await expect(this.page.locator(selector).first()).toBeVisible();
  }

  async expectElementNotVisible(selector: string) {
    await expect(this.page.locator(selector)).not.toBeVisible();
  }

  async getElementText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  async waitForNavigation() {
    await this.page.waitForURL('**');
  }

  async expectURLContains(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  async waitForAPIResponse(urlPattern: string) {
    await this.page.waitForResponse(response =>
      response.url().includes(urlPattern) && response.status() === 200
    );
  }

  async mockAPIResponse(urlPattern: string, responseData: unknown, status = 200) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    });
  }

  async waitForToast(timeout = 5000) {
    await this.waitForElement('[role="status"], [data-sonner-toast]', timeout);
  }

  /** Mock the pool-by-id API used by the picks page */
  async mockPoolByIdAPI(poolId: string, poolData: Record<string, unknown>) {
    await this.page.route(`**/api/pools/${poolId}**`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, pool: poolData }),
      });
    });
  }

  /** Mock an admin API returning a 401 (used to simulate auth guard triggers) */
  async mockAdminUnauthorized(pattern: string) {
    await this.page.route(pattern, route => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    });
  }

  /** Intercept a request and capture the JSON body it sends */
  async captureRequestBody(urlPattern: string): Promise<unknown> {
    return new Promise(resolve => {
      this.page.route(urlPattern, async route => {
        const body = route.request().postDataJSON();
        await route.continue();
        resolve(body);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────

export const testData = {
  users: {
    commissioner: {
      email: 'commissioner@test.com',
      name: 'Test Commissioner',
    },
    superAdmin: {
      email: 'superadmin@test.com',
      name: 'Test Super Admin',
    },
    // Kept for backward compatibility with existing specs
    participant: {
      email: 'participant@test.com',
      password: 'testpassword',
      name: 'Test Participant',
    },
    admin: {
      email: 'admin@test.com',
      password: 'adminpassword',
      name: 'Test Admin',
    },
  },
  pools: {
    openPool: {
      id: 'test-pool-open-id',
      name: 'Sunday Huddle Test Pool',
      season: 2025,
      participant_count: 12,
      requires_password: false,
      is_closed: false,
    },
    lockedPool: {
      id: 'test-pool-locked-id',
      name: 'Private Invite Pool',
      season: 2025,
      participant_count: 6,
      requires_password: true,
      is_closed: false,
    },
    closedPool: {
      id: 'test-pool-closed-id',
      name: 'Closed Season Pool',
      season: 2024,
      participant_count: 20,
      requires_password: false,
      is_closed: true,
    },
    closedLockedPool: {
      id: 'test-pool-closed-locked-id',
      name: 'Old Private Pool',
      season: 2024,
      participant_count: 8,
      requires_password: true,
      is_closed: true,
    },
  },
  poolDetail: {
    regularOnly: {
      id: 'pool-regular-id',
      name: 'Regular Season Pool',
      season: 2025,
      season_scope: [2],
      is_active: true,
      tie_breaker_method: 'total_score',
      tie_breaker_question: 'What will be the total score?',
      tie_breaker_answer: null,
      participant_count: 8,
      is_test_mode: false,
      picks_status: null,
    },
    preseasonAndRegular: {
      id: 'pool-preseason-regular-id',
      name: 'Full Season Pool',
      season: 2025,
      season_scope: [1, 2],
      is_active: true,
      tie_breaker_method: 'total_score',
      tie_breaker_question: 'What will be the total score?',
      tie_breaker_answer: null,
      participant_count: 10,
      is_test_mode: false,
      picks_status: null,
    },
  },
  adminPools: [
    {
      id: 'admin-pool-1',
      name: 'Active Pool Alpha',
      is_active: true,
      season: 2025,
      created_by: 'commissioner@test.com',
      created_at: '2025-01-01T00:00:00Z',
      participants: [{ count: 15 }],
    },
    {
      id: 'admin-pool-2',
      name: 'Inactive Pool Beta',
      is_active: false,
      season: 2024,
      created_by: 'commissioner@test.com',
      created_at: '2024-01-01T00:00:00Z',
      participants: [{ count: 10 }],
    },
  ],
  commissioners: [
    {
      id: 'comm-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'COMMISSIONER',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'comm-2',
      name: 'Bob Jones',
      email: 'bob@example.com',
      role: 'COMMISSIONER',
      isActive: false,
      createdAt: '2025-02-01T00:00:00Z',
    },
  ],
};

export const selectors = {
  nav: 'nav',
  brandText: 'nav span',
  commissionerLoginBtn: 'button:has-text("Commissioner")',
  searchInput: '[data-testid="pool-search-input"]',
  poolCard: '[data-testid="pool-card"]',
  joinForm: '[data-testid="join-form"]',
  joinName: '[data-testid="join-name"]',
  joinEmail: '[data-testid="join-email"]',
  joinPassword: '[data-testid="join-password"]',
  joinSubmit: '[data-testid="join-submit"]',
  joinSuccess: '[data-testid="join-success"]',
  loginEmailInput: 'input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i]',
  loginPasswordInput: 'input[type="password"], input[name="password"]',
  magicLinkBtn: 'button:has-text("Magic Link"), button:has-text("Send Magic Link"), button:has-text("magic")',
  notificationBell: 'button:has([data-lucide="bell"]), button svg[class*="bell"]',
  passwordToggle: 'button[aria-label*="password"], button:has(svg[data-lucide="eye"]), button:has(svg[data-lucide="eye-off"])',
};
