/**
 * Ephemeral API runner for qa-deposit-api.mjs
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const QA_PORT = process.env.QA_API_PORT ?? '4028';
const QA_BASE = `http://localhost:${QA_PORT}/api/v1`;
const USE_SHELL = process.platform === 'win32';

async function waitHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${QA_BASE}/health`)).ok) return true;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function tryFreeListenPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const pid = line.trim().split(/\s+/).at(-1);
        if (pid && /^\d+$/.test(pid)) execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      }
    }
  } catch {
    /* free */
  }
}

async function main() {
  tryFreeListenPort(QA_PORT);
  await new Promise((r) => setTimeout(r, 500));
  const server = spawn('pnpm', ['exec', 'dotenv', '-e', '../../.env', '--', 'tsx', 'src/index.ts'], {
    cwd: API_DIR,
    shell: USE_SHELL,
    env: {
      ...process.env,
      API_PORT: QA_PORT,
      DISABLE_AUTH_RATE_LIMIT: 'true',
      ENABLE_INTERNAL_QA_ROUTES: 'true',
      APP_ENV: 'local',
      PAYMENT_SIMULATE_ENABLED: 'true',
      PRISMA_DISABLE_QUERY_LOG: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverExited = false;
  server.on('exit', () => {
    serverExited = true;
  });
  server.stdout?.on('data', (c) => process.stdout.write(`[qa-api] ${c}`));
  server.stderr?.on('data', (c) => process.stderr.write(`[qa-api] ${c}`));
  const killServer = () => {
    if (!serverExited && server.pid) {
      try {
        if (process.platform === 'win32') execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
        else server.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  };
  try {
    if (!(await waitHealth())) {
      console.error('QA API did not become healthy');
      process.exit(1);
    }
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts/qa-deposit-api.mjs')], {
        cwd: ROOT,
        env: { ...process.env, API_BASE: QA_BASE },
        stdio: 'inherit',
      });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
    console.log('\n✅ Deposit API QA passed\n');
  } catch (e) {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  } finally {
    killServer();
  }
}

main();
