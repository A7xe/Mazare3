export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const USER_ROLES = ['customer', 'owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const API_VERSION = 'v1';

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
