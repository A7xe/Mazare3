/**
 * MERCH-2 — sanitized ambiguous QA/E2E inventory (read-only).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchStrongFamily,
  isAmbiguousQaE2eTitle,
  assertLocalSafeForMutation,
} from './audit-local-qa-fixtures.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnv();
assertLocalSafeForMutation();

function familyKey(titleEn) {
  const t = titleEn ?? '';
  const m = t.match(/^(QA|E2E)\s+(\w+)/);
  if (!m) return t.slice(0, 24);
  return `${m[1]} ${m[2]}`;
}

function confidence(titleEn) {
  const t = titleEn ?? '';
  if (t.startsWith('QA Search ')) return { confidence: 'HIGH', likelySource: 'search E2E/API suite (not in strong matcher)' };
  if (t.startsWith('QA Org ')) return { confidence: 'HIGH', likelySource: 'placements organic control (prefix QA Org vs E2E Org)' };
  if (t.startsWith('QA Timed ')) return { confidence: 'MEDIUM', likelySource: 'availability/timing QA scripts' };
  if (t.startsWith('QA ')) return { confidence: 'MEDIUM', likelySource: 'unknown QA script' };
  if (t.startsWith('E2E ')) return { confidence: 'MEDIUM', likelySource: 'unknown E2E suite' };
  return { confidence: 'LOW', likelySource: 'unknown' };
}

const {
  PrismaClient,
  PropertyStatus,
  PromotionStatus,
  PlacementType,
} = await import('../packages/db/generated/client/index.js');
const prisma = new PrismaClient({ log: ['error'] });
const now = new Date();

try {
  const published = await prisma.property.findMany({
    where: { status: PropertyStatus.published, owner: { status: 'approved' } },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      createdAt: true,
      status: true,
      placements: {
        where: {
          status: PromotionStatus.active,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        select: { placementType: true, status: true },
      },
      promotions: {
        where: {
          status: PromotionStatus.active,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const ambiguous = published.filter((p) =>
    isAmbiguousQaE2eTitle(p.titleEn, matchStrongFamily(p.titleEn)),
  );

  const families = {};
  for (const p of ambiguous) {
    const key = familyKey(p.titleEn);
    if (!families[key]) {
      families[key] = {
        pattern: key,
        count: 0,
        publicStatus: 'published+approved',
        activeSponsored: 0,
        activeFeatured: 0,
        activePromotions: 0,
        newestCreatedAt: null,
        oldestCreatedAt: null,
        sampleTitles: [],
        ...confidence(p.titleEn),
      };
    }
    const f = families[key];
    f.count++;
    f.activeSponsored += p.placements.filter((x) => x.placementType === PlacementType.sponsored).length;
    f.activeFeatured += p.placements.filter((x) => x.placementType === PlacementType.featured).length;
    f.activePromotions += p.promotions.length;
    if (!f.newestCreatedAt || p.createdAt > new Date(f.newestCreatedAt)) {
      f.newestCreatedAt = p.createdAt.toISOString();
    }
    if (!f.oldestCreatedAt || p.createdAt < new Date(f.oldestCreatedAt)) {
      f.oldestCreatedAt = p.createdAt.toISOString();
    }
    if (f.sampleTitles.length < 3) f.sampleTitles.push(p.titleEn);
  }

  console.log(
    JSON.stringify(
      {
        ambiguousPublishedTotal: ambiguous.length,
        families: Object.values(families),
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
