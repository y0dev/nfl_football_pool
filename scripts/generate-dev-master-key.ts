import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Generates (or rotates) DEV_MASTER_KEY for the development-only Super
// Admin password reset tool (src/app/api/admin/dev-reset-password/route.ts,
// the "Development Tools" card on src/app/admin/account/page.tsx). Writes
// directly to .env.local — server-only, never NEXT_PUBLIC_ — alongside a
// DEV_MASTER_KEY_ROTATED_AT timestamp that the account page and the reset
// endpoint both use to warn when the key is stale (see
// src/app/api/admin/dev-key-status/route.ts).

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const KEY_VAR = 'DEV_MASTER_KEY';
const ROTATED_VAR = 'DEV_MASTER_KEY_ROTATED_AT';

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const needsNewline = content.length > 0 && !content.endsWith('\n');
  return `${content}${needsNewline ? '\n' : ''}${line}\n`;
}

function main() {
  const newKey = crypto.randomBytes(32).toString('hex');
  const rotatedAt = new Date().toISOString();

  let content = '';
  let creatingFile = false;
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } else {
    creatingFile = true;
  }

  const hadExisting = new RegExp(`^${KEY_VAR}=`, 'm').test(content);

  content = upsertEnvVar(content, KEY_VAR, newKey);
  content = upsertEnvVar(content, ROTATED_VAR, rotatedAt);

  fs.writeFileSync(ENV_PATH, content);

  console.log(creatingFile
    ? `Created .env.local with ${KEY_VAR} — you still need the rest of the vars from env.example (Supabase, etc).`
    : hadExisting
      ? `Rotated ${KEY_VAR} in .env.local.`
      : `Added ${KEY_VAR} to .env.local.`);
  console.log(`New key: ${newKey}`);
  console.log('Restart your dev server for the new value to take effect.');
  console.log("This key only works while NODE_ENV=development — it's rejected in production regardless of the value.");
}

main();
