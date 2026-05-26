export const PROPERTY_SLUG = 'chalet-emerald-dead-sea';

export const CUSTOMER_EMAIL = 'customer@mazare3.jo';
export const CUSTOMER_PASSWORD = 'Mazare3Demo2026!';

export const OWNER_EMAIL = 'owner1@mazare3.jo';
export const OWNER_PASSWORD = 'Mazare3Demo2026!';

export const ADMIN_EMAIL = 'admin@mazare3.jo';
export const ADMIN_PASSWORD = 'Mazare3Demo2026!';

export function getApiBase(): string {
  return process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4010/api/v1';
}

/** Arabic UI labels for availability periods (must match messages/ar.json). */
export const PERIOD_LABEL_AR: Record<string, string> = {
  morning: 'صباحي',
  evening: 'مسائي',
  full_day: 'يوم كامل',
  overnight: 'مبيت',
};

export const SLOT_UNAVAILABLE_AR = 'هذه الفترة لم تعد متاحة';
