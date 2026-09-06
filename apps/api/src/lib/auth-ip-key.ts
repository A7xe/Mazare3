import { createHmac, randomBytes } from 'node:crypto';

/**
 * Canonicalize Express `req.ip` for stable rate-limit identity.
 * Handles IPv4-mapped IPv6 (::ffff:x.x.x.x) and bracketed IPv6.
 */
export function canonicalizeClientIp(ip: string | undefined | null): string {
  if (!ip) return 'unknown';
  let s = ip.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1);
  }
  if (s.startsWith('::ffff:')) {
    s = s.slice('::ffff:'.length);
  }
  // Strip unexpected port suffix on IPv4 only (Express normally excludes ports).
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) {
    s = s.replace(/:\d+$/, '');
  }
  return s || 'unknown';
}

function getRateLimitHmacSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required for rate-limit keys');
  }
  return secret;
}

/** Privacy-preserving IP bucket key material (hex). Never log alongside raw IP. */
export function hashAuthIpKey(canonicalIp: string): string {
  return createHmac('sha256', getRateLimitHmacSecret())
    .update(`auth-ip-rate:v1:${canonicalIp}`, 'utf8')
    .digest('hex');
}

export function authIpRateLimitKeyFromRequestIp(ip: string | undefined | null): string {
  return hashAuthIpKey(canonicalizeClientIp(ip));
}

/** Short opaque prefix for operational logs — not reversible to IP. */
export function rateLimitKeyLogPrefix(keyHash: string): string {
  return keyHash.slice(0, 8);
}

export function newRateLimitBucketId(): string {
  return `rl_${randomBytes(16).toString('hex')}`;
}
