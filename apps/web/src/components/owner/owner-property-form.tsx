'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  AMENITY_KEYS,
  PROPERTY_TYPES,
  type CreateOwnerPropertyInput,
  type OwnerPropertyEdit,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createOwnerProperty,
  submitOwnerPropertyReview,
  updateOwnerProperty,
  OwnerApiError,
} from '@/lib/api-owner';

type Props = {
  mode: 'create' | 'edit';
  initial?: OwnerPropertyEdit;
};

const emptyRule = { titleAr: '', titleEn: '' };

export function OwnerPropertyForm({ mode, initial }: Props) {
  const t = useTranslations('ownerProperty');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: initial?.type ?? 'farm',
    titleAr: initial?.titleAr ?? '',
    titleEn: initial?.titleEn ?? '',
    descriptionAr: initial?.descriptionAr ?? '',
    descriptionEn: initial?.descriptionEn ?? '',
    city: initial?.city ?? '',
    area: initial?.area ?? '',
    approximateAddress: initial?.approximateAddress ?? '',
    exactAddress: initial?.exactAddress ?? '',
    basePrice: initial ? String(initial.basePrice) : '',
    capacity: initial ? String(initial.capacity) : '10',
    allowsOvernight: initial?.allowsOvernight ?? true,
    allowsFamilies: initial?.allowsFamilies ?? true,
    allowsYouth: initial?.allowsYouth ?? false,
    poolsCount: initial ? String(initial.poolsCount) : '0',
    amenityKeys: initial?.amenityKeys ?? ([] as string[]),
    imageUrls: initial?.imageUrls?.length ? initial.imageUrls : [''],
    rules: initial?.rules?.length
      ? initial.rules.map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn ?? '' }))
      : [emptyRule],
  });

  function buildPayload(): CreateOwnerPropertyInput {
    const urls = form.imageUrls.map((u) => u.trim()).filter(Boolean);
    if (!urls.length) throw new Error(t('imagesRequired'));
    return {
      type: form.type as CreateOwnerPropertyInput['type'],
      titleAr: form.titleAr,
      titleEn: form.titleEn || undefined,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn || undefined,
      city: form.city,
      area: form.area,
      approximateAddress: form.approximateAddress,
      exactAddress: form.exactAddress,
      basePrice: Number(form.basePrice),
      capacity: Number(form.capacity),
      allowsOvernight: form.allowsOvernight,
      allowsFamilies: form.allowsFamilies,
      allowsYouth: form.allowsYouth,
      poolsCount: Number(form.poolsCount) || 0,
      amenityKeys: form.amenityKeys,
      imageUrls: urls,
      rules: form.rules
        .filter((r) => r.titleAr.trim())
        .map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn || undefined })),
    };
  }

  async function handleSave(submitReview: boolean) {
    setError(null);
    setSaving(true);
    try {
      const payload = buildPayload();
      let propertyId = initial?.id;
      if (mode === 'create') {
        const res = await createOwnerProperty(payload);
        propertyId = res.data.id;
      } else if (initial) {
        await updateOwnerProperty(initial.id, payload);
      }
      if (submitReview && propertyId) {
        await submitOwnerPropertyReview(propertyId);
      }
      router.push('/owner/properties');
      router.refresh();
    } catch (e) {
      if (e instanceof OwnerApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmitReview =
    !initial || initial.status === 'draft' || initial.status === 'changes_requested';

  return (
    <div data-testid="owner-property-form" className="space-y-6">
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      )}
      {initial && (
        <p className="text-sm text-muted">
          {t('currentStatus')}: <span className="font-medium text-navy">{initial.status}</span>
        </p>
      )}

      <div className="glass-panel space-y-4 rounded-2xl border-primary/12 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('type')}</label>
            <select
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t(`propertyType.${pt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('basePrice')}</label>
            <Input
              type="number"
              min={1}
              required
              value={form.basePrice}
              onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('titleAr')}</label>
            <Input
              required
              value={form.titleAr}
              onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('titleEn')}</label>
            <Input
              value={form.titleEn}
              onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('descriptionAr')}</label>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              value={form.descriptionAr}
              onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('descriptionEn')}</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              value={form.descriptionEn}
              onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('city')}</label>
            <Input
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('area')}</label>
            <Input
              required
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('approximateAddress')}</label>
            <Input
              required
              value={form.approximateAddress}
              onChange={(e) => setForm((f) => ({ ...f, approximateAddress: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('exactAddress')}</label>
            <Input
              required
              value={form.exactAddress}
              onChange={(e) => setForm((f) => ({ ...f, exactAddress: e.target.value }))}
            />
            <p className="text-xs text-muted">{t('exactAddressHint')}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('capacity')}</label>
            <Input
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('poolsCount')}</label>
            <Input
              type="number"
              min={0}
              value={form.poolsCount}
              onChange={(e) => setForm((f) => ({ ...f, poolsCount: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsOvernight}
              onChange={(e) => setForm((f) => ({ ...f, allowsOvernight: e.target.checked }))}
            />
            {t('allowsOvernight')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsFamilies}
              onChange={(e) => setForm((f) => ({ ...f, allowsFamilies: e.target.checked }))}
            />
            {t('allowsFamilies')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsYouth}
              onChange={(e) => setForm((f) => ({ ...f, allowsYouth: e.target.checked }))}
            />
            {t('allowsYouth')}
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-navy">{t('amenities')}</p>
          <div className="flex flex-wrap gap-2">
            {AMENITY_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.amenityKeys.includes(key)}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      amenityKeys: e.target.checked
                        ? [...f.amenityKeys, key]
                        : f.amenityKeys.filter((k) => k !== key),
                    }));
                  }}
                />
                {t(`amenity.${key}`)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-navy">{t('imageUrls')}</p>
          {form.imageUrls.map((url, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <Input
                placeholder="https://..."
                value={url}
                onChange={(e) => {
                  const next = [...form.imageUrls];
                  next[i] = e.target.value;
                  setForm((f) => ({ ...f, imageUrls: next }));
                }}
              />
              {form.imageUrls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      imageUrls: f.imageUrls.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ''] }))}
          >
            <Plus className="h-4 w-4" />
            {t('addImage')}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-navy">{t('rules')}</p>
          {form.rules.map((rule, i) => (
            <div key={i} className="mb-3 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder={t('ruleAr')}
                value={rule.titleAr}
                onChange={(e) => {
                  const next = [...form.rules];
                  next[i] = { ...next[i]!, titleAr: e.target.value };
                  setForm((f) => ({ ...f, rules: next }));
                }}
              />
              <Input
                placeholder={t('ruleEn')}
                value={rule.titleEn}
                onChange={(e) => {
                  const next = [...form.rules];
                  next[i] = { ...next[i]!, titleEn: e.target.value };
                  setForm((f) => ({ ...f, rules: next }));
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, rules: [...f.rules, emptyRule] }))}
          >
            <Plus className="h-4 w-4" />
            {t('addRule')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          className="shadow-soft"
          disabled={saving}
          onClick={() => void handleSave(false)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveDraft')}
        </Button>
        {canSubmitReview && (
          <Button
            variant="default"
            className="shadow-soft"
            disabled={saving}
            data-testid="owner-property-submit-review"
            onClick={() => void handleSave(true)}
          >
            {t('submitReview')}
          </Button>
        )}
      </div>
    </div>
  );
}
