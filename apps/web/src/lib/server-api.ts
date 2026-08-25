/**
 * Server-only API origin. Never import this from a Client Component.
 * Browser traffic must use same-origin `/api/payment-return/...` instead.
 */
export function getServerApiBaseUrl(): string {
  const raw = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:4000'
  )
    .trim()
    .replace(/\/$/, '');
  if (raw.endsWith('/api/v1')) return raw;
  return `${raw}/api/v1`;
}

export function isPaymentId(value: string): boolean {
  return /^[a-z0-9_-]{8,64}$/i.test(value);
}
