import { LegalDocumentType, prisma } from '@mazare3/db';
import { AppError } from '../../lib/errors.js';
import { getAcceptanceStatus } from './legal-acceptance.service.js';

export type ReacceptanceGate = {
  documentType: string;
  status: string;
  blocking: boolean;
  softGate: boolean;
  message: string | null;
};

/**
 * Evaluate reacceptance gates without blanket lockout.
 * - Customers: soft prompts for terms/privacy updates; checkout may require active terms.
 * - Owners: soft gate on contractual actions (listing create) when owner_agreement requires reacceptance.
 */
export async function evaluateCustomerReacceptanceGates(userId: string): Promise<{
  gates: ReacceptanceGate[];
  requiresAction: boolean;
}> {
  const types: LegalDocumentType[] = [
    LegalDocumentType.terms_and_conditions,
    LegalDocumentType.privacy_policy,
  ];

  const gates: ReacceptanceGate[] = [];
  for (const documentType of types) {
    const result = await getAcceptanceStatus(userId, documentType);
    const reacceptance = result.status === 'reacceptance_required';
    const missing = result.status === 'missing' && result.activeReleaseId != null;
    gates.push({
      documentType,
      status: result.status,
      blocking: false,
      softGate: reacceptance || missing,
      message:
        reacceptance
          ? 'A material policy update requires reacceptance before some actions.'
          : missing
            ? 'No acceptance on record for the current active policy.'
            : null,
    });
  }

  return {
    gates,
    requiresAction: gates.some((g) => g.softGate),
  };
}

export async function evaluateOwnerReacceptanceGates(userId: string): Promise<{
  gates: ReacceptanceGate[];
  /** Soft gate for new contractual owner actions (e.g. listing create). */
  ownerAgreementReacceptanceRequired: boolean;
}> {
  const ownerAgreement = await getAcceptanceStatus(
    userId,
    LegalDocumentType.owner_agreement,
  );

  // Bridge: existing PartnerAgreementAcceptance counts as evidence without fabricating LegalAcceptance.
  let bridgedViaPartnerAgreement = false;
  if (ownerAgreement.status === 'missing' || ownerAgreement.status === 'superseded_still_valid') {
    const profile = await prisma.ownerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile) {
      const partnerAck = await prisma.partnerAgreementAcceptance.findFirst({
        where: { ownerProfileId: profile.id },
        orderBy: { acceptedAt: 'desc' },
      });
      bridgedViaPartnerAgreement = Boolean(partnerAck);
    }
  }

  const reacceptance = ownerAgreement.status === 'reacceptance_required';
  // Soft-gate listing create only when material reacceptance is required — not merely "missing"
  // after architecture bootstrap (PartnerAgreementAcceptance remains valid bridge evidence).
  const softGate = reacceptance;

  const gates: ReacceptanceGate[] = [
    {
      documentType: LegalDocumentType.owner_agreement,
      status:
        bridgedViaPartnerAgreement && ownerAgreement.status === 'missing'
          ? 'accepted'
          : ownerAgreement.status,
      blocking: false,
      softGate,
      message: softGate
        ? 'Owner agreement reacceptance required before creating new listings.'
        : null,
    },
  ];

  return {
    gates,
    ownerAgreementReacceptanceRequired: softGate,
  };
}

export async function assertOwnerListingSoftGate(userId: string): Promise<void> {
  const { ownerAgreementReacceptanceRequired } =
    await evaluateOwnerReacceptanceGates(userId);
  if (ownerAgreementReacceptanceRequired) {
    throw new AppError(
      403,
      'OWNER_AGREEMENT_REACCEPTANCE_REQUIRED',
      'Please re-accept the current owner agreement before creating listings.',
    );
  }
}

/**
 * Soft-gate customer contractual actions (book / pay / owner apply).
 * Does not invent acceptances — only checks recorded LegalAcceptance status.
 */
export async function assertCustomerTermsAcceptance(userId: string): Promise<void> {
  const terms = await getAcceptanceStatus(
    userId,
    LegalDocumentType.terms_and_conditions,
  );
  if (terms.status === 'missing' || terms.status === 'reacceptance_required') {
    throw new AppError(
      403,
      'LEGAL_ACCEPTANCE_REQUIRED',
      'Please accept the current Terms before continuing with this action.',
    );
  }
}
