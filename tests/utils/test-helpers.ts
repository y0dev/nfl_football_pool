import { Page, expect } from '@playwright/test';

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
}

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
  },
  pools: {
    openPool: {
      id: 'test-pool-open-id',
      name: 'Sunday Huddle Test Pool',
      season: 2025,
      participant_count: 12,
      requires_password: false,
    },
    lockedPool: {
      id: 'test-pool-locked-id',
      name: 'Private Invite Pool',
      season: 2025,
      participant_count: 6,
      requires_password: true,
    },
  },
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
  magicLinkBtn: 'button:has-text("Magic Link"), button:has-text("Send Magic Link"), button:has-text("magic")',
  notificationBell: 'button:has([data-lucide="bell"]), button svg[class*="bell"]',
};
