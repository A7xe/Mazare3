import { AppError } from './errors.js';

export const PARTNER_ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const PDF = Buffer.from('%PDF');
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const RIFF = Buffer.from('RIFF');
const WEBP = Buffer.from('WEBP');

function startsWith(buf: Buffer, sig: Buffer, offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return buf.subarray(offset, offset + sig.length).equals(sig);
}

function looksLikeHtmlOrSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<svg') ||
    (head.startsWith('<?xml') && head.includes('<svg'))
  );
}

function looksLikeArchiveOrExec(buf: Buffer): boolean {
  if (startsWith(buf, Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return true;
  if (startsWith(buf, Buffer.from([0x4d, 0x5a]))) return true;
  if (startsWith(buf, Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return true;
  return false;
}

export function detectPartnerFileMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 8) return null;
  if (looksLikeHtmlOrSvg(buffer) || looksLikeArchiveOrExec(buffer)) return null;
  if (startsWith(buffer, PDF)) return 'application/pdf';
  if (startsWith(buffer, JPEG)) return 'image/jpeg';
  if (startsWith(buffer, PNG)) return 'image/png';
  if (buffer.length >= 12 && startsWith(buffer, RIFF) && startsWith(buffer, WEBP, 8)) return 'image/webp';
  return null;
}

export function sanitizeDisplayFileName(original: string, mime: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? 'document';
  const stripped = base.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF ]+/g, '_').trim().slice(0, 120);
  const ext =
    mime === 'application/pdf'
      ? '.pdf'
      : mime === 'image/jpeg'
        ? '.jpg'
        : mime === 'image/png'
          ? '.png'
          : '.webp';
  const withoutExt = stripped.replace(/\.[a-zA-Z0-9]+$/, '');
  return `${withoutExt || 'document'}${ext}`;
}

export function assertPartnerUploadFile(params: {
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
  maxBytes: number;
}): { mime: string; safeName: string } {
  if (params.buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'File is empty');
  }
  if (params.buffer.length > params.maxBytes) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the configured size limit');
  }
  const detected = detectPartnerFileMime(params.buffer);
  if (!detected) {
    throw new AppError(
      400,
      'FILE_TYPE_REJECTED',
      'Only PDF, JPEG, PNG, and WebP are accepted. SVG, HTML, scripts, archives, and executables are rejected.',
    );
  }
  const declared = (params.declaredMime || '').toLowerCase().split(';')[0]!.trim();
  const declaredOk =
    declared === detected ||
    (detected === 'image/jpeg' && (declared === 'image/jpg' || declared === 'image/jpeg'));
  if (declared && declared !== 'application/octet-stream' && !declaredOk) {
    throw new AppError(400, 'MIME_MISMATCH', 'Declared file type does not match file contents');
  }
  return { mime: detected, safeName: sanitizeDisplayFileName(params.originalName, detected) };
}

export function loadPartnerDocumentMaxBytes(): number {
  const mb = Number(process.env.PARTNER_DOCUMENT_MAX_MB ?? '8');
  const n = Number.isFinite(mb) && mb > 0 ? mb : 8;
  return Math.floor(n * 1024 * 1024);
}

export function loadPartnerDocumentMaxCount(): number {
  const n = Number(process.env.PARTNER_DOCUMENT_MAX_COUNT ?? '24');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 24;
}
