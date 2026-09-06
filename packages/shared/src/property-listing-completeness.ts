/**
 * Listing completeness for submit-review / publish gates.
 * Separate from draft persistence: drafts may omit location/price;
 * review and publication must not.
 */

export type PropertyListingCompletenessInput = {
  city?: string | null;
  area?: string | null;
  approximateAddress?: string | null;
  exactAddress?: string | null;
  basePrice?: number | null;
};

function nonEmpty(value: string | null | undefined, min = 1): boolean {
  return Boolean(value && value.trim().length >= min);
}

export function isPropertyListingLocationComplete(
  input: PropertyListingCompletenessInput,
): boolean {
  return (
    nonEmpty(input.city, 2) &&
    nonEmpty(input.area, 2) &&
    nonEmpty(input.approximateAddress, 5) &&
    nonEmpty(input.exactAddress, 5)
  );
}

export function isPropertyListingPricingComplete(
  input: PropertyListingCompletenessInput,
): boolean {
  return typeof input.basePrice === 'number' && Number.isFinite(input.basePrice) && input.basePrice > 0;
}

/** Fields required before submit-review / publish (location + price). */
export function isPropertyListingCoreComplete(
  input: PropertyListingCompletenessInput,
): boolean {
  return isPropertyListingLocationComplete(input) && isPropertyListingPricingComplete(input);
}

export type PropertyListingMissingField =
  | 'city'
  | 'area'
  | 'approximateAddress'
  | 'exactAddress'
  | 'basePrice';

export function listMissingPropertyListingFields(
  input: PropertyListingCompletenessInput,
): PropertyListingMissingField[] {
  const missing: PropertyListingMissingField[] = [];
  if (!nonEmpty(input.city, 2)) missing.push('city');
  if (!nonEmpty(input.area, 2)) missing.push('area');
  if (!nonEmpty(input.approximateAddress, 5)) missing.push('approximateAddress');
  if (!nonEmpty(input.exactAddress, 5)) missing.push('exactAddress');
  if (!isPropertyListingPricingComplete(input)) missing.push('basePrice');
  return missing;
}
