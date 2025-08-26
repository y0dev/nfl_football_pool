# NFL Football Pool - Test Suite

This directory contains comprehensive end-to-end tests for the NFL Football Pool application using Playwright.

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests covering full user flows
│   └── nfl-pool-flow.spec.ts
├── components/             # Component-specific tests
│   └── pool-settings.spec.ts
├── setup/                  # Test setup and utilities
│   ├── global-setup.ts
│   └── test-data-setup.ts
├── utils/                  # Test helper utilities
│   └── test-helpers.ts
└── README.md              # This file
```

## Prerequisites

1. **Install Playwright**: `npm install --save-dev @playwright/test`
2. **Install Browsers**: `npx playwright install`
3. **Start Development Server**: `npm run dev`

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
npx playwright test tests/e2e/nfl-pool-flow.spec.ts
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests in Mobile Viewport
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Run Tests in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Run Tests in Debug Mode
```bash
npx playwright test --debug
```

### Run Tests with Trace Recording
```bash
npx playwright test --trace=on
```

## Test Commands

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report",
    "test:install": "playwright install"
  }
}
```

## Test Data

The test suite uses mock data defined in `test-data-setup.ts`. This includes:

- **Test Users**: Admin, participant, and super admin accounts
- **Test Pools**: Sample pools for testing
- **Test Games**: Mock NFL games for different weeks
- **Test Picks**: Sample user picks for testing

## Test Helpers

The `TestHelpers` class provides common testing utilities:

- **Element Interactions**: Click, fill, select, etc.
- **Assertions**: Visibility, text content, URL checks
- **Navigation**: Wait for page loads, navigation completion
- **Screenshots**: Capture screenshots for debugging
- **API Mocking**: Mock API responses for testing

## Writing Tests

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Feature Name', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForPageLoad();
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await helpers.expectElementVisible('[data-testid="element"]');
  });
});
```

### Using Test Data
```typescript
import { test } from './setup/test-data-setup';

test('should work with test data', async ({ page, testData }) => {
  // Access test data
  const adminUser = testData.users.admin;
  
  // Use in test
  await page.fill('input[name="email"]', adminUser.email);
});
```

### Using Authenticated Contexts
```typescript
test('should work as admin', async ({ adminPage }) => {
  // adminPage is already logged in as admin
  await adminPage.goto('/admin/dashboard');
  await expect(adminPage.locator('[data-testid="admin-panel"]')).toBeVisible();
});
```

## Data Test IDs

To make tests more reliable, add `data-testid` attributes to your components:

```tsx
<input 
  data-testid="pool-name-input"
  name="name" 
  value={pool.name} 
/>
```

## Screenshots and Videos

- **Screenshots**: Automatically captured on test failure
- **Videos**: Recorded for failed tests
- **Traces**: Can be enabled for debugging

## CI/CD Integration

The test suite is configured to work in CI environments:

- **Retries**: Tests retry twice on CI
- **Parallel Execution**: Disabled on CI for stability
- **Headless Mode**: Default for CI environments

## Debugging Tests

### View Test Report
```bash
npx playwright show-report
```

### Debug Failed Tests
```bash
npx playwright test --debug tests/e2e/nfl-pool-flow.spec.ts
```

### Open Playwright UI
```bash
npx playwright test --ui
```

### View Traces
```bash
npx playwright show-trace trace.zip
```

## Best Practices

1. **Use data-testid**: Prefer `data-testid` over CSS selectors
2. **Wait for Elements**: Always wait for elements to be visible before interacting
3. **Test User Flows**: Focus on testing complete user journeys
4. **Mock External APIs**: Use API mocking for predictable test data
5. **Clean Test Data**: Reset test data between tests when possible
6. **Accessibility**: Include accessibility tests in your test suite

## Troubleshooting

### Common Issues

1. **Tests Fail on CI**: Check if development server is running
2. **Element Not Found**: Verify `data-testid` attributes are present
3. **Timing Issues**: Use appropriate wait conditions
4. **Browser Issues**: Ensure Playwright browsers are installed

### Getting Help

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Testing Guide](https://playwright.dev/docs/intro)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
