import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * Official PayTabs callback/IPN verification:
 * HMAC-SHA256 of the exact raw request body bytes using the Profile Server Key,
 * compared to the `Signature` header (hex).
 * Do not JSON.stringify a parsed body — whitespace and key order must be unchanged.
 * @see https://support.paytabs.com/en/support/solutions/articles/60000718961
 */
export function getPaytabsCallbackSignatureHeader(
  headers: IncomingHttpHeaders,
): string | undefined {
  const raw = headers.signature ?? headers['x-webhook-signature'] ?? headers['x-signature'];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function verifyPaytabsCallbackSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  serverKey: string,
): boolean {
  if (!signatureHeader?.trim() || !serverKey) return false;
  const bytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', serverKey).update(bytes).digest('hex');
  const received = signatureHeader.trim().toLowerCase();
  const expectedNorm = expected.toLowerCase();
  if (received.length !== expectedNorm.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expectedNorm, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Official PayTabs return-URL (browser POST form) verification:
 * strip signature + empty fields → ksort → http_build_query → HMAC-SHA256(ServerKey).
 * Used only for informational validation — never to finalize payment.
 */
export function verifyPaytabsReturnFormSignature(
  fields: Record<string, string>,
  serverKey: string,
): boolean {
  if (!serverKey || !fields.signature) return false;
  const requestSignature = fields.signature;
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'signature') continue;
    if (v === '' || v == null) continue;
    filtered[k] = v;
  }
  const keys = Object.keys(filtered).sort();
  const query = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(filtered[k]!)}`)
    .join('&')
    // PHP http_build_query uses %20 for spaces in some versions; PayTabs samples use %40 for @.
    .replace(/%20/g, '+');
  const expected = createHmac('sha256', serverKey).update(query, 'utf8').digest('hex');
  const received = requestSignature.toLowerCase();
  const expectedNorm = expected.toLowerCase();
  if (received.length !== expectedNorm.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expectedNorm, 'utf8'));
  } catch {
    return false;
  }
}

/** Parse Mazare3 cart_id `mazare3_pay_{paymentId}_{purpose}`. */
export function parsePaytabsCartId(
  cartId: string | null | undefined,
): { paymentId: string; purpose: string } | null {
  if (!cartId) return null;
  // Include reschedule_difference (Phase 3C.4E.2B) — purpose is suffix after last known enum.
  const m =
    /^mazare3_pay_(.+)_(deposit|balance|full|reschedule_difference)$/.exec(cartId.trim());
  if (!m) return null;
  return { paymentId: m[1]!, purpose: m[2]! };
}

export function formatPaytabsAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}
