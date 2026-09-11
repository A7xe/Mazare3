/**
 * Production / NODE_ENV hard-stop for MAZARE3_SHOWCASE_2026 seed & cleanup.
 * Refuses when production is detected. No production bypass flags.
 */
export function assertShowcaseEnvAllowed(scriptName: string): void {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' || appEnv === 'production') {
    console.error(
      `\n❌ Refusing ${scriptName}: production environment detected ` +
        `(NODE_ENV=${process.env.NODE_ENV ?? ''}, APP_ENV=${process.env.APP_ENV ?? ''}).\n` +
        `   Showcase dataset is LOCAL/DEV only.\n`,
    );
    process.exit(1);
  }
}
