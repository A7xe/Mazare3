import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getAppEnv } from '../config/app-env.js';
import { AppError } from './errors.js';

const KEY_ENV = 'PARTNER_DATA_ENCRYPTION_KEY';
const PREFIX = 'v1';

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

export function getPartnerDataEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV] ?? '';
  const key = parseKeyBytes(raw);
  if (key) return key;
  const env = getAppEnv();
  if (env === 'local' && process.env.ENABLE_INTERNAL_QA_ROUTES === 'true') {
    throw new AppError(
      503,
      'PARTNER_ENCRYPTION_KEY_MISSING',
      `${KEY_ENV} is required even in local QA. Set a 64-char hex or 32-byte base64 key.`,
    );
  }
  throw new AppError(
    503,
    'PARTNER_ENCRYPTION_KEY_MISSING',
    `${KEY_ENV} is missing or invalid. Use 64 hex chars or 32-byte base64. Never put this key in NEXT_PUBLIC_*.`,
  );
}

export function encryptPartnerField(plaintext: string): string {
  const key = getPartnerDataEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(
    '.',
  );
}

export function decryptPartnerField(payload: string): string {
  const key = getPartnerDataEncryptionKey();
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new AppError(500, 'PARTNER_DECRYPT_FAILED', 'Invalid encrypted payload');
  }
  const iv = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const data = Buffer.from(parts[3]!, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskSecretLast4(value: string): string {
  const cleaned = value.replace(/\s+/g, '');
  if (cleaned.length <= 4) return '••••';
  return `••••${cleaned.slice(-4)}`;
}

export function last4Of(value: string): string {
  return value.replace(/\s+/g, '').slice(-4).toUpperCase();
}

export function fingerprintIban(iban: string): string {
  const key = getPartnerDataEncryptionKey();
  const normalized = iban.replace(/\s+/g, '').toUpperCase();
  return createHmac('sha256', key).update(normalized).digest('hex');
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

export function payloadLooksEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${PREFIX}.`);
}
