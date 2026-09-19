'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AUTHORITY_ATTESTATION_CORPUS_VERSION,
  PROPERTY_AUTHORITY_BASES,
  DECLARED_PROPERTY_OWNER_RELATIONS,
  requiredAuthorityDocumentTypesForBasis,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import {
  attestPropertyAuthority,
  fetchPropertyAuthority,
  listOperatorParties,
  patchPropertyAuthority,
  uploadPropertyAuthorityDocument,
  upsertOperatorParty,
  type OperatorPartyView,
  type PropertyAuthorityPackage,
  OwnerApiError,
} from '@/lib/api-owner';

type Props = {
  propertyId: string;
  onPackageChange?: (pkg: PropertyAuthorityPackage) => void;
};

export function PropertyAuthorityPanel({ propertyId, onPackageChange }: Props) {
  const t = useTranslations('addFarm.authority');
  const [pkg, setPkg] = useState<PropertyAuthorityPackage | null>(null);
  const [parties, setParties] = useState<OperatorPartyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [basis, setBasis] = useState<string>('');
  const [ownerRelation, setOwnerRelation] = useState<string>('same_as_contracting_operator');
  const [contractingId, setContractingId] = useState<string>('');
  const [declaredOwnerId, setDeclaredOwnerId] = useState<string>('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyKind, setNewPartyKind] = useState<OperatorPartyView['entityKind']>('individual');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [authRes, partyRes] = await Promise.all([
        fetchPropertyAuthority(propertyId),
        listOperatorParties(),
      ]);
      setPkg(authRes.data);
      setParties(partyRes.data);
      setBasis(authRes.data.authorityBasis ?? '');
      setOwnerRelation(
        authRes.data.declaredPropertyOwnerRelation ?? 'same_as_contracting_operator',
      );
      setContractingId(authRes.data.contractingOperator?.id ?? '');
      setDeclaredOwnerId(authRes.data.declaredPropertyOwner?.id ?? '');
      setAttested(Boolean(authRes.data.authorityAttestedAt));
      onPackageChange?.(authRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [propertyId, onPackageChange, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveAuthority() {
    setSaving(true);
    setError(null);
    try {
      let contracting = contractingId;
      if (!contracting && parties.length === 0 && newPartyName.trim()) {
        const created = await upsertOperatorParty({
          entityKind: newPartyKind,
          legalName: newPartyName.trim(),
          isDefaultContractingOperator: true,
        });
        contracting = created.data.id;
        setParties((p) => [...p, created.data]);
        setContractingId(contracting);
      }
      if (!contracting) {
        setError(t('needContractingOperator'));
        setSaving(false);
        return;
      }
      const res = await patchPropertyAuthority(propertyId, {
        contractingOperatorPartyId: contracting,
        declaredPropertyOwnerRelation: ownerRelation,
        declaredPropertyOwnerPartyId:
          ownerRelation === 'same_as_contracting_operator' ? null : declaredOwnerId || null,
        authorityBasis: basis || undefined,
      });
      setPkg(res.data);
      onPackageChange?.(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onAttest() {
    setSaving(true);
    setError(null);
    try {
      await saveAuthority();
      const res = await attestPropertyAuthority(propertyId, 'addFarm.authority');
      setPkg(res.data);
      setAttested(true);
      onPackageChange?.(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('attestError'));
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file || !basis) return;
    const types = requiredAuthorityDocumentTypesForBasis(
      basis as (typeof PROPERTY_AUTHORITY_BASES)[number],
    );
    const documentType = types[0] ?? 'other';
    setSaving(true);
    setError(null);
    try {
      const res = await uploadPropertyAuthorityDocument(propertyId, file, documentType);
      setPkg(res.data);
      onPackageChange?.(res.data);
    } catch (e) {
      if (e instanceof OwnerApiError && e.code === 'MISSING_PRIOR_CONSENT') {
        setError(t('needKycConsent'));
      } else {
        setError(e instanceof Error ? e.message : t('uploadError'));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t('loading')}</p>;
  }

  return (
    <section
      className="mt-6 space-y-4 rounded-xl border border-[#E8E2D6] bg-[#FBF9F5] p-4"
      data-testid="property-authority-panel"
    >
      <div>
        <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
        <p className="mt-1 text-sm text-[#5C6578]">{t('subtitle')}</p>
        <p className="mt-1 text-xs text-[#8A8490]">{t('notVerifiedTitle')}</p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-[#0D2046]">{t('listingFor')}</span>
          <select
            className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
            value={newPartyKind}
            onChange={(e) =>
              setNewPartyKind(e.target.value as OperatorPartyView['entityKind'])
            }
            data-testid="authority-entity-kind"
          >
            <option value="individual">{t('kindIndividual')}</option>
            <option value="sole_establishment">{t('kindSole')}</option>
            <option value="legal_entity">{t('kindEntity')}</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-[#0D2046]">{t('contractingOperator')}</span>
          {parties.length > 0 ? (
            <select
              className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
              value={contractingId}
              onChange={(e) => setContractingId(e.target.value)}
              data-testid="authority-contracting"
            >
              <option value="">{t('selectParty')}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.legalName} ({p.entityKind})
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              placeholder={t('partyNamePlaceholder')}
              data-testid="authority-new-party-name"
            />
          )}
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-[#0D2046]">{t('doYouOwn')}</span>
          <select
            className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
            value={ownerRelation}
            onChange={(e) => setOwnerRelation(e.target.value)}
            data-testid="authority-owner-relation"
          >
            {DECLARED_PROPERTY_OWNER_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`ownerRelation.${r}`)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[#8A8490]">{t('declaredOwnerHint')}</span>
        </label>

        {ownerRelation !== 'same_as_contracting_operator' ? (
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-[#0D2046]">{t('declaredOwnerParty')}</span>
            <select
              className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
              value={declaredOwnerId}
              onChange={(e) => setDeclaredOwnerId(e.target.value)}
              data-testid="authority-declared-owner"
            >
              <option value="">{t('selectParty')}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.legalName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-[#0D2046]">{t('authorityBasis')}</span>
          <select
            className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            data-testid="authority-basis"
          >
            <option value="">{t('selectBasis')}</option>
            {PROPERTY_AUTHORITY_BASES.map((b) => (
              <option key={b} value={b}>
                {t(`basis.${b}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[#0D2046]">{t('supportingDocs')}</p>
        <p className="text-xs text-[#8A8490]">{t('docsPrivate')}</p>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
          data-testid="authority-evidence-upload"
        />
        {pkg?.evidence?.length ? (
          <ul className="text-xs text-[#5C6578]">
            {pkg.evidence.map((d) => (
              <li key={d.id}>
                {d.documentType}: {d.originalFileName}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm text-[#0D2046]">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => {
            if (e.target.checked) void onAttest();
          }}
          data-testid="authority-attestation"
        />
        <span>
          {t('attestation')}
          <span className="mt-1 block text-xs text-[#8A8490]">
            {t('attestationVersion', { version: AUTHORITY_ATTESTATION_CORPUS_VERSION })}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => void saveAuthority()}>
          {t('save')}
        </Button>
        {pkg ? (
          <span className="text-xs text-[#5C6578]" data-testid="authority-status">
            {t('status')}: {t(`statusValue.${pkg.authorityReviewStatus}`)}
            {pkg.canSubmitAuthorityPackage ? ` · ${t('packageReady')}` : ` · ${t('packageIncomplete')}`}
          </span>
        ) : null}
      </div>
    </section>
  );
}
