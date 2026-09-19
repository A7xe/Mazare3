/**
 * Ensure purpose-specific Prior Consents are active before processing starts.
 * Grants only when the caller passes checkedPurposes (explicit UI checkboxes).
 * Never fabricates consent without explicitConsent.
 */
import type { DataProcessingConsentPurposeCode } from '@mazare3/shared';
import { fetchPriorConsentStatus, grantPriorConsent } from '@/lib/api-legal';

export async function ensurePriorConsentsForPurposes(params: {
  purposeKeys: DataProcessingConsentPurposeCode[];
  /** Purposes the user explicitly checked in this session. */
  checkedPurposes: Partial<Record<DataProcessingConsentPurposeCode, boolean>>;
  language: 'ar' | 'en';
  sourceSurface: string;
}): Promise<{ ok: true } | { ok: false; missing: DataProcessingConsentPurposeCode[] }> {
  const status = await fetchPriorConsentStatus();
  const missing: DataProcessingConsentPurposeCode[] = [];

  for (const purposeKey of params.purposeKeys) {
    const row = status.data.purposes.find((p) => p.purposeKey === purposeKey);
    if (row?.validity === 'CONSENT_STILL_VALID') continue;
    if (params.checkedPurposes[purposeKey] !== true) {
      missing.push(purposeKey);
      continue;
    }
    await grantPriorConsent({
      purposeKey,
      language: params.language,
      explicitConsent: true,
      sourceSurface: params.sourceSurface,
    });
  }

  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
