'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Camera,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Save,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { AccountIdentitiesCard } from '@/components/account/account-identities-card';
import { DEFAULT_PROFILE_AVATAR } from '@/components/layout/authenticated-top-header';
import {
  AuthApiError,
  fetchAuthIdentities,
  forgotPassword,
  getMe,
  type AuthUser,
} from '@/lib/api-auth';
import { cn } from '@/lib/utils';

const fieldClass =
  'h-11 w-full rounded-xl border border-[#E4EAF3] bg-[#F8FAFC] pe-4 ps-10 text-sm text-[#0D2046] outline-none';

function resolveUserAvatarUrl(user: AuthUser): string | null {
  const extended = user as AuthUser & { avatarUrl?: string | null; imageUrl?: string | null };
  const raw = (extended.avatarUrl ?? extended.imageUrl)?.trim();
  return raw || null;
}

export function AccountProfileView() {
  const t = useTranslations('accountHome');
  const tp = useTranslations('accountHome.profileEdit');
  const locale = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me.data.user);
      try {
        const idRes = await fetchAuthIdentities();
        setPhoneMasked(idRes.data.phone.linked ? idRes.data.phone.masked : null);
      } catch {
        setPhoneMasked(null);
      }
    } catch {
      router.push('/auth?returnUrl=' + encodeURIComponent('/account/profile'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = user?.name?.trim() || t('empty');
  const displayEmail = user?.email?.trim() || t('empty');
  const customAvatar = user ? resolveUserAvatarUrl(user) : null;
  const avatarSrc = customAvatar || DEFAULT_PROFILE_AVATAR;

  async function handlePasswordReset() {
    if (!user?.email || resetBusy) return;
    setResetBusy(true);
    setResetErr(null);
    setResetMsg(null);
    try {
      await forgotPassword({ email: user.email });
      setResetMsg(tp('passwordResetSent'));
    } catch (e) {
      setResetErr(e instanceof AuthApiError ? e.message : tp('passwordResetError'));
    } finally {
      setResetBusy(false);
    }
  }

  if (loading) {
    return (
      <div data-testid="account-profile-page" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F6EF6]" />
      </div>
    );
  }

  return (
    <div data-testid="account-profile-page" className="pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF]">
                  <Pencil className="h-5 w-5 text-[#2F6EF6]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]">
                    {t('editProfile')}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#7A879B]">
                    {tp('subtitle')}
                  </p>
                </div>
              </div>
              <Link
                href="/account"
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
                aria-label={tp('back')}
                data-testid="profile-back"
              >
                <ArrowLeft className={cn('h-5 w-5', locale === 'en' && 'rotate-180')} aria-hidden />
              </Link>
            </div>
          </header>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
              <h2 className="text-base font-bold text-[#0D2046]">{tp('personalTitle')}</h2>
            </div>
            <p className="mb-4 text-[12.5px] text-[#7A879B]">{t('readOnlyHint')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#0D2046]">
                  {tp('fullName')}
                </span>
                <span className="relative block">
                  <User className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                  <input
                    readOnly
                    data-testid="profile-name"
                    className={fieldClass}
                    value={displayName}
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#0D2046]">
                  {t('email')}
                </span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                  <input
                    readOnly
                    data-testid="profile-email"
                    className={fieldClass}
                    value={displayEmail}
                    dir="ltr"
                  />
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#0D2046]">
                  {tp('phone')}
                </span>
                <span className="relative block">
                  <Phone className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                  <input
                    readOnly
                    data-testid="profile-phone"
                    className={fieldClass}
                    value={phoneMasked || tp('phoneEmpty')}
                    dir="ltr"
                  />
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
              <h2 className="text-base font-bold text-[#0D2046]">{tp('passwordTitle')}</h2>
            </div>
            <p className="mb-4 text-[12.5px] text-[#7A879B]">{tp('passwordHint')}</p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="profile-password-reset"
                disabled={resetBusy || !user?.email}
                onClick={() => void handlePasswordReset()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#EAF2FF] px-4 text-[13px] font-semibold text-[#2F6EF6] transition hover:bg-[#DCE9FF] disabled:opacity-50"
              >
                {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {tp('passwordResetCta')}
              </button>
              {!user?.email ? (
                <p className="text-[13px] text-[#7A879B]" data-testid="profile-password-no-email">
                  {tp('passwordNoEmail')}
                </p>
              ) : null}
              {resetMsg ? <p className="text-[13px] text-[#16A34A]">{resetMsg}</p> : null}
              {resetErr ? <p className="text-[13px] text-[#E11D48]" role="alert">{resetErr}</p> : null}
            </div>
          </section>

          <AccountIdentitiesCard />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/account"
              data-testid="profile-save"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,110,246,.28)] transition hover:bg-[#255FE0]"
            >
              <Save className="h-4 w-4" aria-hidden />
              {tp('done')}
            </Link>
            <Link
              href="/account"
              data-testid="profile-cancel"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E4EAF3] bg-[#F5F8FC] px-5 text-sm font-semibold text-[#2F6EF6] transition hover:bg-[#EAF2FF]"
            >
              {tp('cancel')}
            </Link>
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <section
            className="rounded-2xl border border-[#E4EAF3] bg-white p-5 text-center shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6"
            data-testid="profile-summary-card"
          >
            <div className="relative mx-auto h-24 w-24">
              <span className="relative block h-24 w-24 overflow-hidden rounded-full bg-[#E8F0FE]">
                <Image
                  src={avatarSrc}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  data-testid={customAvatar ? 'profile-avatar' : 'profile-avatar-default'}
                />
              </span>
              <button
                type="button"
                disabled
                className="absolute bottom-0 inset-e-0 flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border-2 border-white bg-[#2F6EF6] text-white opacity-80"
                aria-label={tp('avatarSoon')}
                title={tp('avatarSoon')}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-4 text-lg font-bold text-[#0D2046]">{displayName}</p>
            <p className="mt-1 text-[13px] text-[#7A879B]" dir="ltr">
              {displayEmail}
            </p>
            <div className="mt-3 space-y-1.5 text-[13px] text-[#7A879B]">
              <p className="flex items-center justify-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#2F6EF6]" aria-hidden />
                <span dir="ltr">{phoneMasked || tp('phoneEmpty')}</span>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-5">
            <div className="flex items-start gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
                <Lightbulb className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-[14px] font-bold leading-snug text-[#0D2046]">{tp('tipsTitle')}</h2>
            </div>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{tp('tip1')}</p>
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{tp('tip2')}</p>
              </li>
              <li className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{tp('tip3')}</p>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
