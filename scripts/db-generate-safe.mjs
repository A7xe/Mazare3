/**
 * Safe Prisma client generate (Windows EPERM guard).
 *
 * Usage:
 *   pnpm db:generate:safe          # check locks, then generate if safe
 *   pnpm db:generate:safe --check  # report only, no generate
 *
 * Does NOT kill Node processes automatically. Stop `pnpm dev` manually first if prompted.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_PATH = path.join(
  ROOT,
  'packages',
  'db',
  'generated',
  'client',
  'query_engine-windows.dll.node',
);

const DEV_PORTS = [
  { port: 3000, label: 'Next.js dev (default)' },
  { port: 3010, label: 'Playwright web' },
  { port: 4000, label: 'API dev (default)' },
  { port: 4010, label: 'Playwright API' },
  { port: 4012, label: 'QA API (pnpm qa:api)' },
];

const checkOnly = process.argv.includes('--check');

function listListenersWin(port) {
  const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true });
  if (out.status !== 0) return [];
  const pids = new Set();
  for (const line of out.stdout.split('\n')) {
    if (!line.includes('LISTENING') || !line.includes(`:${port}`)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  return [...pids];
}

function listListenersUnix(port) {
  const out = spawnSync('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

function activeDevListeners() {
  const found = [];
  for (const { port, label } of DEV_PORTS) {
    const pids =
      process.platform === 'win32' ? listListenersWin(port) : listListenersUnix(port);
    if (pids.length) found.push({ port, label, pids });
  }
  return found;
}

/** True if query engine DLL appears locked (Windows). */
function engineLooksLocked() {
  if (process.platform !== 'win32' || !fs.existsSync(ENGINE_PATH)) return false;
  const probe = `${ENGINE_PATH}.generate-probe`;
  try {
    fs.renameSync(ENGINE_PATH, probe);
    fs.renameSync(probe, ENGINE_PATH);
    return false;
  } catch {
    return true;
  }
}

function printGuidance(listeners, locked) {
  console.log('\n📋 Prisma generate — preflight\n');
  if (listeners.length) {
    console.log('⚠️  Dev servers may be running (ports in use):');
    for (const { port, label, pids } of listeners) {
      console.log(`   • :${port} — ${label} — PID(s): ${pids.join(', ')}`);
    }
    console.log('\n   Stop them before generate (Ctrl+C in the terminal running `pnpm dev` / Playwright).');
    console.log('   On Windows you can also close Prisma Studio and any Node debugger.\n');
  } else {
    console.log('✅ No Mazare3 dev ports in LISTEN state.\n');
  }
  if (locked) {
    console.log('⚠️  query_engine-windows.dll.node appears LOCKED (typical EPERM cause).');
    console.log(`   Path: ${ENGINE_PATH}\n`);
  } else if (process.platform === 'win32') {
    console.log('✅ Query engine file is not locked.\n');
  }
}

function runGenerate() {
  console.log('▶ Running: pnpm --filter @mazare3/db generate\n');
  const result = spawnSync('pnpm', ['--filter', '@mazare3/db', 'generate'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error('\n❌ prisma generate failed.');
    if (process.platform === 'win32') {
      console.error(
        '   If you see EPERM on rename query_engine-windows.dll.node, stop all Node processes and retry.\n',
      );
    }
    process.exit(result.status ?? 1);
  }
  console.log('\n✅ Prisma client generated successfully.\n');
}

const listeners = activeDevListeners();
const locked = engineLooksLocked();
printGuidance(listeners, locked);

if (checkOnly) {
  process.exit(listeners.length || locked ? 1 : 0);
}

if (listeners.length || locked) {
  console.error('❌ Aborting generate — resolve the items above, then run `pnpm db:generate:safe` again.');
  console.error('   To inspect only: `pnpm db:generate:safe --check`\n');
  process.exit(1);
}

runGenerate();
