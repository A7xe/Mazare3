import { listMissingPropertyListingFields } from '@mazare3/shared';
import { AppError } from './errors.js';

/** Reject incomplete drafts from submit-review / publish after AF-1.1b nullables. */
export function assertPropertyListingComplete(property: {
  city?: string | null;
  area?: string | null;
  approximateAddress?: string | null;
  exactAddress?: string | null;
  basePrice?: { toNumber(): number } | number | null;
}): void {
  const basePrice =
    property.basePrice == null
      ? null
      : typeof property.basePrice === 'number'
        ? property.basePrice
        : property.basePrice.toNumber();
  const missing = listMissingPropertyListingFields({
    city: property.city,
    area: property.area,
    approximateAddress: property.approximateAddress,
    exactAddress: property.exactAddress,
    basePrice,
  });
  if (missing.length) {
    throw new AppError(
      400,
      'PROPERTY_LISTING_INCOMPLETE',
      `Complete required listing fields before continuing: ${missing.join(', ')}`,
      { missing },
    );
  }
}
