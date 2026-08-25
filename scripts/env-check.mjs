#!/usr/bin/env node
/**
 * Compare root `.env` keys with `.env.example`.
 * Prints key names only — never variable values.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

const FORBIDDEN_NEXT_PUBLIC = [
  'NEXT_PUBLIC_DATABASE_URL',
  'NEXT_PUBLIC_JWT_SECRET',
  'NEXT_PUBLIC_SESSION_SECRET',
  'NEXT_PUBLIC_CLIQ_API_KEY',
  'NEXT_PUBLIC_CLIQ_WEBHOOK_SECRET',
  'NEXT_PUBLIC_CARD_GATEWAY_API_KEY',
  'NEXT_PUBLIC_CARD_GATEWAY_WEBHOOK_SECRET',
];

function parseEnvKeys(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const keys = new Set();
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key) keys.add(key);
  }
  return keys;
}

function main() {
  let exitCode = 0;

  if (!existsSync(examplePath)) {
    console.error('❌ Missing .env.example at repository root');
    process.exit(1);
  }

  if (!existsSync(envPath)) {
    console.error('❌ Missing .env at repository root');
    console.error('   Copy: cp .env.example .env');
    process.exit(1);
  }

  const exampleKeys = parseEnvKeys(examplePath);
  const envKeys = parseEnvKeys(envPath);

  const missing = [...exampleKeys].filter((k) => !envKeys.has(k)).sort();
  const extra = [...envKeys].filter((k) => !exampleKeys.has(k)).sort();

  console.log('\n🔍 env:check — key names only (no values printed)\n');

  if (missing.length === 0) {
    console.log('✅ No missing keys (every .env.example key exists in .env)');
  } else {
    exitCode = 1;
    console.log(`⚠️  Missing in .env (${missing.length}):`);
    for (const k of missing) console.log(`   - ${k}`);
  }

  if (extra.length === 0) {
    console.log('✅ No extra keys in .env (beyond .env.example)');
  } else {
    console.log(`ℹ️  Extra in .env only (${extra.length}) — review if still needed:`);
    for (const k of extra) console.log(`   - ${k}`);
  }

  const forbiddenPresent = FORBIDDEN_NEXT_PUBLIC.filter((k) => envKeys.has(k));
  if (forbiddenPresent.length > 0) {
    exitCode = 1;
    console.log('\n❌ Forbidden public env keys (secrets must not use NEXT_PUBLIC_):');
    for (const k of forbiddenPresent) console.log(`   - ${k}`);
  } else {
    console.log('\n✅ No forbidden NEXT_PUBLIC_* secret keys');
  }

  console.log('');
  if (exitCode !== 0) {
    console.log('Fix missing keys: add them to .env (see .env.example). Values are not shown here.\n');
    process.exit(exitCode);
  }
  console.log('All .env.example keys are present in .env.\n');
}

main();
