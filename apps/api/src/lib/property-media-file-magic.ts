import { AppError } from './errors.js';

export const PROPERTY_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PropertyImageMime = (typeof PROPERTY_IMAGE_MIMES)[number];

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

export function detectPropertyImageMime(buffer: Buffer): PropertyImageMime | null {
  if (!buffer || buffer.length < 8) return null;
  if (looksLikeHtmlOrSvg(buffer) || looksLikeArchiveOrExec(buffer)) return null;
  if (startsWith(buffer, JPEG)) return 'image/jpeg';
  if (startsWith(buffer, PNG)) return 'image/png';
  if (buffer.length >= 12 && startsWith(buffer, RIFF) && startsWith(buffer, WEBP, 8)) {
    return 'image/webp';
  }
  return null;
}

export function extForPropertyImageMime(mime: PropertyImageMime): '.jpg' | '.png' | '.webp' {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

export function assertPropertyImageUpload(params: {
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
  maxBytes: number;
  allowedMimes: string[];
}): { mime: PropertyImageMime } {
  if (params.buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'File is empty');
  }
  if (params.buffer.length > params.maxBytes) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the configured size limit');
  }

  const original = params.originalName.replace(/\\/g, '/');
  if (original.includes('..') || original.includes('\0')) {
    throw new AppError(400, 'INVALID_FILE_NAME', 'Invalid file name');
  }

  const detected = detectPropertyImageMime(params.buffer);
  if (!detected || !params.allowedMimes.includes(detected)) {
    throw new AppError(
      400,
      'FILE_TYPE_REJECTED',
      'Only JPEG, PNG, and WebP images are accepted. SVG, HTML, scripts, archives, and executables are rejected.',
    );
  }

  const declared = (params.declaredMime || '').toLowerCase().split(';')[0]!.trim();
  const declaredOk =
    declared === detected ||
    (detected === 'image/jpeg' && (declared === 'image/jpg' || declared === 'image/jpeg'));
  if (declared && declared !== 'application/octet-stream' && !declaredOk) {
    throw new AppError(400, 'MIME_MISMATCH', 'Declared file type does not match file contents');
  }

  return { mime: detected };
}
