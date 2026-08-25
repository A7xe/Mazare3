'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PropertyPlacementRow } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  activateAdminPlacement,
  createAdminPlacement,
  fetchAdminPlacements,
  pauseAdminPlacement,
} from '@/lib/api-admin';

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.000Z`).toISOString();
}

export function AdminPropertyPlacementsPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('admin');
  const [items, setItems] = useState<PropertyPlacementRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'featured' | 'sponsored'>('sponsored');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const res = await fetchAdminPlacements(propertyId);
    setItems(res.data);
  }, [propertyId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  async function onCreate() {
    setError(null);
    try {
      const created = await createAdminPlacement(propertyId, {
        placementType: type,
        startsAt: toIsoStart(start),
        endsAt: toIsoEnd(end),
        adminNote: note.trim() || null,
      });
      await activateAdminPlacement(propertyId, created.data.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <div className="space-y-3" data-testid="admin-placements">
      <p className="font-medium text-navy">{t('placementsTitle')}</p>
      <p className="text-sm text-muted">{t('placementsHint')}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          data-testid="placement-type"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as 'featured' | 'sponsored')}
        >
          <option value="sponsored">{t('placementSponsored')}</option>
          <option value="featured">{t('placementFeatured')}</option>
        </select>
        <Input
          data-testid="placement-note"
          placeholder={t('placementNote')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Input data-testid="placement-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input data-testid="placement-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <Button type="button" data-testid="placement-create" onClick={() => void onCreate()}>
        {t('placementCreateActivate')}
      </Button>
      <ul className="space-y-2">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            data-testid={`placement-row-${p.placementType}-${p.status}`}
          >
            <span>
              {p.placementType} · {p.status}
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="muted">{p.status}</Badge>
              {p.status === 'active' ? (
                <Button size="sm" variant="outline" onClick={() => void pauseAdminPlacement(propertyId, p.id).then(load)}>
                  {t('placementPause')}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
