/**
 * UA-6 — Public phone auth enablement (separate from SMS adapter existence).
 * Absent / false ⇒ phone button hidden. Never enables memory/none as public.
 */
function truthy(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function isPhoneAuthPublicFlagEnabled(): boolean {
  return truthy(process.env.PHONE_AUTH_PUBLIC_ENABLED);
}

/**
 * True only when intentionally enabled AND a non-local SMS provider is configured.
 * `none` and `memory` never qualify for public UI.
 */
export function isPhoneAuthPubliclyAvailable(smsProviderName: string): boolean {
  if (!isPhoneAuthPublicFlagEnabled()) return false;
  const name = (smsProviderName ?? '').trim().toLowerCase();
  if (!name || name === 'none' || name === 'memory') return false;
  return true;
}
