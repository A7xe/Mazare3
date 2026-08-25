'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  acknowledgePaymentReturn,
  fetchPaymentReturnStatus,
} from '@/lib/api-payment-return';

const TERMINAL = new Set(['succeeded', 'failed', 'expired']);
const MAX_POLLS = 12;
const POLL_MS = 2500;

function displayStatus(status: string | null): 'pending' | 'succeeded' | 'failed' {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed' || status === 'expired') return 'failed';
  return 'pending';
}

/**
 * PayTabs return UI — polls same-origin Web BFF only.
 * Never treats URL/query/form fields as payment truth.
 * Never calls the API origin from the browser.
 */
export function CheckoutReturnView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const search = useSearchParams();
  const paymentId = search.get('paymentId');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (!paymentId) {
        setStatus('pending');
        return;
      }
      try {
        if (!acked.current) {
          await acknowledgePaymentReturn(paymentId);
          if (cancelled) return;
          acked.current = true;
        }
        const res = await fetchPaymentReturnStatus(paymentId);
        if (cancelled) return;
        setStatus(res.data.status);
        if (!TERMINAL.has(res.data.status) && tries < MAX_POLLS) {
          tries += 1;
          timer = setTimeout(() => {
            void tick();
          }, POLL_MS);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('payError'));
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, t]);

  const kind = displayStatus(status);
  const title =
    kind === 'succeeded'
      ? t('returnSuccessTitle')
      : kind === 'failed'
        ? t('returnFailedTitle')
        : t('returnPendingTitle');
  const body =
    kind === 'succeeded'
      ? t('returnSuccessBody')
      : kind === 'failed'
        ? t('returnFailedBody')
        : t('returnProcessingBody');

  return (
    <div data-testid="checkout-return-page" className="mx-auto max-w-lg space-y-4 py-10">
      <h1 data-testid="checkout-return-title" className="text-xl font-semibold text-navy">
        {title}
      </h1>
      <p
        data-testid="checkout-return-status"
        data-status={kind}
        className="text-sm text-muted"
      >
        {body}
      </p>
      {kind === 'pending' && !error && (
        <div className="flex items-center gap-2 text-sm text-navy">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('returnProcessingTitle')}
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild className="shadow-soft">
          <Link href="/account/bookings">{t('returnViewBooking')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/checkout/${bookingId}`}>{t('returnBackCheckout')}</Link>
        </Button>
      </div>
    </div>
  );
}
