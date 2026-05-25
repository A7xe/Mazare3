import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root `.env` only. */
const rootEnv = resolve(here, '../../../.env');

if (existsSync(rootEnv)) {
  config({ path: rootEnv, override: false });
}

if (!process.env.DATABASE_URL) {
  console.error(
    '\n❌ DATABASE_URL not found.\n' +
      '   Add it to the project root `.env` (copy from `.env.example` at repo root)\n' +
      '   Example: DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require\n',
  );
  process.exit(1);
}
