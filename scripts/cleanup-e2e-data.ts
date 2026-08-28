// Manual one-off runner for the e2e cleanup sweep (`npm run cleanup-e2e-data`).
// The actual logic lives in tests/setup/cleanup-e2e-data.ts, which is also
// used as Playwright's globalTeardown (see playwright.config.ts) — kept as a
// plain top-level-await-free export with no self-run guard there on purpose,
// since Playwright's own config loader can't handle import.meta in a file it
// imports (unlike tsx, which runs this file directly and handles it fine).
import { cleanupE2eTestData } from '../tests/setup/cleanup-e2e-data';

cleanupE2eTestData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ e2e test data cleanup failed:', error);
    process.exit(1);
  });
