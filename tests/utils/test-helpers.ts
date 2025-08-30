import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for a specific element to be visible
   */
  async waitForElement(selector: string, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Fill a form field
   */
  async fillField(selector: string, value: string) {
    await this.page.fill(selector, value);
  }

  /**
   * Click an element
   */
  async clickElement(selector: string) {
    await this.page.click(selector);
  }

  /**
   * Select an option from a dropdown
   */
  async selectOption(selector: string, value: string) {
    await this.page.selectOption(selector, value);
  }

  /**
   * Check if an element contains text
   */
  async expectElementContainsText(selector: string, text: string) {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  /**
   * Check if an element is visible
   */
  async expectElementVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  /**
   * Check if an element is not visible
   */
  async expectElementNotVisible(selector: string) {
    await expect(this.page.locator(selector)).not.toBeVisible();
  }

  /**
   * Get text content of an element
   */
  async getElementText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation() {
    await this.page.waitForURL('**');
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  /**
   * Check if URL contains expected path
   */
  async expectURLContains(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Wait for a specific API response
   */
  async waitForAPIResponse(urlPattern: string) {
    await this.page.waitForResponse(response => 
      response.url().includes(urlPattern) && response.status() === 200
    );
  }

  /**
   * Mock API responses for testing
   */
  async mockAPIResponse(urlPattern: string, responseData: any) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });
  }

  /**
   * Wait for toast notification to appear
   */
  async waitForToast(type: 'success' | 'error', timeout = 5000) {
    const selector = type === 'success' ? '.success-toast, .toast-success, [role="status"]' : '.error-toast, .toast-error, [role="alert"]';
    await this.waitForElement(selector, timeout);
  }

  /**
   * Check if modal/dialog is open
   */
  async expectModalOpen(title?: string) {
    if (title) {
      await this.expectElementVisible(`[role="dialog"] h2:has-text("${title}")`);
    } else {
      await this.expectElementVisible('[role="dialog"]');
    }
  }

  /**
   * Check if alert dialog is open
   */
  async expectAlertDialogOpen(title?: string) {
    if (title) {
      await this.expectElementVisible(`[role="alertdialog"] h2:has-text("${title}")`);
    } else {
      await this.expectElementVisible('[role="alertdialog"]');
    }
  }
}

/**
 * Common test data for the NFL pool application
 */
export const testData = {
  users: {
    admin: {
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Test Admin'
    },
    participant: {
      email: 'participant@test.com',
      password: 'participant123',
      name: 'Test Participant'
    },
    superAdmin: {
      email: 'superadmin@test.com',
      password: 'super123',
      name: 'Test Super Admin'
    }
  },
  pools: {
    testPool: {
      name: 'Test Pool 2025',
      description: 'A test pool for end-to-end testing'
    }
  }
};

/**
 * Common selectors used across tests
 */
export const selectors = {
  // Auth
  loginForm: '[data-testid="login-form"]',
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  loginButton: '[data-testid="login-button"]',
  
  // Navigation
  navMenu: '[data-testid="nav-menu"]',
  poolLink: '[data-testid="pool-link"]',
  
  // Pool
  poolName: '[data-testid="pool-name"]',
  poolDescription: '[data-testid="pool-description"]',
  
  // Picks
  pickForm: '[data-testid="pick-form"]',
  pickButton: '[data-testid="pick-button"]',
  
  // Leaderboard
  leaderboard: '[data-testid="leaderboard"]',
  leaderboardRow: '[data-testid="leaderboard-row"]',
  
  // Admin
  adminPanel: '[data-testid="admin-panel"]',
  adminActions: '[data-testid="admin-actions"]',
  
  // Commissioners Management
  commissionersList: '.commissioners-list, .commissioners-table',
  commissionerCard: '.commissioner-card, .commissioner-row',
  commissionerName: '.commissioner-name, .name',
  commissionerEmail: '.commissioner-email, .email',
  commissionerStatus: '.commissioner-status, .status',
  
  // Quick Actions
  quickActions: '.quick-actions, .action-cards',
  
  // Toast Messages
  successToast: '.success-toast, .toast-success, [role="status"]',
  errorToast: '.error-toast, .toast-error, [role="alert"]',
  
  // Sync History
  syncHistory: '.sync-history, .history-section'
};
