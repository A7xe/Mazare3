import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBaseUrl, isPaymentId } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

async function proxyToApi(
  req: NextRequest,
  paymentId: string,
  method: 'GET' | 'POST',
  suffix = '',
) {
  if (!isPaymentId(paymentId)) {
    return NextResponse.json(
      { error: 'Invalid payment id', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  const cookie = req.headers.get('cookie') ?? '';
  const res = await fetch(`${getServerApiBaseUrl()}/payments/${paymentId}${suffix}`, {
    method,
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await ctx.params;
  return proxyToApi(req, paymentId, 'GET');
}
