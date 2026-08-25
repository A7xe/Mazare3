import { NextResponse } from 'next/server';

/**
 * PayTabs Hosted Payment Page browser return (often POST).
 * Informational only — does not mark payment succeeded.
 * Redirects into the locale checkout return UI which reads backend Payment state.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId');
  let paymentId = url.searchParams.get('paymentId');

  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      const cartId = String(form.get('cartId') ?? form.get('cart_id') ?? '');
      const parsed = /^mazare3_pay_(.+)_(deposit|balance|full)$/.exec(cartId);
      if (parsed && !paymentId) paymentId = parsed[1] ?? null;
    }
  } catch {
    /* ignore body parse errors — still redirect safely */
  }

  const locale = url.searchParams.get('locale') || 'ar';
  const origin = publicWebOrigin(req);
  const dest = bookingId
    ? new URL(`/${locale}/checkout/${bookingId}/return`, origin)
    : new URL(`/${locale}/account/bookings`, origin);
  if (paymentId) dest.searchParams.set('paymentId', paymentId);
  return NextResponse.redirect(dest, 303);
}

export async function GET(req: Request) {
  return POST(req);
}

/**
 * Never use the incoming request origin for PayTabs return.
 * Cloudflare tunnels forward HTTPS to local HTTP; Next then combines
 * x-forwarded-proto=https with Host=localhost → https://localhost (ERR_SSL_PROTOCOL_ERROR).
 *
 * Prefer configured public web URL, then a non-localhost forwarded host.
 */
function publicWebOrigin(req: Request): string {
  const configured = firstValidOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.FRONTEND_URL,
  );
  if (configured && !isLocalhostHostname(configured.hostname)) {
    return configured.origin;
  }

  const forwardedHost = firstHeaderValue(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
  );
  if (forwardedHost && !isLocalhostHostname(forwardedHost.split(':')[0] ?? forwardedHost)) {
    const proto =
      firstHeaderValue(req.headers.get('x-forwarded-proto')) ||
      (configured?.protocol.replace(':', '') ?? 'https');
    return `${proto}://${forwardedHost}`;
  }

  if (configured) {
    if (isLocalhostHostname(configured.hostname) && configured.protocol === 'https:') {
      configured.protocol = 'http:';
    }
    return configured.origin;
  }

  return 'http://localhost:3000';
}

function firstValidOrigin(...raw: Array<string | undefined>): URL | null {
  for (const value of raw) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed);
    } catch {
      /* skip invalid */
    }
  }
  return null;
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

function isLocalhostHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
