'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, ChevronLeft, Phone, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { resolveSafeReturnUrl, sanitizeReturnUrl } from '@mazare3/shared';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthSession } from '@/components/auth/auth-session';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';
import {
  AuthApiError,
  completeIdentityLink,
  completePhoneProfile,
  fetchAuthCapabilities,
  googleAuthStartUrl,
  login,
  signup,
  startPhoneOtp,
  verifyPhoneOtp,
  type AuthCapabilities,
  type AuthUser,
} from '@/lib/api-auth';

type AuthStep =
  | 'chooser'
  | 'phone'
  | 'otp'
  | 'profile'
  | 'email'
  | 'link';

type EmailMode = 'login' | 'signup';

function defaultDestination(user: AuthUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'owner' && user.ownerProfileStatus === 'approved') return '/owner';
  return '/';
}

/** Admin return destinations must not advertise Phone/Google. */
function isPrivilegedAdminReturnUrl(raw: string | null | undefined): boolean {
  const safe = sanitizeReturnUrl(raw);
  if (!safe) return false;
  return safe === '/admin' || safe.startsWith('/admin/');
}

function maskPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function UnifiedAuthView() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get('returnUrl');
  const safeReturn = sanitizeReturnUrl(rawReturn);
  const { user, ready, refresh } = useAuthSession();

  const initialMode = searchParams.get('mode');
  const initialEmailMode = searchParams.get('emailMode');
  const authErrorParam = searchParams.get('authError');
  const privilegedAdminReturn = isPrivilegedAdminReturnUrl(rawReturn);

  const [step, setStep] = useState<AuthStep>(() => {
    if (authErrorParam === 'EXISTING_ACCOUNT_LINK_REQUIRED') return 'link';
    if (privilegedAdminReturn) return 'email';
    if (initialMode === 'phone') return 'phone';
    if (initialMode === 'email') return 'email';
    if (initialMode === 'link') return 'link';
    return 'chooser';
  });
  const [emailMode, setEmailMode] = useState<EmailMode>(
    privilegedAdminReturn || initialEmailMode !== 'signup' ? 'login' : 'signup',
  );
  const [pendingLink, setPendingLink] = useState(
    () =>
      authErrorParam === 'EXISTING_ACCOUNT_LINK_REQUIRED' || initialMode === 'link',
  );
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [capsLoading, setCapsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendAfter, setResendAfter] = useState(0);
  const [continueToken, setContinueToken] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');

  const errorId = useId();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const actingRef = useRef(false);
  const redirectedRef = useRef(false);

  function navigateAfterAuth(dest: string) {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(dest);
    // Soft navigation can stall on auth→destination under Next dev; hard fallback.
    window.setTimeout(() => {
      if (!window.location.pathname.includes('/auth')) return;
      const suffix = dest === '/' ? '' : dest;
      window.location.replace(`/${locale}${suffix}`);
    }, 1200);
  }

  useEffect(() => {
    if (!ready || !user) return;
    if (pendingLink) return;
    const dest = resolveSafeReturnUrl(rawReturn, defaultDestination(user));
    navigateAfterAuth(dest);
  }, [ready, user, rawReturn, pendingLink, locale, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchAuthCapabilities();
        if (!cancelled) setCapabilities(res.data);
      } catch (err) {
        if (cancelled) return;
        // Fail-safe: do not advertise Google/Phone when capability cannot be proven.
        // Keep email available. Avoid treating a transient failure as a permanent
        // "providers off" flip while still loading.
        setCapabilities({
          phone: { available: false },
          google: { available: false },
          emailPassword: { available: true },
        });
        if (
          err instanceof AuthApiError &&
          (err.status === 429 || err.code === 'RATE_LIMITED' || err.code === 'AUTH_RATE_LIMITED')
        ) {
          setError(t('errorRateLimited'));
        }
      } finally {
        if (!cancelled) setCapsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!authErrorParam) return;
    if (authErrorParam === 'EXISTING_ACCOUNT_LINK_REQUIRED') {
      setStep('link');
      setPendingLink(true);
      setError(null);
      return;
    }
    if (authErrorParam === 'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT') {
      setStep('email');
      setEmailMode('login');
      setError(t('errorProviderNotAllowed'));
      return;
    }
    setError(t('errorGeneric'));
  }, [authErrorParam, t]);

  useEffect(() => {
    if (resendAfter <= 0) return;
    const id = window.setInterval(() => {
      setResendAfter((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendAfter]);

  const mapServerError = useCallback(
    (err: unknown): string => {
      if (err instanceof AuthApiError) {
        if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
          return t('errorInvalidCredentials');
        }
        if (err.code === 'EXISTING_ACCOUNT_LINK_REQUIRED') return t('linkRequiredBody');
        if (err.code === 'EMAIL_EXISTS' || err.status === 409) {
          return t('errorEmailExists');
        }
        if (err.code === 'ACCOUNT_SUSPENDED' || err.status === 403) {
          if (err.code === 'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT') {
            return t('errorProviderNotAllowed');
          }
          return t('errorAccountInactive');
        }
        if (err.code === 'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT') {
          return t('errorProviderNotAllowed');
        }
        if (err.code === 'RATE_LIMITED' || err.code === 'AUTH_RATE_LIMITED' || err.status === 429) {
          return t('errorRateLimited');
        }
        if (err.code === 'OTP_EXPIRED' || err.code === 'INVALID_OTP') return t('errorOtpInvalid');
        if (err.code === 'OTP_MAX_ATTEMPTS') return t('errorOtpMaxAttempts');
        if (err.code === 'OTP_RESEND_COOLDOWN') return t('errorOtpCooldownendCooldown');
        if (err.code === 'PHONE_AUTH_UNAVAILABLE' || err.code === 'GOOGLE_AUTH_UNAVAILABLE') {
          return t('errorProviderUnavailable');
        }
        if (err.code === 'VALIDATION_ERROR' || err.code === 'INVALID_PHONE') {
          return t('errorValidation');
        }
      }
      return t('errorGeneric');
    },
    [t],
  );

  async function afterAuthSuccess(authUser: AuthUser) {
    await refresh();
    if (pendingLink) {
      try {
        const linked = await completeIdentityLink();
        setPendingLink(false);
        const dest = resolveSafeReturnUrl(
          linked.data.returnUrl ?? rawReturn,
          defaultDestination(linked.data.user),
        );
        navigateAfterAuth(dest);
        return;
      } catch {
        setPendingLink(false);
      }
    }
    const dest = resolveSafeReturnUrl(rawReturn, defaultDestination(authUser));
    navigateAfterAuth(dest);
  }

  function goBack() {
    setError(null);
    if (step === 'otp' || step === 'profile') {
      setStep('phone');
      setOtpDigits(['', '', '', '', '', '']);
      setContinueToken(null);
      return;
    }
    if (step === 'phone' || step === 'email' || step === 'link') {
      setStep('chooser');
    }
  }

  async function handlePhoneStart(e?: React.FormEvent) {
    e?.preventDefault();
    if (actingRef.current || loading) return;
    setError(null);
    const phone = phoneInput.trim();
    if (phone.length < 8) {
      setError(t('errorPhoneInvalid'));
      return;
    }
    actingRef.current = true;
    setLoading(true);
    try {
      const res = await startPhoneOtp({ phone, returnUrl: safeReturn });
      setChallengeId(res.data.challengeId);
      setResendAfter(res.data.resendAfterSeconds);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('otp');
    } catch (err) {
      setError(mapServerError(err));
    } finally {
      setLoading(false);
      actingRef.current = false;
    }
  }

  async function handleOtpVerify(codeOverride?: string) {
    if (actingRef.current || loading || !challengeId) return;
    const code = (codeOverride ?? otpDigits.join('')).trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t('errorOtpInvalid'));
      return;
    }
    actingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await verifyPhoneOtp({
        phone: phoneInput.trim(),
        code,
        challengeId,
        returnUrl: safeReturn,
      });
      if (res.data.outcome === 'authenticated' && res.data.user) {
        await afterAuthSuccess(res.data.user);
        return;
      }
      if (res.data.outcome === 'profile_required' && res.data.continueToken) {
        setContinueToken(res.data.continueToken);
        setStep('profile');
        return;
      }
      setError(t('errorGeneric'));
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'EXISTING_ACCOUNT_LINK_REQUIRED') {
        setPendingLink(true);
        setStep('link');
        setError(null);
        return;
      }
      setError(mapServerError(err));
    } finally {
      setLoading(false);
      actingRef.current = false;
    }
  }

  async function handleProfileComplete(e: React.FormEvent) {
    e.preventDefault();
    if (actingRef.current || loading || !continueToken) return;
    const name = profileName.trim();
    if (name.length < 2) {
      setError(t('errorNameMin'));
      return;
    }
    actingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await completePhoneProfile({
        continueToken,
        phone: phoneInput.trim(),
        name,
        locale,
      });
      await afterAuthSuccess(res.data.user);
    } catch (err) {
      setError(mapServerError(err));
    } finally {
      setLoading(false);
      actingRef.current = false;
    }
  }

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (actingRef.current || loading) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = form.get('name') ? String(form.get('name')).trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('errorEmailInvalid'));
      return;
    }
    if (emailMode === 'signup') {
      if (password.length < 8) {
        setError(t('errorPasswordMin'));
        return;
      }
      if (name && name.length < 2) {
        setError(t('errorNameMin'));
        return;
      }
    } else if (!password) {
      setError(t('errorPasswordRequired'));
      return;
    }

    actingRef.current = true;
    setLoading(true);
    try {
      const res =
        emailMode === 'signup'
          ? await signup({ email, password, name: name || undefined, locale })
          : await login({ email, password });
      await afterAuthSuccess(res.data.user);
    } catch (err) {
      setError(mapServerError(err));
    } finally {
      setLoading(false);
      actingRef.current = false;
    }
  }

  function onOtpChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // paste
      const chars = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((c, i) => {
        next[i] = c;
      });
      setOtpDigits(next);
      if (chars.length === 6) void handleOtpVerify(chars.join(''));
      return;
    }
    const next = [...otpDigits];
    next[index] = cleaned.slice(-1);
    setOtpDigits(next);
    if (cleaned && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === 6) {
      void handleOtpVerify(next.join(''));
    }
  }

  function onOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function startGoogle() {
    if (loading || actingRef.current) return;
    window.location.assign(googleAuthStartUrl(safeReturn));
  }

  useEffect(() => {
    if (!ready || !user || !pendingLink) return;
    let cancelled = false;
    void (async () => {
      try {
        const linked = await completeIdentityLink();
        if (cancelled) return;
        setPendingLink(false);
        const dest = resolveSafeReturnUrl(
          linked.data.returnUrl ?? rawReturn,
          defaultDestination(linked.data.user),
        );
        navigateAfterAuth(dest);
      } catch {
        if (!cancelled) setPendingLink(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, pendingLink, rawReturn, locale]);

  if (ready && user) {
    return (
      <div
        data-testid="auth-redirecting"
        className="flex min-h-[240px] items-center justify-center rounded-3xl bg-white p-8 shadow-[0_12px_40px_rgba(13,32,70,0.08)]"
      >
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  const phoneAvailable =
    !privilegedAdminReturn && capabilities?.phone.available === true;
  const googleAvailable =
    !privilegedAdminReturn && capabilities?.google.available === true;
  /** Admin return context stays on Email Login — no chooser back-step. */
  const showBack = step !== 'chooser' && !(privilegedAdminReturn && step === 'email');

  return (
    <div
      data-testid="auth-card"
      data-auth-step={step}
      className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(13,32,70,0.08)] sm:p-8"
    >
      {showBack && (
        <button
          type="button"
          data-testid="auth-back"
          onClick={goBack}
          className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-sm font-semibold text-[#445468] transition-colors hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('back')}
        </button>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          data-testid="auth-error"
          className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {step === 'chooser' && (
        <div className="space-y-5" data-testid="auth-chooser">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[#0D2046] sm:text-[1.65rem]">
              {t('unifiedTitle')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#5B6B7F]">{t('unifiedSubtitle')}</p>
          </div>

          {capsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {phoneAvailable && (
                <Button
                  type="button"
                  data-testid="auth-continue-phone"
                  className="h-12 w-full text-base shadow-soft"
                  onClick={() => {
                    setError(null);
                    setStep('phone');
                  }}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {t('continuePhone')}
                </Button>
              )}
              {googleAvailable && (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="auth-continue-google"
                  className="h-12 w-full border-[#D8E3F0] bg-white text-base text-[#0D2046] hover:bg-[#F5F8FC]"
                  onClick={startGoogle}
                >
                  <GoogleMark />
                  {t('continueGoogle')}
                </Button>
              )}
              {(phoneAvailable || googleAvailable) && (
                <div className="relative py-1 text-center" data-testid="auth-separator">
                  <span className="relative z-10 bg-white px-3 text-xs font-medium text-[#8A97A8]">
                    {t('orSeparator')}
                  </span>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-[#E4ECF5]" aria-hidden />
                </div>
              )}
              <Button
                type="button"
                variant={phoneAvailable || googleAvailable ? 'outline' : 'default'}
                data-testid="auth-continue-email"
                className={
                  phoneAvailable || googleAvailable
                    ? 'h-12 w-full border-[#D8E3F0] bg-white text-base text-[#0D2046] hover:bg-[#F5F8FC]'
                    : 'h-12 w-full text-base shadow-soft'
                }
                onClick={() => {
                  setError(null);
                  setEmailMode('login');
                  setStep('email');
                }}
              >
                <Mail className="h-4 w-4" aria-hidden />
                {t('continueEmail')}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 'phone' && (
        <form onSubmit={(e) => void handlePhoneStart(e)} className="space-y-5" data-testid="auth-phone">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#0D2046]">{t('phoneTitle')}</h1>
            <p className="mt-2 text-sm text-[#5B6B7F]">{t('phoneHelper')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-phone-input">{t('phoneLabel')}</Label>
            <div
              className="flex overflow-hidden rounded-xl border border-[#D8E3F0] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
              dir="ltr"
            >
              <span className="flex items-center bg-[#F5F8FC] px-3 text-sm font-semibold text-[#0D2046] tabular-nums">
                +962
              </span>
              <Input
                id="auth-phone-input"
                data-testid="auth-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="border-0 text-start shadow-none focus-visible:ring-0"
                placeholder={t('phonePlaceholder')}
                value={phoneInput}
                onChange={(ev) => setPhoneInput(ev.target.value)}
                disabled={loading}
              />
            </div>
            <p className="text-xs text-[#8A97A8]">{t('phoneHint')}</p>
          </div>
          <Button
            type="submit"
            data-testid="auth-phone-submit"
            className="h-12 w-full text-base"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('phoneSubmit')}
          </Button>
        </form>
      )}

      {step === 'otp' && (
        <div className="space-y-5" data-testid="auth-otp">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#0D2046]">{t('otpTitle')}</h1>
            <p className="mt-2 text-sm text-[#5B6B7F]">
              {t('otpHelper', { phone: maskPhoneDisplay(phoneInput) })}
            </p>
          </div>
          <div
            className="flex justify-center gap-2"
            role="group"
            aria-label={t('otpTitle')}
            dir="ltr"
          >
            {otpDigits.map((d, i) => (
              <Input
                key={i}
                ref={(el) => {
                  otpRefs.current[i] = el;
                }}
                data-testid={`auth-otp-digit-${i}`}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                className="h-12 w-11 px-0 text-center text-lg font-semibold"
                value={d}
                onChange={(ev) => onOtpChange(i, ev.target.value)}
                onKeyDown={(ev) => onOtpKeyDown(i, ev)}
                disabled={loading}
                aria-label={t('otpDigitLabel', { n: i + 1 })}
              />
            ))}
          </div>
          <Button
            type="button"
            data-testid="auth-otp-submit"
            className="h-12 w-full text-base"
            disabled={loading || otpDigits.join('').length !== 6}
            onClick={() => void handleOtpVerify()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('otpSubmit')}
          </Button>
          <div className="text-center text-sm text-[#5B6B7F]">
            {resendAfter > 0 ? (
              <span data-testid="auth-otp-cooldown">
                {t('otpResendIn', {
                  time: `00:${String(resendAfter).padStart(2, '0')}`,
                })}
              </span>
            ) : (
              <button
                type="button"
                data-testid="auth-otp-resend"
                className="font-semibold text-primary hover:underline"
                disabled={loading}
                onClick={() => void handlePhoneStart()}
              >
                {t('otpResend')}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'profile' && (
        <form
          onSubmit={(e) => void handleProfileComplete(e)}
          className="space-y-5"
          data-testid="auth-profile"
        >
          <div>
            <h1 className="text-xl font-heading font-bold text-[#0D2046]">{t('profileTitle')}</h1>
            <p className="mt-2 text-sm text-[#5B6B7F]">{t('profileHelper')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-profile-name">{t('name')}</Label>
            <Input
              id="auth-profile-name"
              data-testid="auth-profile-name"
              autoComplete="name"
              value={profileName}
              onChange={(ev) => setProfileName(ev.target.value)}
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            data-testid="auth-profile-submit"
            className="h-12 w-full text-base"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('profileSubmit')}
          </Button>
        </form>
      )}

      {step === 'link' && (
        <div className="space-y-5" data-testid="auth-link-required">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#0D2046]">{t('linkRequiredTitle')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#5B6B7F]">{t('linkRequiredBody')}</p>
          </div>
          <Button
            type="button"
            data-testid="auth-link-email"
            className="h-12 w-full text-base"
            onClick={() => {
              setError(null);
              setEmailMode('login');
              setStep('email');
            }}
          >
            <Mail className="h-4 w-4" aria-hidden />
            {t('continueEmail')}
          </Button>
        </div>
      )}

      {step === 'email' && (
        <form
          onSubmit={(e) => void handleEmailSubmit(e)}
          className="space-y-5"
          data-testid="auth-email-form"
          aria-describedby={error ? errorId : undefined}
        >
          <div>
            <h1 className="text-xl font-heading font-bold text-[#0D2046]">{t('emailTitle')}</h1>
            <div
              className="mt-3 flex rounded-xl bg-[#F5F8FC] p-1"
              role="tablist"
              aria-label={t('emailTitle')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={emailMode === 'login'}
                data-testid="auth-email-mode-login"
                className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                  emailMode === 'login'
                    ? 'bg-white text-[#0D2046] shadow-sm'
                    : 'text-[#5B6B7F]'
                }`}
                onClick={() => {
                  setEmailMode('login');
                  setError(null);
                }}
              >
                {t('emailModeLogin')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={emailMode === 'signup'}
                data-testid="auth-email-mode-signup"
                className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                  emailMode === 'signup'
                    ? 'bg-white text-[#0D2046] shadow-sm'
                    : 'text-[#5B6B7F]'
                }`}
                onClick={() => {
                  setEmailMode('signup');
                  setError(null);
                }}
              >
                {t('emailModeSignup')}
              </button>
            </div>
          </div>

          {emailMode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="auth-name">{t('name')}</Label>
              <Input
                id="auth-name"
                name="name"
                data-testid="auth-name"
                autoComplete="name"
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="auth-email-input">{t('email')}</Label>
            <Input
              id="auth-email-input"
              name="email"
              type="email"
              data-testid="auth-email"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="auth-password">{t('password')}</Label>
              {emailMode === 'login' && (
                <Link
                  href="/forgot-password"
                  data-testid="auth-forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t('forgotLink')}
                </Link>
              )}
            </div>
            <div className="relative">
              <Input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                data-testid="auth-password"
                autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                disabled={loading}
                className="pe-11"
              />
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#8A97A8] hover:text-[#0D2046]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {emailMode === 'signup' && (
              <p className="text-xs text-[#8A97A8]">{t('passwordHint')}</p>
            )}
          </div>

          {emailMode === 'signup' && <LegalCommitmentNotice testId="auth-legal-notice" />}

          <Button
            type="submit"
            data-testid="auth-submit"
            className="h-12 w-full text-base shadow-soft"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {emailMode === 'signup' ? t('signupSubmit') : t('loginSubmit')}
          </Button>
        </form>
      )}
    </div>
  );
}
