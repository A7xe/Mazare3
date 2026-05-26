/**
 * Run all API QA scripts against a dedicated API instance (no auth rate limit).
 * Usage: pnpm qa:api
 *
 * Spawns API on QA_API_PORT (default 4012) with:
 *   DISABLE_AUTH_RATE_LIMIT=true
 *   ENABLE_INTERNAL_QA_ROUTES=true
 *
 * Does not affect your normal `pnpm dev` on :4000 (rate limit stays enabled).
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const QA_PORT = process.env.QA_API_PORT ?? '4012';
const QA_BASE = `http://localhost:${QA_PORT}/api/v1`;

const SCRIPTS = [
  'qa-booking-api.mjs',
  'qa-owner-api.mjs',
  'qa-admin-api.mjs',
  'qa-onboarding-api.mjs',
  'qa-payment-api.mjs',
  'qa-operations-api.mjs',
];

const USE_SHELL = process.platform === 'win32';

async function waitHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${QA_BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* server starting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function startQaApiServer() {
  return spawn(
    'pnpm',
    ['exec', 'dotenv', '-e', '../../.env', '--', 'tsx', 'src/index.ts'],
    {
      cwd: API_DIR,
      shell: USE_SHELL,
      env: {
        ...process.env,
        API_PORT: QA_PORT,
        DISABLE_AUTH_RATE_LIMIT: 'true',
        ENABLE_INTERNAL_QA_ROUTES: 'true',
        NODE_ENV: 'development',
        PAYMENT_PROVIDER: 'test',
        PAYMENT_SIMULATE_ENABLED: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

function runScript(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', name)], {
      cwd: ROOT,
      env: { ...process.env, API_BASE: QA_BASE },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
  });
}

function tryFreeListenPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const pid = line.trim().split(/\s+/).at(-1);
        if (pid && /^\d+$/.test(pid)) {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        }
      }
    } else {
      execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: 'ignore', shell: true });
    }
  } catch {
    /* port free */
  }
}

async function main() {
  console.log(`\n🧪 Mazare3 API QA runner → ${QA_BASE}\n`);

  tryFreeListenPort(QA_PORT);
  await new Promise((r) => setTimeout(r, 800));

  const server = startQaApiServer();
  let serverExited = false;
  server.on('exit', () => {
    serverExited = true;
  });

  server.stdout?.on('data', (chunk) => process.stdout.write(`[qa-api] ${chunk}`));
  server.stderr?.on('data', (chunk) => process.stderr.write(`[qa-api] ${chunk}`));

  const killServer = () => {
    if (!serverExited && server.pid) {
      try {
        server.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  };

  process.on('SIGINT', () => {
    killServer();
    process.exit(130);
  });

  try {
    if (!(await waitHealth())) {
      console.error('❌ QA API did not become healthy in time');
      process.exit(1);
    }
    console.log('✅ QA API healthy\n');

    for (const script of SCRIPTS) {
      console.log(`\n── ${script} ──\n`);
      await runScript(script);
    }

    console.log('\n✅ All API QA scripts passed\n');
  } catch (e) {
    console.error(`\n❌ QA run failed: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  } finally {
    killServer();
  }
}

main();
