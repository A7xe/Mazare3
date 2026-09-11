'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AuthApiError,
  fetchAuthCapabilities,
  fetchAuthIdentities,
  googleLinkStartUrl,
  startPhoneLinkOtp,
  verifyPhoneLinkOtp,
  type AuthCapabilities,
  type AuthIdentitiesStatus,
} from '@/lib/api-auth';

export function AccountIdentitiesCard() {
  const t = useTranslations('auth');
  const [status, setStatus] = useState<AuthIdentitiesStatus | null>(null);
  const [caps, setCaps] = useState<AuthCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingPhone, setAddingPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [idRes, capRes] = await Promise.all([fetchAuthIdentities(), fetchAuthCapabilities()]);
      setStatus(idRes.data);
      setCaps(capRes.data);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStartPhone() {
    if (acting) return;
    setActing(true);
    setError(null);
    try {
      const res = await startPhoneLinkOtp({ phone: phone.trim() });
      setChallengeId(res.data.challengeId);
    } catch (e) {
      setError(e instanceof AuthApiError ? e.message : t('errorGeneric'));
    } finally {
      setActing(false);
    }
  }

  async function handleVerifyPhone() {
    if (acting || !challengeId) return;
    setActing(true);
    setError(null);
    try {
      await verifyPhoneLinkOtp({ phone: phone.trim(), code: code.trim(), challengeId });
      setAddingPhone(false);
      setChallengeId(null);
      setCode('');
      setPhone('');
      await load();
    } catch (e) {
      setError(e instanceof AuthApiError ? e.message : t('errorGeneric'));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6" data-testid="account-identities-loading">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!status) {
    return (
      <section
        data-testid="account-identities-error"
        className="rounded-3xl border border-danger/20 bg-danger/10 p-5 text-sm text-danger sm:p-6"
        role="alert"
      >
        {error ?? t('errorGeneric')}
      </section>
    );
  }

  const canAddPhone = caps?.phone.available && !status.phone.linked;
  const canAddGoogle = caps?.google.available && !status.google.linked;

  return (
    <section
      data-testid="account-identities"
      className="rounded-3xl border border-primary/12 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-semibold text-navy">{t('identitiesTitle')}</h2>
      {error && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex flex-wrap items-center justify-between gap-2" data-testid="identity-phone">
          <span className="font-medium text-navy">{t('identitiesPhone')}</span>
          <span className="text-muted">
            {status.phone.linked
              ? `${t('identitiesLinked')}${status.phone.masked ? ` · ${status.phone.masked}` : ''}`
              : t('identitiesNotLinked')}
          </span>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2" data-testid="identity-google">
          <span className="font-medium text-navy">{t('identitiesGoogle')}</span>
          <span className="text-muted">
            {status.google.linked ? t('identitiesLinked') : t('identitiesNotLinked')}
          </span>
        </li>
        <li
          className="flex flex-wrap items-center justify-between gap-2"
          data-testid="identity-password"
        >
          <span className="font-medium text-navy">{t('identitiesPassword')}</span>
          <span className="text-muted">
            {status.password.linked
              ? t('identitiesPasswordAvailable')
              : t('identitiesPasswordUnavailable')}
          </span>
        </li>
      </ul>

      {(canAddPhone || canAddGoogle) && (
        <div className="mt-4 space-y-3 border-t border-primary/10 pt-4">
          {canAddPhone && !addingPhone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="identity-add-phone"
              onClick={() => setAddingPhone(true)}
            >
              <Phone className="h-4 w-4" />
              {t('identitiesAddPhone')}
            </Button>
          )}
          {canAddPhone && addingPhone && (
            <div className="space-y-2" data-testid="identity-add-phone-form">
              <Label htmlFor="link-phone">{t('phoneLabel')}</Label>
              <Input
                id="link-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
              {challengeId ? (
                <>
                  <Label htmlFor="link-otp">{t('otpTitle')}</Label>
                  <Input
                    id="link-otp"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={acting}
                    onClick={() => void handleVerifyPhone()}
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t('otpSubmit')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={acting}
                  onClick={() => void handleStartPhone()}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('phoneSubmit')}
                </Button>
              )}
            </div>
          )}
          {canAddGoogle && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="identity-add-google"
              onClick={() => {
                window.location.assign(googleLinkStartUrl('/account'));
              }}
            >
              {t('identitiesAddGoogle')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
