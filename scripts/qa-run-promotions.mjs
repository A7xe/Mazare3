/**
 * Focused 10F.1 runner: promotions API + deposit math + search math.
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const QA_PORT = process.env.QA_API_PORT ?? '4023';
const QA_BASE = `http://localhost:${QA_PORT}/api/v1`;
const USE_SHELL = process.platform === 'win32';

const SCRIPTS = ['qa-promotions-api.mjs', 'qa-deposit-math.mjs', 'qa-search-math.mjs'];

async function waitHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${QA_BASE}/health`);
      if (res.ok) return true;
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

function startQaApiServer() {
  return spawn('pnpm', ['exec', 'dotenv', '-e', '../../.env', '--', 'tsx', 'src/index.ts'], {
    cwd: API_DIR,
    shell: USE_SHELL,
    env: {
      ...process.env,
      API_PORT: QA_PORT,
      DISABLE_AUTH_RATE_LIMIT: 'true',
      ENABLE_INTERNAL_QA_ROUTES: 'true',
      APP_ENV: 'local',
      PAYMENT_PROVIDER: 'test',
      PAYMENT_SIMULATE_ENABLED: 'true',
      PRISMA_DISABLE_QUERY_LOG: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

async function main() {
  tryFreeListenPort(QA_PORT);
  await new Promise((r) => setTimeout(r, 500));
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
    for (const script of SCRIPTS) {
      console.log(`\n── ${script} ──\n`);
      await runScript(script);
    }
    console.log('\n✅ Focused promotions + deposit-math + search-math tests passed\n');
  } catch (e) {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  } finally {
    killServer();
  }
}

main();
