import '../prisma/load-env.js';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function check(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    return { status: res.status, ok: res.ok, type: res.headers.get('content-type') };
  } catch (e) {
    return { status: 0, ok: false, type: String(e) };
  }
}

const media = await prisma.propertyMedia.findMany({ select: { url: true }, distinct: ['url'] });
const urls = media.map((m) => m.url);
console.log('unique urls', urls.length);

const bad: string[] = [];
for (const url of urls) {
  const r = await check(url);
  const mark = r.ok ? 'OK' : 'BAD';
  if (!r.ok) bad.push(url);
  console.log(mark, r.status, (r.type ?? '').slice(0, 40), url.slice(0, 100));
}

console.log('\nbad count', bad.length);
await prisma.$disconnect();
