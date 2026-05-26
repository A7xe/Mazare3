export class ProviderNotConfiguredError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`Provider "${provider}" is not configured yet`);
    this.name = 'ProviderNotConfiguredError';
    this.provider = provider;
  }
}
