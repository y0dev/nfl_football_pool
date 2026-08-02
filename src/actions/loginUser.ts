'use server';

import { findAccountByEmail } from '@/lib/accounts';
import { setSessionCookie } from '@/actions/sessionCookie';
import { checkRateLimit } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';

const INVALID_CREDENTIALS = 'Invalid email or password.';
const TOO_MANY_ATTEMPTS = 'Too many login attempts. Please wait 15 minutes and try again.';

// 10 attempts per email per 15 minutes
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!checkRateLimit(`login:${normalizedEmail}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
    return { success: false, error: TOO_MANY_ATTEMPTS };
  }

  try {
    // Email could belong to a super-admin (admins) or a commissioner
    // (commissioners) — findAccountByEmail checks both.
    const account = await findAccountByEmail(normalizedEmail, { activeOnly: true });

    if (!account) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const { role, row } = account;

    // Empty hash or OAuth-only accounts cannot use password login
    if (!row.password_hash || row.password_hash === 'google_oauth') {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const isValidPassword = await bcrypt.compare(password, row.password_hash);

    if (!isValidPassword) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    // Set server-side session cookie so middleware can protect routes
    await setSessionCookie(row.id);

    return {
      success: true,
      user: {
        id: row.id,
        email: row.email,
        full_name: row.full_name || '',
        is_super_admin: role === 'super_admin',
      },
    };
  } catch (error) {
    debugError('Login error:', error instanceof Error ? error.message : 'unknown');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
