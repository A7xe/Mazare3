'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS,
  type DataProcessingConsentPurposeCode,
} from '@mazare3/shared';

/**
 * Purpose-specific Jordan Prior Consent checkbox (Arts 4–5).
 * Never pre-checked. Distinct from Terms and Privacy acknowledgement.
 */
export function PriorConsentCheckbox({
  purposeKey,
  checked,
  onChange,
  disabled = false,
  testId,
}: {
  purposeKey: DataProcessingConsentPurposeCode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  const def = DATA_PROCESSING_CONSENT_PURPOSE_DEFS.find((p) => p.purposeKey === purposeKey);
  // 3C.4D.7B — never render suspended / non-runtime Prior Consent purposes (no blanket Owner consent).
  if (!def || !def.runtimeGateRequired) return null;
  const text = lang === 'en' ? def.consentTextEn : def.consentTextAr;

  return (
    <label
      className="flex items-start gap-2.5 text-start text-xs leading-relaxed text-[#0D2046]"
      data-testid={testId ?? `prior-consent-${purposeKey}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary focus:ring-primary"
        checked={checked}
        disabled={disabled}
        data-testid={`${testId ?? `prior-consent-${purposeKey}`}-input`}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {text}{' '}
        <Link href="/privacy" className="font-semibold text-primary hover:underline">
          {t('nav.privacy')}
        </Link>
      </span>
    </label>
  );
}

export function usePriorConsentChecks(purposeKeys: DataProcessingConsentPurposeCode[]) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(purposeKeys.map((k) => [k, false])),
  );
  const allChecked = purposeKeys.every((k) => checks[k] === true);
  function setCheck(key: DataProcessingConsentPurposeCode, value: boolean) {
    setChecks((prev) => ({ ...prev, [key]: value }));
  }
  function reset() {
    setChecks(Object.fromEntries(purposeKeys.map((k) => [k, false])));
  }
  return { checks, setCheck, allChecked, reset };
}
