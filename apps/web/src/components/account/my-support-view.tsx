'use client';

import { MySupportTicketsPanel } from '@/components/account/my-support-tickets-panel';

/** @deprecated Prefer HelpCenterView — kept for any direct imports. */
export function MySupportView() {
  return (
    <div className="py-2">
      <MySupportTicketsPanel />
    </div>
  );
}
