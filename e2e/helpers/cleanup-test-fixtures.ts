/**
 * Fixture ownership rule for marketplace merchandising tests:
 *
 *   create → track IDs → exercise UI/API → finally dispose tracked IDs only
 *
 * Tests must NEVER pause/unpublish/mutate unrelated pre-existing marketplace
 * placements, promotions, or properties to isolate assertions.
 */
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getApiBase,
} from '../constants.js';
import { loginViaApi } from './api.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/**
 * Removes fixtures from the *customer-visible* marketplace by unpublishing
 * and pausing live placements on the given property IDs only.
 *
 * Safe for finally/afterEach: best-effort, does not throw on already-cleaned rows.
 */
export async function unpublishTestProperties(propertyIds: string[]): Promise<void> {
  const unique = [...new Set(propertyIds.filter(Boolean))];
  if (!unique.length) return;

  const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

  for (const id of unique) {
    try {
      const placements = await api(admin, 'GET', `/admin/properties/${id}/placements`);
      const rows = Array.isArray(placements.json?.data) ? placements.json.data : [];
      for (const row of rows) {
        if (row?.status === 'active' && row?.id) {
          await api(admin, 'POST', `/admin/properties/${id}/placements/${row.id}/pause`);
        }
      }
    } catch {
      /* best-effort */
    }

    try {
      const detail = await api(admin, 'GET', `/admin/properties/${id}`);
      const status = detail.json?.data?.status as string | undefined;
      if (status === 'published') {
        await api(admin, 'PATCH', `/admin/properties/${id}/status`, { status: 'unpublished' });
      }
    } catch {
      /* best-effort */
    }
  }
}

/** Tracks created property IDs and always cleans them in `dispose()` (for try/finally). */
export class TestPropertyFixtureTracker {
  private readonly ids: string[] = [];

  track(id: string | undefined | null): void {
    if (id) this.ids.push(id);
  }

  trackMany(items: Array<{ id: string } | string>): void {
    for (const item of items) {
      this.track(typeof item === 'string' ? item : item.id);
    }
  }

  get trackedIds(): readonly string[] {
    return this.ids;
  }

  async dispose(): Promise<void> {
    const snapshot = [...this.ids];
    this.ids.length = 0;
    await unpublishTestProperties(snapshot);
  }
}
