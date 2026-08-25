export const OWNER_PERFORMANCE_RANGES = ['30d', '90d', 'all'] as const;
export type OwnerPerformanceRange = (typeof OWNER_PERFORMANCE_RANGES)[number];

export const OWNER_DECISION_OUTCOMES = ['accepted', 'rejected', 'timed_out'] as const;
export type OwnerDecisionOutcome = (typeof OWNER_DECISION_OUTCOMES)[number];

export type OwnerPerformanceBookingRow = {
  status: string;
  ownerDecisionOutcome: OwnerDecisionOutcome | string | null;
  createdAt: Date | string;
  ownerDecisionAt: Date | string | null;
  depositPaidAt?: Date | string | null;
  paymentState?: string | null;
};

export type OwnerPerformanceMetrics = {
  range: OwnerPerformanceRange;
  rangeStartedAt: string | null;
  totalRequests: number;
  awaitingDecision: number;
  accepted: number;
  rejected: number;
  timedOut: number;
  responded: number;
  resolved: number;
  acceptedThenConfirmed: number;
  responseRate: number | null;
  acceptanceRate: number | null;
  rejectionRate: number | null;
  timeoutRate: number | null;
  averageResponseMinutes: number | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function isOwnerPerformanceRange(value: string | null | undefined): value is OwnerPerformanceRange {
  return OWNER_PERFORMANCE_RANGES.includes(value as OwnerPerformanceRange);
}

export function ownerPerformanceRangeStart(
  range: OwnerPerformanceRange,
  now = new Date(),
): Date | null {
  if (range === 'all') return null;
  const days = range === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function wasAcceptedThenConfirmed(row: OwnerPerformanceBookingRow): boolean {
  if (row.ownerDecisionOutcome !== 'accepted') return false;
  if (row.status === 'confirmed') return true;
  if (row.depositPaidAt) return true;
  const paid = new Set(['deposit_paid', 'balance_pending', 'balance_overdue', 'fully_paid']);
  return paid.has(row.paymentState ?? '');
}

export function computeOwnerPerformanceMetrics(
  rows: OwnerPerformanceBookingRow[],
  range: OwnerPerformanceRange,
  now = new Date(),
): OwnerPerformanceMetrics {
  const accepted = rows.filter((r) => r.ownerDecisionOutcome === 'accepted').length;
  const rejected = rows.filter((r) => r.ownerDecisionOutcome === 'rejected').length;
  const timedOut = rows.filter((r) => r.ownerDecisionOutcome === 'timed_out').length;
  const awaitingDecision = rows.filter(
    (r) => r.status === 'pending_owner_approval' && !r.ownerDecisionOutcome,
  ).length;
  const responded = accepted + rejected;
  const resolved = accepted + rejected + timedOut;
  const acceptedThenConfirmed = rows.filter(wasAcceptedThenConfirmed).length;

  const responseMs: number[] = [];
  for (const row of rows) {
    if (row.ownerDecisionOutcome !== 'accepted' && row.ownerDecisionOutcome !== 'rejected') continue;
    const created = toDate(row.createdAt);
    const decided = toDate(row.ownerDecisionAt);
    if (!created || !decided) continue;
    const delta = decided.getTime() - created.getTime();
    if (delta >= 0) responseMs.push(delta);
  }
  const averageResponseMinutes =
    responseMs.length === 0
      ? null
      : responseMs.reduce((sum, ms) => sum + ms, 0) / responseMs.length / 60_000;

  return {
    range,
    rangeStartedAt: ownerPerformanceRangeStart(range, now)?.toISOString() ?? null,
    totalRequests: rows.length,
    awaitingDecision,
    accepted,
    rejected,
    timedOut,
    responded,
    resolved,
    acceptedThenConfirmed,
    responseRate: rate(responded, resolved),
    acceptanceRate: rate(accepted, responded),
    rejectionRate: rate(rejected, responded),
    timeoutRate: rate(timedOut, resolved),
    averageResponseMinutes,
  };
}
