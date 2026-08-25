/**
 * Application environment (deployment target).
 * Distinct from NODE_ENV (Node/Next build optimization).
 *
 * - APP_ENV=local    — developer machine
 * - APP_ENV=staging  — hosted trial (test provider OK, HTTPS cookies)
 * - APP_ENV=production — live site (real PSP required)
 */
export const APP_ENVS = ['local', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export function getAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if ((APP_ENVS as readonly string[]).includes(raw)) {
    return raw as AppEnv;
  }
  // Backward compatibility when APP_ENV is unset
  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    return 'production';
  }
  return 'local';
}

export function isAppEnvLocal(): boolean {
  return getAppEnv() === 'local';
}

export function isAppEnvStaging(): boolean {
  return getAppEnv() === 'staging';
}

export function isAppEnvProduction(): boolean {
  return getAppEnv() === 'production';
}

/** local or staging — trial payments / simulate allowed */
export function isNonProductionAppEnv(): boolean {
  const env = getAppEnv();
  return env === 'local' || env === 'staging';
}
