/**
 * Legal / eligibility constants surfaced in the Terms of Service (`/terms`)
 * and Privacy Policy (`/privacy`). Kept in one place so the age shown on
 * both pages can never drift apart, and so a policy change is a one-line edit.
 */

/** Hard minimum age to create an account or use the Service at all. */
export const MINIMUM_AGE = 18;

/**
 * COPPA-style threshold for the separate "the Service is not directed to,
 * and we do not knowingly collect information from, children under X" clause.
 * This is distinct from (and lower than) MINIMUM_AGE.
 */
export const CHILDRENS_PRIVACY_AGE = 13;
