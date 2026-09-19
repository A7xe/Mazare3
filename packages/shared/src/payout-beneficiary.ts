/**
 * Phase 3C.4D.7A — Payout beneficiary helpers (provider-agnostic).
 * Name match is review-oriented only — NEVER legal identity proof.
 * Valid IBAN checksum ≠ ownership verification.
 */

/** Until founder/counsel confirms, third-party beneficiaries cannot become payout READY. */
export const PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED = true as const;

export const PAYOUT_BENEFICIARY_RELATIONSHIPS = [
  'operator_self',
  'operator_legal_entity',
  'authorised_third_party',
  'other_review_required',
] as const;

export type PayoutBeneficiaryRelationshipCode =
  (typeof PAYOUT_BENEFICIARY_RELATIONSHIPS)[number];

export type PayoutBeneficiaryNameMatchHintCode =
  | 'match_likely'
  | 'review_required'
  | 'clear_mismatch';

const COMMON_SUFFIXES =
  /\b(llc|l\.l\.c|ltd|limited|inc|corp|co|company|شركة|مؤسسة|مؤسسه|ذ\.م\.م|م\.م)\b/gi;

export function normalizeBeneficiaryNameForCompare(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(COMMON_SUFFIXES, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Heuristic comparison against Contracting OperatorParty legal name.
 * Does NOT establish legal identity — Admin remains authoritative.
 */
export function compareBeneficiaryToOperatorName(
  beneficiaryName: string,
  operatorLegalName: string,
): PayoutBeneficiaryNameMatchHintCode {
  const a = normalizeBeneficiaryNameForCompare(beneficiaryName);
  const b = normalizeBeneficiaryNameForCompare(operatorLegalName);
  if (!a || !b) return 'review_required';
  if (a === b) return 'match_likely';
  if (a.includes(b) || b.includes(a)) return 'review_required';
  const tokensA = new Set(a.split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(b.split(' ').filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 'review_required';
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap += 1;
  const ratio = overlap / Math.max(tokensA.size, tokensB.size);
  if (ratio >= 0.6) return 'review_required';
  return 'clear_mismatch';
}

/** Structural IBAN check (ISO 13616 mod-97). Not ownership proof. */
export function isStructurallyValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = '';
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) expanded += String(code - 55);
    else expanded += ch;
  }
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    const block = String(remainder) + expanded.slice(i, i + 7);
    remainder = Number(BigInt(block) % 97n);
  }
  return remainder === 1;
}

/** Jordan IBAN is typically JO + 26 chars (28 total). Soft hint only. */
export function isLikelyJordanIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  return iban.startsWith('JO') && iban.length === 30 && isStructurallyValidIban(iban);
}
