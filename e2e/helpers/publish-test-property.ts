import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from '../constants.js';
import { loginViaApi } from './api.js';
import { QA_FARM_IMAGES } from './farm-images.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function allWeekRules() {
  const periods = [
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 175 },
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 240 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

export type PublishTestPropertyInput = {
  titleEn: string;
  titleAr?: string;
  basePrice?: number;
  area?: string;
  descriptionAr?: string;
  descriptionEn?: string;
};

/** Creates a property and publishes it through the valid PR-4 FSM (submit → approve → publish). */
export async function createAndPublishTestProperty(
  input: PublishTestPropertyInput,
): Promise<{ id: string; slug: string; owner: string }> {
  const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
  const stamp = Date.now();
  const created = await api(owner, 'POST', '/owner/properties', {
    type: 'farm',
    titleAr: input.titleAr ?? `مزرعة ${input.titleEn}`,
    titleEn: input.titleEn,
    descriptionAr: input.descriptionAr ?? 'وصف تجريبي لاختبار النشر عبر FSM صالح.',
    descriptionEn: input.descriptionEn ?? 'Playwright test property for valid publish lifecycle.',
    city: 'amman',
    area: input.area ?? `e2e-${stamp}`,
    approximateAddress: 'عمان — اختبار',
    exactAddress: 'عنوان مخفي',
    basePrice: input.basePrice ?? 175,
    capacity: 20,
    imageUrls: QA_FARM_IMAGES.slice(0, 3),
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) {
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json.data.id as string;
  const slug = created.json.data.slug as string;
  await api(owner, 'PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api(owner, 'POST', `/owner/properties/${id}/availability/generate`, {});
  await api(owner, 'POST', `/owner/properties/${id}/submit-review`);
  const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  const approved = await api(admin, 'PATCH', `/admin/properties/${id}/status`, { status: 'approved' });
  if (approved.status !== 200) {
    throw new Error(`approve failed ${approved.status} ${JSON.stringify(approved.json)}`);
  }
  const pub = await api(admin, 'PATCH', `/admin/properties/${id}/status`, { status: 'published' });
  if (pub.status !== 200) {
    throw new Error(`publish failed ${pub.status} ${JSON.stringify(pub.json)}`);
  }
  return { id, slug, owner };
}

/** Ensures a property reaches published via valid PR-4 transitions when possible. */
export async function ensureTestPropertyPublished(propertyId: string): Promise<void> {
  const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  const detail = await api(admin, 'GET', `/admin/properties/${propertyId}`);
  const status = detail.json.data?.status as string | undefined;
  if (status === 'pending_review') {
    const approved = await api(admin, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'approved',
    });
    if (approved.status !== 200) {
      throw new Error(`approve failed ${approved.status}`);
    }
  }
  const refreshed = await api(admin, 'GET', `/admin/properties/${propertyId}`);
  const next = refreshed.json.data?.status as string | undefined;
  if (next === 'approved' || next === 'unpublished') {
    const pub = await api(admin, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    if (pub.status !== 200) {
      throw new Error(`publish failed ${pub.status}`);
    }
  }
}
