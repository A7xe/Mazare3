'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Waves } from 'lucide-react';
import { HeroSearch } from './hero-search';
import { TrustBadges } from './trust-badges';

export function HeroSection() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');

  return (
    <section className="gradient-hero relative overflow-hidden border-b border-border/80 px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
      <div className="pointer-events-none absolute -end-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/6 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -start-24 h-80 w-80 rounded-full bg-royal/5 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

      <div className="relative mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="glass-surface mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-navy">
            <Waves className="h-4 w-4 text-primary" aria-hidden />
            {tCommon('tagline')}
          </span>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {t('headline')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            {t('subheadline')}
          </p>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
        >
          <HeroSearch />
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.24 }}
        >
          <TrustBadges />
        </motion.div>
      </div>
    </section>
  );
}
