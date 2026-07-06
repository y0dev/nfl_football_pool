// Shared email validation for every path that creates an account or
// participant. Format is enforced everywhere; reserved/test domains are
// blocked only in production so the E2E suite can keep using @test.com
// and @example.com fixtures in development.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Reserved by RFC 2606/6761 or obviously fake — matched against every label
// of the domain, so this catches user@test, user@test.com, user@example.org,
// user@mail.example.co, etc.
const RESERVED_LABELS = new Set(['test', 'example', 'invalid', 'localhost', 'fake', 'sample']);

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(raw: unknown): EmailValidationResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, error: 'Email is required.' };
  }

  const email = raw.trim().toLowerCase();

  // Bare domains like user@test fail here too (no dot / TLD)
  if (!EMAIL_FORMAT.test(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  if (process.env.NODE_ENV === 'production') {
    const domainLabels = email.split('@')[1].split('.');
    if (domainLabels.some(label => RESERVED_LABELS.has(label))) {
      return { valid: false, error: 'Test email addresses are not allowed.' };
    }
  }

  return { valid: true };
}
