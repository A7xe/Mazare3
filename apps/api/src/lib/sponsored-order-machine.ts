import { SponsoredOrderStatus } from '@mazare3/db';
import { AppError } from './errors.js';

const ALLOWED: Record<string, SponsoredOrderStatus[]> = {
  [SponsoredOrderStatus.pending_review]: [
    SponsoredOrderStatus.approved_pending_payment,
    SponsoredOrderStatus.rejected,
    SponsoredOrderStatus.cancelled,
  ],
  [SponsoredOrderStatus.approved_pending_payment]: [
    SponsoredOrderStatus.paid,
    SponsoredOrderStatus.cancelled,
    SponsoredOrderStatus.rejected,
  ],
  [SponsoredOrderStatus.paid]: [SponsoredOrderStatus.active, SponsoredOrderStatus.cancelled],
  [SponsoredOrderStatus.active]: [SponsoredOrderStatus.completed],
  [SponsoredOrderStatus.completed]: [],
  [SponsoredOrderStatus.rejected]: [],
  [SponsoredOrderStatus.cancelled]: [],
};

export function assertSponsoredOrderTransition(
  from: SponsoredOrderStatus,
  to: SponsoredOrderStatus,
): void {
  if (!ALLOWED[from]?.includes(to)) {
    throw new AppError(409, 'INVALID_SPONSORSHIP_TRANSITION', `Cannot move sponsorship from ${from} to ${to}`);
  }
}
