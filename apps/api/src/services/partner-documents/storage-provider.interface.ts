export type PartnerDocumentObject = {
  storageKey: string;
  mimeType: string;
  body: Buffer;
};

export interface PartnerDocumentStorage {
  readonly providerName: 'local_private' | 's3_private' | 'cloudflare_r2_private' | 'memory';
  put(object: PartnerDocumentObject): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}
