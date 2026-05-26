'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  Shield,
  CalendarCheck,
  Ban,
  CalendarRange,
  Sparkles,
  HeadphonesIcon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getMe } from '@/lib/api-auth';
import { fetchMyOwnerApplication, submitOwnerApplication, OwnerApiError } from '@/lib/api-owner';
import type { OwnerApplicationView, OwnerApplyInput } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

const benefits = [
  { icon: Shield, key: 'secureBooking' },
  { icon: Ban, key: 'reduceFake' },
  { icon: CalendarRange, key: 'availability' },
  { icon: Sparkles, key: 'visibility' },
  { icon: HeadphonesIcon, key: 'support' },
  { icon: CalendarCheck, key: 'noPublicPhone' },
] as const;

export function BecomeOwnerView() {
  const t = useTranslations('becomeOwner');
  const router = useRouter();
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [application, setApplication] = useState<OwnerApplicationView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    businessName: '',
    phone: '',
    city: '',
    area: '',
    bio: '',
    approximateFarmCount: '',
    acceptTerms: false,
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await getMe();
        setLoggedIn(true);
        setRole(res.data.user.role);
        if (res.data.user.role === 'owner' && res.data.user.ownerProfileStatus === 'approved') {
          router.replace('/owner');
          return;
        }
        if (res.data.user.role === 'customer' || res.data.user.role === 'owner') {
          const appRes = await fetchMyOwnerApplication();
          setApplication(appRes.data);
        }
      } catch {
        setLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loggedIn) {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    if (role !== 'customer') {
      setError(t('onlyCustomer'));
      return;
    }
    setSubmitting(true);
    try {
      const payload: OwnerApplyInput = {
        displayName: form.displayName,
        businessName: form.businessName || undefined,
        phone: form.phone,
        city: form.city,
        area: form.area,
        bio: form.bio,
        approximateFarmCount: form.approximateFarmCount
          ? Number(form.approximateFarmCount)
          : undefined,
        acceptTerms: form.acceptTerms as true,
      };
      const res = await submitOwnerApplication(payload);
      setApplication(res.data);
      setSuccess(true);
    } catch (err) {
      if (err instanceof OwnerApiError && err.code === 'APPLICATION_EXISTS') {
        setError(t('applicationExists'));
      } else {
        setError(err instanceof Error ? err.message : t('submitError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="become-owner-page" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('subtitle')}</p>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {benefits.map(({ icon: Icon, key }) => (
          <Card key={key} className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="flex gap-3 p-5">
              <Icon className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-sm text-navy">{t(`benefits.${key}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {application && (application.status === 'pending' || success) && (
        <Card
          data-testid="owner-application-status"
          className="glass-panel mb-8 rounded-2xl border-primary/12"
        >
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-bold text-navy">{t('pendingTitle')}</h2>
            <p className="mt-2 max-w-md text-muted">{t('pendingDesc')}</p>
            <p className="mt-4 text-sm text-muted">
              {t('statusLabel')}: {t(`status.${application.status}`)}
            </p>
          </CardContent>
        </Card>
      )}

      {application?.status === 'rejected' && (
        <p className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {t('rejectedNotice')}
          {application.rejectionReason ? `: ${application.rejectionReason}` : ''}
        </p>
      )}

      {role === 'owner' && application?.status === 'approved' ? null : (
        <Card className="glass-panel overflow-hidden rounded-3xl border-primary/12">
          <div className="gradient-primary h-1" />
          <CardHeader>
            <CardTitle className="text-xl text-navy">{t('formTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!loggedIn ? (
              <div className="space-y-4 text-center">
                <p className="text-muted">{t('loginRequired')}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild className="shadow-soft">
                    <Link href={`/login?returnUrl=${encodeURIComponent(pathname)}`}>
                      {t('login')}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/signup?returnUrl=${encodeURIComponent(pathname)}`}>
                      {t('signup')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : role === 'admin' ? (
              <p className="text-muted">{t('adminNoApply')}</p>
            ) : application?.status === 'pending' && !success ? (
              <p className="text-muted">{t('alreadyPending')}</p>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                {error && (
                  <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('displayName')}</label>
                    <Input
                      required
                      data-testid="owner-apply-displayName"
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('businessName')}</label>
                    <Input
                      value={form.businessName}
                      onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('phone')}</label>
                    <Input
                      required
                      type="tel"
                      dir="ltr"
                      data-testid="owner-apply-phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                    <p className="text-xs text-muted">{t('phoneHint')}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('farmCount')}</label>
                    <Input
                      type="number"
                      min={0}
                      value={form.approximateFarmCount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, approximateFarmCount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('city')}</label>
                    <Input
                      required
                      data-testid="owner-apply-city"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-navy">{t('area')}</label>
                    <Input
                      required
                      data-testid="owner-apply-area"
                      value={form.area}
                      onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-navy">{t('bio')}</label>
                  <textarea
                    required
                    rows={4}
                    data-testid="owner-apply-bio"
                    className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    required
                    data-testid="owner-apply-terms"
                    checked={form.acceptTerms}
                    onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
                    className="mt-1"
                  />
                  <span className="text-muted">{t('terms')}</span>
                </label>
                <Button
                  type="submit"
                  className="w-full shadow-soft sm:w-auto"
                  disabled={submitting}
                  data-testid="owner-apply-submit"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('submit')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
