/**
 * Phase 3C.4E.4A — Read-only Customer legal-acceptance preflight.
 * No mutations. No Customer PII dump.
 */
import { LegalDocumentStatus, LegalDocumentType, prisma } from '@mazare3/db';
import { resolveApplicableCustomerBookingLegalSet } from './customer-booking-legal.service.js';

export type CustomerLegalAcceptancePreflightReport = {
  phase: '3C.4E.4A';
  mutation: false;
  generatedAt: string;
  totals: {
    bookings: number;
    bookingsWithLegalSnapshot: number;
    newFormatCompleteLegalRefs: number;
    legacyIncompleteLegalSnapshots: number;
    bookingsWithoutLegalSnapshot: number;
    /** Complete contractual snapshot but missing ≥1 Booking-linked LegalAcceptance.
     * Includes historical 3C.4E.4A after-commit gap leftovers (not backfilled). */
    completeSnapshotMissingAcceptance: number;
    /** Alias: same count — historical limitation until all such Bookings age out; not backfilled. */
    historicalAfterCommitGapMissingAcceptance: number;
    /** Bookings with no snapshot at all — historical limitation, not a new anomaly. */
    legacyBookingsWithoutSnapshot: number;
  };
  activeLegalVersionsByType: Record<
    string,
    Array<{ id: string; version: string; language: string; status: string }>
  >;
  requiredTypesMissingActiveVersion: string[];
  corpus: {
    ar: { corpusReady: boolean; blockers: string[]; enforcementStrict: boolean };
    en: { corpusReady: boolean; blockers: string[]; enforcementStrict: boolean };
  };
  anomalies: {
    acceptanceVersionMismatchVsSnapshot: number;
    draftReferencedInSnapshot: number;
    snapshotVersionNotActiveOrSuperseded: number;
    /**
     * Complete snapshot without required Booking-context acceptances.
     * Pre-3C.4E.4A.1 rows are historical after-commit gap leftovers (do not backfill).
     * Post-3C.4E.4A.1 NEW Bookings must not increase this class.
     */
    completeSnapshotMissingAcceptanceEvidence: number;
  };
  notes: string[];
};

const REQUIRED_TYPES = [
  LegalDocumentType.terms_and_conditions,
  LegalDocumentType.cancellation_refund_policy,
  LegalDocumentType.booking_terms,
] as const;

export async function runCustomerLegalAcceptancePreflightReport(): Promise<CustomerLegalAcceptancePreflightReport> {
  const now = new Date();
  const [arSet, enSet] = await Promise.all([
    resolveApplicableCustomerBookingLegalSet('ar'),
    resolveApplicableCustomerBookingLegalSet('en'),
  ]);

  const totalBookings = await prisma.booking.count();
  const withSnap = await prisma.bookingLegalSnapshot.count();

  const snapshots = await prisma.bookingLegalSnapshot.findMany({
    select: {
      bookingId: true,
      termsVersionId: true,
      cancellationPolicyVersionId: true,
      bookingTermsVersionId: true,
      privacyNoticeVersionId: true,
      termsVersion: { select: { id: true, status: true, version: true } },
      cancellationPolicyVersion: { select: { id: true, status: true, version: true } },
      bookingTermsVersion: { select: { id: true, status: true, version: true } },
    },
    take: 5000,
    orderBy: { createdAt: 'desc' },
  });

  let complete = 0;
  let incomplete = 0;
  let draftInSnap = 0;
  let badStatus = 0;

  for (const s of snapshots) {
    const hasAll =
      Boolean(s.termsVersionId) &&
      Boolean(s.cancellationPolicyVersionId) &&
      Boolean(s.bookingTermsVersionId);
    if (hasAll) complete += 1;
    else incomplete += 1;

    for (const v of [s.termsVersion, s.cancellationPolicyVersion, s.bookingTermsVersion]) {
      if (!v) continue;
      if (v.status === LegalDocumentStatus.draft) draftInSnap += 1;
      else if (
        v.status !== LegalDocumentStatus.active &&
        v.status !== LegalDocumentStatus.superseded
      ) {
        badStatus += 1;
      }
    }
  }

  // Acceptance vs snapshot version mismatch (same Booking, contractual types)
  const acceptances = await prisma.legalAcceptance.findMany({
    where: {
      relatedBookingId: { not: null },
      documentType: { in: [...REQUIRED_TYPES] },
    },
    select: {
      relatedBookingId: true,
      documentType: true,
      documentVersionId: true,
    },
    take: 8000,
  });

  const snapByBooking = new Map(
    snapshots.map((s) => [
      s.bookingId,
      {
        [LegalDocumentType.terms_and_conditions]: s.termsVersionId,
        [LegalDocumentType.cancellation_refund_policy]: s.cancellationPolicyVersionId,
        [LegalDocumentType.booking_terms]: s.bookingTermsVersionId,
      } as Record<string, string | null>,
    ]),
  );

  let mismatch = 0;
  for (const a of acceptances) {
    if (!a.relatedBookingId) continue;
    const snap = snapByBooking.get(a.relatedBookingId);
    if (!snap) continue;
    const expected = snap[a.documentType];
    if (expected && expected !== a.documentVersionId) mismatch += 1;
  }

  const acceptByBooking = new Map<string, Set<string>>();
  for (const a of acceptances) {
    if (!a.relatedBookingId) continue;
    const set = acceptByBooking.get(a.relatedBookingId) ?? new Set();
    set.add(String(a.documentType));
    acceptByBooking.set(a.relatedBookingId, set);
  }

  let newFormatMissingAcceptance = 0;
  for (const s of snapshots) {
    const hasAll =
      Boolean(s.termsVersionId) &&
      Boolean(s.cancellationPolicyVersionId) &&
      Boolean(s.bookingTermsVersionId);
    if (!hasAll) continue;
    const types = acceptByBooking.get(s.bookingId) ?? new Set();
    const ok =
      types.has(LegalDocumentType.terms_and_conditions) &&
      types.has(LegalDocumentType.cancellation_refund_policy) &&
      types.has(LegalDocumentType.booking_terms);
    if (!ok) newFormatMissingAcceptance += 1;
  }

  const activeRows = await prisma.legalDocumentVersion.findMany({
    where: { status: LegalDocumentStatus.active },
    select: {
      id: true,
      documentType: true,
      version: true,
      language: true,
      status: true,
    },
    take: 200,
  });

  const activeLegalVersionsByType: CustomerLegalAcceptancePreflightReport['activeLegalVersionsByType'] =
    {};
  for (const row of activeRows) {
    const key = String(row.documentType);
    if (!activeLegalVersionsByType[key]) activeLegalVersionsByType[key] = [];
    activeLegalVersionsByType[key].push({
      id: row.id,
      version: row.version,
      language: row.language,
      status: String(row.status),
    });
  }

  const requiredTypesMissingActiveVersion: string[] = [];
  for (const t of REQUIRED_TYPES) {
    const has = activeRows.some((r) => r.documentType === t);
    if (!has) requiredTypesMissingActiveVersion.push(String(t));
  }

  const legacyWithoutSnapshot = Math.max(0, totalBookings - withSnap);

  return {
    phase: '3C.4E.4A',
    mutation: false,
    generatedAt: now.toISOString(),
    totals: {
      bookings: totalBookings,
      bookingsWithLegalSnapshot: withSnap,
      newFormatCompleteLegalRefs: complete,
      legacyIncompleteLegalSnapshots: incomplete,
      bookingsWithoutLegalSnapshot: legacyWithoutSnapshot,
      completeSnapshotMissingAcceptance: newFormatMissingAcceptance,
      historicalAfterCommitGapMissingAcceptance: newFormatMissingAcceptance,
      legacyBookingsWithoutSnapshot: legacyWithoutSnapshot,
    },
    activeLegalVersionsByType,
    requiredTypesMissingActiveVersion,
    corpus: {
      ar: {
        corpusReady: arSet.corpusReady,
        blockers: arSet.blockers,
        enforcementStrict: arSet.enforcementStrict,
      },
      en: {
        corpusReady: enSet.corpusReady,
        blockers: enSet.blockers,
        enforcementStrict: enSet.enforcementStrict,
      },
    },
    anomalies: {
      acceptanceVersionMismatchVsSnapshot: mismatch,
      draftReferencedInSnapshot: draftInSnap,
      snapshotVersionNotActiveOrSuperseded: badStatus,
      completeSnapshotMissingAcceptanceEvidence: newFormatMissingAcceptance,
    },
    notes: [
      'Legacy incomplete snapshots / bookings without snapshot are not backfilled.',
      'completeSnapshotMissingAcceptanceEvidence includes historical 3C.4E.4A after-commit gap leftovers — not fabricated; NEW Booking create is atomic as of 3C.4E.4A.1.',
      'DRAFT advisor-final documents are never selected as ACTIVE.',
      'No Customer PII included.',
    ],
  };
}
