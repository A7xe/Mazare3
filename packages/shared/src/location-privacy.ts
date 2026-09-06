/** Keys that must never appear on public/anonymous/browse property payloads. */
export const EXACT_LOCATION_PAYLOAD_KEYS = [
  'exactAddress',
  'latitudeExact',
  'longitudeExact',
  'arrivalInstructionsAr',
  'arrivalInstructionsEn',
] as const;

export type ExactLocationPayloadKey = (typeof EXACT_LOCATION_PAYLOAD_KEYS)[number];

export const MAX_ARRIVAL_INSTRUCTIONS_LENGTH = 2000;

const REVEAL_PAYMENT_STATES = new Set([
  'deposit_paid',
  'balance_pending',
  'fully_paid',
  'balance_overdue',
  'partially_refunded',
]);

const HIDE_PAYMENT_STATES = new Set(['unpaid', 'deposit_pending', 'refunded']);

export type ExactLocationRevealInput = {
  status: string;
  paymentState?: string | null;
  hasSucceededPayment?: boolean;
};

/**
 * Exact address, exact coordinates, and arrival instructions are revealed only to the
 * customer who owns a booking that is confirmed after a successful deposit/full payment.
 * Partial refund does not hide arrival while the booking remains confirmed and valid.
 */
export function canRevealExactLocation(input: ExactLocationRevealInput): boolean {
  if (input.status !== 'confirmed') return false;
  const paymentState = input.paymentState ?? null;
  if (paymentState && HIDE_PAYMENT_STATES.has(paymentState)) return false;
  if (paymentState && REVEAL_PAYMENT_STATES.has(paymentState)) return true;
  return input.hasSucceededPayment === true;
}

export function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidLatitude(value: number): boolean {
  return isFiniteCoordinate(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return isFiniteCoordinate(value) && value >= -180 && value <= 180;
}

/** ~2.2 km grid at the equator. Used only to derive a public approximate pin. */
export const APPROXIMATION_GRID_DEGREES = 0.02;
/** Extra offset so the approximate pin is never a copy of the exact pin. */
export const APPROXIMATION_NUDGE_DEGREES = 0.015;

export function formatCoordinateInput(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * Deterministic coarse approximation for owner UX.
 * Does not copy exact coordinates. Existing approximate fields stay authoritative until saved.
 */
export function approximateCoordsFromExact(
  latitudeExact: number,
  longitudeExact: number,
): { latitudeApprox: number; longitudeApprox: number } | null {
  if (!isValidLatitude(latitudeExact) || !isValidLongitude(longitudeExact)) return null;
  const snap = (n: number) => Math.round(n / APPROXIMATION_GRID_DEGREES) * APPROXIMATION_GRID_DEGREES;
  let latitudeApprox = Number((snap(latitudeExact) + APPROXIMATION_NUDGE_DEGREES).toFixed(5));
  let longitudeApprox = Number((snap(longitudeExact) - APPROXIMATION_NUDGE_DEGREES).toFixed(5));
  latitudeApprox = Math.min(90, Math.max(-90, latitudeApprox));
  longitudeApprox = Math.min(180, Math.max(-180, longitudeApprox));
  if (latitudeApprox === latitudeExact && longitudeApprox === longitudeExact) {
    latitudeApprox = Number(Math.min(90, latitudeExact + APPROXIMATION_NUDGE_DEGREES).toFixed(5));
    longitudeApprox = Number(Math.max(-180, longitudeExact - APPROXIMATION_NUDGE_DEGREES).toFixed(5));
  }
  return { latitudeApprox, longitudeApprox };
}

function formatCoord(value: number): string {
  return String(Number(value.toFixed(6)));
}

/** Standard Google Maps directions URL. No API key. Returns null when coords are missing/invalid. */
export function buildGoogleMapsDirectionsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return null;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${formatCoord(latitude)},${formatCoord(longitude)}`;
}

export type PublicLocationView = {
  city: string;
  area: string;
  approximateLocation: string;
  latitudeApprox: number | null;
  longitudeApprox: number | null;
};

export function toPublicLocation(property: {
  city: string | null;
  area: string | null;
  approximateAddress: string | null;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
}): PublicLocationView {
  return {
    city: property.city?.trim() || '',
    area: property.area?.trim() || '',
    approximateLocation: property.approximateAddress?.trim() || '',
    latitudeApprox: isFiniteCoordinate(property.latitudeApprox) ? property.latitudeApprox : null,
    longitudeApprox: isFiniteCoordinate(property.longitudeApprox) ? property.longitudeApprox : null,
  };
}

export type BookingArrivalView = {
  exactAddress: string | null;
  arrivalInstructionsAr: string | null;
  arrivalInstructionsEn: string | null;
  latitudeExact: number | null;
  longitudeExact: number | null;
  googleMapsDirectionsUrl: string | null;
};

export function toBookingArrival(property: {
  exactAddress?: string | null;
  arrivalInstructionsAr?: string | null;
  arrivalInstructionsEn?: string | null;
  latitudeExact?: number | null;
  longitudeExact?: number | null;
}): BookingArrivalView {
  const latitudeExact = isFiniteCoordinate(property.latitudeExact) ? property.latitudeExact : null;
  const longitudeExact = isFiniteCoordinate(property.longitudeExact) ? property.longitudeExact : null;
  return {
    exactAddress: property.exactAddress?.trim() ? property.exactAddress : null,
    arrivalInstructionsAr: property.arrivalInstructionsAr?.trim()
      ? property.arrivalInstructionsAr
      : null,
    arrivalInstructionsEn: property.arrivalInstructionsEn?.trim()
      ? property.arrivalInstructionsEn
      : null,
    latitudeExact,
    longitudeExact,
    googleMapsDirectionsUrl: buildGoogleMapsDirectionsUrl(latitudeExact, longitudeExact),
  };
}

export function collectExactLocationLeaks(
  value: unknown,
  path = '',
  hits: string[] = [],
): string[] {
  if (value == null || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectExactLocationLeaks(item, `${path}[${i}]`, hits));
    return hits;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if ((EXACT_LOCATION_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      hits.push(next);
    }
    collectExactLocationLeaks(nested, next, hits);
  }
  return hits;
}
