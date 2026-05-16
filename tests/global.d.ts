// Global type extensions for Playwright test environment

interface Window {
  mockPoolData?: {
    id: string;
    name: string;
    description?: string;
    is_test_mode?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
}
