import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repository root `.env` — single source of truth for local development. */
const rootEnv = resolve(__dirname, '../../../.env');

if (existsSync(rootEnv)) {
  config({ path: rootEnv, override: false });
}

// Fallback when process cwd is repo root (e.g. some tooling)
const cwdRootEnv = resolve(process.cwd(), '.env');
if (cwdRootEnv !== rootEnv && existsSync(cwdRootEnv)) {
  config({ path: cwdRootEnv, override: false });
}
