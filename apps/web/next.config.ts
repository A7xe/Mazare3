import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/** Load repository root `.env` (do not override NODE_ENV set by Next.js for build). */
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  config({ path: rootEnv, override: false });
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return 'http://localhost:4000';
  }
})();

function publicMediaRemotePatterns(): Array<{
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
}> {
  const raw = (process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_URL ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];
    return [
      {
        protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: '/**',
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: new URL(apiOrigin).hostname,
        pathname: '/uploads/**',
      },
      ...publicMediaRemotePatterns(),
    ],
  },
  transpilePackages: ['@mazare3/shared'],
};

export default withNextIntl(nextConfig);
