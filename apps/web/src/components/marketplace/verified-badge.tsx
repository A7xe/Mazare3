import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VerificationStatus } from '@mazare3/shared';
import { Badge } from '@/components/ui/badge';
import { shouldShowVerificationBadge } from '@/lib/property-helpers';

interface VerifiedBadgeProps {
  status: VerificationStatus;
}

export function VerifiedBadge({ status }: VerifiedBadgeProps) {
  const t = useTranslations('verification');

  if (!shouldShowVerificationBadge(status)) {
    return null;
  }

  const variant = status === 'platform_verified' ? 'verified' : 'default';

  return (
    <Badge variant={variant} className="gap-1">
      <BadgeCheck className="h-3 w-3" aria-hidden />
      {t(status)}
    </Badge>
  );
}
