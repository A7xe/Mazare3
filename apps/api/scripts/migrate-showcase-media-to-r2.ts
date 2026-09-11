/**
 * DEMO-2 — migrate Showcase PropertyMedia → public R2 (idempotent).
 * Run: pnpm --filter @mazare3/api exec dotenv -e ../../.env -- tsx scripts/migrate-showcase-media-to-r2.ts
 */
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@mazare3/db';

const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
config({ path: rootEnv, override: false });

const SHOWCASE_MARKER = 'MAZARE3_SHOWCASE_2026';
const SHOWCASE_SLUG_PREFIX = 'sc26-';

function assertLocal() {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' || appEnv === 'production') {
    console.error('❌ Refusing migrate-showcase-media-to-r2 in production');
    process.exit(1);
  }
}

function deterministicUuid(seed: string): string {
  const h = createHash('sha256').update(`${SHOWCASE_MARKER}:${seed}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function detectMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString() === 'RIFF' &&
    buf.subarray(8, 12).toString() === 'WEBP'
  )
    return 'image/webp';
  return null;
}

function loadR2() {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? '').trim();
  const bucket = (process.env.CLOUDFLARE_R2_MEDIA_BUCKET ?? '').trim();
  const publicUrlRaw = (process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_URL ?? '').trim();
  const kycBucket = (process.env.CLOUDFLARE_R2_BUCKET ?? '').trim();
  const endpointOverride = (process.env.CLOUDFLARE_R2_S3_ENDPOINT ?? '').trim();
  const region = (process.env.CLOUDFLARE_R2_REGION ?? 'auto').trim() || 'auto';
  const mediaAk = (process.env.CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID ?? '').trim();
  const mediaSk = (process.env.CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY ?? '').trim();
  const sharedAk = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '').trim();
  const sharedSk = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '').trim();
  const accessKeyId = mediaAk || sharedAk;
  const secretAccessKey = mediaSk || sharedSk;
  if (!accountId || !bucket || !publicUrlRaw || !accessKeyId || !secretAccessKey) {
    console.error('❌ Public R2 media not fully configured. Leaving external URLs.');
    process.exit(2);
  }
  if (kycBucket && bucket === kycBucket) {
    console.error('❌ MEDIA bucket equals KYC bucket — refusing.');
    process.exit(2);
  }
  const publicBaseUrl = publicUrlRaw.replace(/\/+$/, '');
  const client = new S3Client({
    region,
    endpoint: endpointOverride || `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket, publicBaseUrl };
}

async function downloadImage(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000) return null;
    const mime = detectMime(buf);
    if (!mime) return null;
    return { buf, mime };
  } catch {
    return null;
  }
}

assertLocal();

async function main() {
  console.log(`\n☁️  Migrating ${SHOWCASE_MARKER} media → public R2…\n`);
  const { client, bucket, publicBaseUrl } = loadR2();
  console.log(`   public host=${new URL(publicBaseUrl).host}`);

  const props = await prisma.property.findMany({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    include: { media: { orderBy: { sortOrder: 'asc' } } },
  });

  let skipped = 0;
  let uploaded = 0;
  let failed = 0;

  for (const prop of props) {
    for (const m of prop.media) {
      const existingKey = (m.storageKey ?? '').replace(/\\/g, '/');
      const host = new URL(publicBaseUrl).host;
      if (
        existingKey &&
        /^properties\/[a-zA-Z0-9_-]{8,64}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(existingKey) &&
        m.url.includes(host)
      ) {
        try {
          const head = await fetch(m.url, { redirect: 'follow' });
          if (head.ok) {
            skipped++;
            continue;
          }
        } catch {
          /* re-upload */
        }
      }

      const dl = await downloadImage(m.url);
      if (!dl) {
        console.log(`  ⚠ download fail ${prop.slug} #${m.sortOrder}`);
        failed++;
        continue;
      }

      const ext = dl.mime === 'image/png' ? '.png' : dl.mime === 'image/webp' ? '.webp' : '.jpg';
      const uuid = deterministicUuid(`${prop.slug}:${m.sortOrder}:${ext}`);
      const storageKey = `properties/${prop.id}/${uuid}${ext}`;
      const publicUrl = `${publicBaseUrl}/${storageKey}`;

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: dl.buf,
            ContentType: dl.mime,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );

        const check = await fetch(publicUrl, { redirect: 'follow' });
        const checkBuf = Buffer.from(await check.arrayBuffer());
        const ct = check.headers.get('content-type') ?? '';
        if (!check.ok || !ct.includes('image') || checkBuf.length < 5_000) {
          console.log(`  ⚠ verify fail keep source ${prop.slug} #${m.sortOrder}`);
          failed++;
          continue;
        }

        await prisma.propertyMedia.update({
          where: { id: m.id },
          data: { url: publicUrl, storageKey, thumbnailUrl: null },
        });
        uploaded++;
        console.log(`  ✓ ${prop.slug} sort=${m.sortOrder}`);
      } catch (err) {
        console.log(
          `  ⚠ upload error keep source ${prop.slug} #${m.sortOrder}: ${(err as Error).message}`,
        );
        failed++;
      }
    }
  }

  console.log(`\n✅ uploaded=${uploaded} skipped=${skipped} failed=${failed}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
