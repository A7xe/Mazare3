/** Mask email for logs/admin UI — never store full address in delivery metadata beyond send attempt. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${visible}@${domain}`;
}

/** Returns true if text might contain secrets — used to sanitize error logs. */
export function containsSecretLike(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('smtp_pass') ||
    lower.includes('api_key') ||
    lower.includes('password') ||
    lower.includes('secret') ||
    /\b(sk|re)_[a-z0-9]{10,}\b/i.test(text)
  );
}

export function sanitizeDeliveryErrorMessage(message: string): string {
  if (containsSecretLike(message)) {
    return 'Email delivery failed (configuration error)';
  }
  return message.slice(0, 500);
}
