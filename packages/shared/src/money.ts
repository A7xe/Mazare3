/**
 * Integer fils helpers (1 JOD = 100 fils). Avoids IEEE float on money math.
 */

export function jodToFils(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function filsToJod(fils: number): number {
  return fils / 100;
}

/** percent is 0–100 (e.g. 30 or 12.5). Result is rounded to nearest fil. */
export function percentOfFils(baseFils: number, percent: number): number {
  if (!Number.isFinite(baseFils) || !Number.isFinite(percent)) return 0;
  return Math.round((baseFils * percent) / 100);
}
