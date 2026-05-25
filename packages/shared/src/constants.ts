export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const USER_ROLES = ['customer', 'owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const API_VERSION = 'v1';

export const AVAILABILITY_PERIODS = ['morning', 'evening', 'full_day', 'overnight'] as const;
export type AvailabilityPeriod = (typeof AVAILABILITY_PERIODS)[number];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'expired'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PROPERTY_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'rating_desc',
  'newest',
] as const;
export type PropertySortOption = (typeof PROPERTY_SORT_OPTIONS)[number];

export const PROPERTY_TYPES = [
  'farm',
  'chalet',
  'villa',
  'istiraha',
  'private_resort',
  'pool_house',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const JORDAN_CITIES = [
  { key: 'amman', labelAr: 'عمان', labelEn: 'Amman' },
  { key: 'salt', labelAr: 'السلط', labelEn: 'Salt' },
  { key: 'jerash', labelAr: 'جرش', labelEn: 'Jerash' },
  { key: 'madaba', labelAr: 'مادبا', labelEn: 'Madaba' },
  { key: 'ajloun', labelAr: 'عجلون', labelEn: 'Ajloun' },
  { key: 'dead_sea', labelAr: 'البحر الميت', labelEn: 'Dead Sea' },
  { key: 'irbid', labelAr: 'إربد', labelEn: 'Irbid' },
  { key: 'zarqa', labelAr: 'الزرقاء', labelEn: 'Zarqa' },
] as const;
