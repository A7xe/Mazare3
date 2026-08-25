import '../prisma/load-env.js';
import { PrismaClient } from '../generated/client/index.js';

/**
 * Verified Unsplash URLs (HTTP 200 as of last probe). Never include known 404s.
 */
const VERIFIED_IMAGES = [
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
  'https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=1200&q=80',
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
  'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
] as const;

const BROKEN_SUBSTRINGS = [
  'photo-1600566753190-17f0baa2a6a3',
  'photo-1499793983690-e8b21beb4b2f',
  'photo-1600047509807-ba8f99d2cd7a',
  'photo-1605276374101-dee2a0ed3cd6',
  'photo-1600607687644-c7171b42498b',
  'photo-1507089947369-6d0f3b0f5c5b',
];

const prisma = new PrismaClient();

function isBroken(url: string) {
  return BROKEN_SUBSTRINGS.some((s) => url.includes(s));
}

function pick(i: number) {
  return VERIFIED_IMAGES[i % VERIFIED_IMAGES.length]!;
}

async function main() {
  // 1) Verify the pool still returns 200
  console.log('Verifying image pool…');
  for (const url of VERIFIED_IMAGES) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Pool URL failed ${res.status}: ${url}`);
  }
  console.log(`Pool OK (${VERIFIED_IMAGES.length} urls)`);

  // 2) Replace any broken media rows
  const media = await prisma.propertyMedia.findMany({ select: { id: true, url: true, propertyId: true, sortOrder: true } });
  let fixed = 0;
  for (const [i, row] of media.entries()) {
    if (!isBroken(row.url)) continue;
    const next = pick(i + row.sortOrder * 3 + 11);
    await prisma.propertyMedia.update({ where: { id: row.id }, data: { url: next } });
    fixed += 1;
  }
  console.log(`Replaced ${fixed} broken media rows`);

  // 3) Re-check all distinct cover URLs
  const covers = await prisma.propertyMedia.findMany({
    where: { sortOrder: 0 },
    select: { url: true },
    distinct: ['url'],
  });
  let bad = 0;
  for (const c of covers) {
    const res = await fetch(c.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      bad += 1;
      console.log('STILL BAD', res.status, c.url);
    }
  }
  console.log(`Cover URL check: ${covers.length} unique, ${bad} failing`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
