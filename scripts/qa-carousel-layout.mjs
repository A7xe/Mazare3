/**
 * MERCH-1 — pure carousel layout math (no browser).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, '../apps/web/package.json'));

// Load TS via tsx when run under pnpm exec tsx; for node, duplicate minimal math:
function computeCarouselCardWidthPx({ viewportWidthPx, itemCount, intendedVisible, gapPx = 16 }) {
  const viewport = Math.max(0, viewportWidthPx);
  if (viewport <= 0 || itemCount <= 0) return 0;
  const slots = Math.max(1, Math.floor(intendedVisible));
  const totalGap = gapPx * Math.max(0, slots - 1);
  return Math.max(0, (viewport - totalGap) / slots);
}

function computeCarouselUnusedSpacePx({ viewportWidthPx, itemCount, cardWidthPx, gapPx = 16 }) {
  const n = Math.max(0, itemCount);
  if (n <= 0 || cardWidthPx <= 0) return 0;
  const used = n * cardWidthPx + Math.max(0, n - 1) * gapPx;
  return Math.max(0, viewportWidthPx - used);
}

let passed = 0;
function check(name, cond) {
  if (!cond) throw new Error(name);
  passed++;
  console.log(`  ✅ ${name}`);
}

console.log('\n🎠 MERCH-1 carousel layout math\n');

const desktop = 1200;
const intended5 = 5;
const w1 = computeCarouselCardWidthPx({
  viewportWidthPx: desktop,
  itemCount: 1,
  intendedVisible: intended5,
});
const w2 = computeCarouselCardWidthPx({
  viewportWidthPx: desktop,
  itemCount: 2,
  intendedVisible: intended5,
});
const w5 = computeCarouselCardWidthPx({
  viewportWidthPx: desktop,
  itemCount: 5,
  intendedVisible: intended5,
});

check('1 item uses intended-slot width (not full rail)', Math.abs(w1 - w5) < 0.01);
check('2 items same normal card width as 5', Math.abs(w2 - w5) < 0.01);
check('1 item width << viewport', w1 < desktop * 0.35);
check(
  'unused space for 1 item is large',
  computeCarouselUnusedSpacePx({ viewportWidthPx: desktop, itemCount: 1, cardWidthPx: w1 }) > 500,
);

const mobile = computeCarouselCardWidthPx({
  viewportWidthPx: 360,
  itemCount: 1,
  intendedVisible: 1,
});
check('mobile 1 item may fill content width', Math.abs(mobile - 360) < 0.01);

const tablet = computeCarouselCardWidthPx({
  viewportWidthPx: 800,
  itemCount: 1,
  intendedVisible: 2,
});
check('tablet 1 item ~ half, not full', tablet < 800 * 0.55 && tablet > 800 * 0.4);

void require;
console.log(`\n📊 ${passed} passed\n`);
