// Runs once after the entire e2e suite finishes (see globalTeardown in
// playwright.config.ts) — a safety net that sweeps up any pool/commissioner/
// huddle a spec's own try/finally failed to clean up (e.g. because the spec
// crashed before reaching its finally block). Individual specs cleaning up
// after themselves stays the primary mechanism; this just catches the leaks.
import { cleanupE2eTestData } from './cleanup-e2e-data';

async function globalTeardown() {
  await cleanupE2eTestData();
}

export default globalTeardown;
