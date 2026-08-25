import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBaseUrl, isPaymentId } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/**
 * Browser-return acknowledgement proxy.
 * Forwards to POST /payments/:id/browser-return — informational only, never capture.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await ctx.params;
  if (!isPaymentId(paymentId)) {
    return NextResponse.json(
      { error: 'Invalid payment id', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  const cookie = req.headers.get('cookie') ?? '';
  const res = await fetch(`${getServerApiBaseUrl()}/payments/${paymentId}/browser-return`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
