import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getAppEnv } from '../config/app-env.js';
import { AppError } from './errors.js';

/**
 * CB-5A — at-rest encryption for PayTabs persistent card tokens.
 * Same AES-256-GCM envelope as partner-crypto, dedicated key only.
 * Never reuse PARTNER_DATA_ENCRYPTION_KEY for payment vault credentials.
 */
const KEY_ENV = 'PAYMENT_VAULT_ENCRYPTION_KEY';
const PREFIX = 'pv1';

function parseKeyBytes(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    return null;
  }
  return null;
}

export function isPaymentVaultEncryptionConfigured(): boolean {
  if (parseKeyBytes(process.env[KEY_ENV] ?? '')) return true;
  return getAppEnv() === 'local' && process.env.ENABLE_INTERNAL_QA_ROUTES === 'true';
}

export function getPaymentVaultEncryptionKey(): Buffer {
  const key = parseKeyBytes(process.env[KEY_ENV] ?? '');
  if (key) return key;
  // Local/QA only — deterministic non-production key so E2E can vault without operator secrets.
  if (getAppEnv() === 'local' && process.env.ENABLE_INTERNAL_QA_ROUTES === 'true') {
    return Buffer.from('mazare3-local-qa-pay-vault-key!!', 'utf8'); // 32 bytes
  }
  throw new AppError(
    503,
    'PAYMENT_VAULT_KEY_MISSING',
    `${KEY_ENV} is missing or invalid. Use 64 hex chars or 32-byte base64. Never put this key in NEXT_PUBLIC_*.`,
  );
}

export function encryptPaymentVaultToken(plaintext: string): string {
  const key = getPaymentVaultEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(
    '.',
  );
}

export function decryptPaymentVaultToken(payload: string): string {
  const key = getPaymentVaultEncryptionKey();
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new AppError(500, 'PAYMENT_VAULT_DECRYPT_FAILED', 'Invalid encrypted payment token payload');
  }
  const iv = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const data = Buffer.from(parts[3]!, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Stable uniqueness fingerprint — never expose plaintext token. */
export function fingerprintPaymentVaultToken(token: string): string {
  const key = getPaymentVaultEncryptionKey();
  return createHmac('sha256', key).update(token.trim(), 'utf8').digest('hex');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function paymentVaultPayloadLooksEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${PREFIX}.`);
}

/** Redact token-like strings from logs. */
export function redactPaymentVaultSecrets(text: string, tokens: string[] = []): string {
  let out = text;
  for (const t of tokens) {
    const v = t.trim();
    if (v.length >= 8) out = out.split(v).join('[redacted_provider_token]');
  }
  out = out.replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[redacted_provider_token]"');
  out = out.replace(/"providerToken"\s*:\s*"[^"]+"/gi, '"providerToken":"[redacted]"');
  return out;
}
