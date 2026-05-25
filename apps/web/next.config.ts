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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  transpilePackages: ['@mazare3/shared'],
};

export default withNextIntl(nextConfig);
