import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Generate a 6-digit numeric check-in PIN. */
export function generateCheckInPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function newCheckInSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashCheckInPin(pin: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${pin}`, 'utf8').digest('hex');
}

export function verifyCheckInPin(pin: string, salt: string, hash: string): boolean {
  const computed = hashCheckInPin(pin, salt);
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}
