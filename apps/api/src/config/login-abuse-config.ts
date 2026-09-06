/**
 * AUTH-4 — account/identifier-aware login abuse thresholds.
 * Temporary cooldowns only. Never permanent lockout.
 */

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Failures within the active window before a cooldown starts. */
export const LOGIN_ABUSE_FAIL_THRESHOLD = parsePositiveInt(
  process.env.LOGIN_ABUSE_FAIL_THRESHOLD,
  5,
);

/** Base temporary cooldown after crossing the soft threshold (ms). Default 5 minutes. */
export const LOGIN_ABUSE_COOLDOWN_MS = parsePositiveInt(
  process.env.LOGIN_ABUSE_COOLDOWN_MS,
  5 * 60 * 1000,
);

/** Extended temporary cooldown after continued failures (ms). Default 15 minutes. */
export const LOGIN_ABUSE_EXTENDED_COOLDOWN_MS = parsePositiveInt(
  process.env.LOGIN_ABUSE_EXTENDED_COOLDOWN_MS,
  15 * 60 * 1000,
);

/** Maximum temporary cooldown (ms). Default 30 minutes. */
export const LOGIN_ABUSE_MAX_COOLDOWN_MS = parsePositiveInt(
  process.env.LOGIN_ABUSE_MAX_COOLDOWN_MS,
  30 * 60 * 1000,
);

/** Failure count that escalates to extended cooldown. */
export const LOGIN_ABUSE_EXTENDED_THRESHOLD = parsePositiveInt(
  process.env.LOGIN_ABUSE_EXTENDED_THRESHOLD,
  10,
);

/** Failure count that escalates to max cooldown. */
export const LOGIN_ABUSE_MAX_THRESHOLD = parsePositiveInt(
  process.env.LOGIN_ABUSE_MAX_THRESHOLD,
  15,
);

/** How long failure state remains before lazy expiry/reset (ms). Default 2 hours. */
export const LOGIN_ABUSE_STATE_TTL_MS = parsePositiveInt(
  process.env.LOGIN_ABUSE_STATE_TTL_MS,
  2 * 60 * 60 * 1000,
);

export function cooldownMsForFailCount(failCount: number): number | null {
  if (failCount >= LOGIN_ABUSE_MAX_THRESHOLD) return LOGIN_ABUSE_MAX_COOLDOWN_MS;
  if (failCount >= LOGIN_ABUSE_EXTENDED_THRESHOLD) return LOGIN_ABUSE_EXTENDED_COOLDOWN_MS;
  if (failCount >= LOGIN_ABUSE_FAIL_THRESHOLD) return LOGIN_ABUSE_COOLDOWN_MS;
  return null;
}
