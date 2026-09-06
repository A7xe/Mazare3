'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useAuthSession } from '@/components/auth/auth-session';
import {
  readRememberedPartnerVerificationStatus,
  resolveAddFarmHref,
  resolveAddFarmLabelKey,
  type AddFarmCtaLabelKey,
  type AddFarmHref,
} from '@/lib/add-farm-entry';

/** Shared client entry: href + dynamic label from session (+ remembered partner status hint). */
export function useAddFarmEntry(): {
  href: AddFarmHref;
  labelKey: AddFarmCtaLabelKey;
  label: string;
} {
  const { user } = useAuthSession();
  const pathname = usePathname();
  const t = useTranslations('common.addFarmCta');
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setHint(readRememberedPartnerVerificationStatus());
    sync();
    window.addEventListener('mazare3-partner-status-hint', sync);
    return () => window.removeEventListener('mazare3-partner-status-hint', sync);
  }, [user?.id, user?.ownerProfileStatus, user?.role, pathname]);

  const href = resolveAddFarmHref(user);
  const labelKey = resolveAddFarmLabelKey({ user, verificationStatus: hint });
  return { href, labelKey, label: t(labelKey) };
}
