'use client';

import { useTranslations } from 'next-intl';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ContactRequiredFields = Array<'email' | 'phone' | 'name'>;

type Props = {
  fields: ContactRequiredFields;
  email: string;
  phone: string;
  acting: boolean;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onContinue: () => void;
};

export function CheckoutPaymentContact({
  fields,
  email,
  phone,
  acting,
  onEmailChange,
  onPhoneChange,
  onContinue,
}: Props) {
  const t = useTranslations('checkout');

  return (
    <section
      data-testid="checkout-payment-contact"
      className="space-y-3 rounded-[18px] border border-[#2F6EF6]/25 bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
    >
      <div>
        <h2 className="text-[13px] font-bold text-[#0D2046]">{t('paymentContactTitle')}</h2>
        <p className="mt-1 text-[12px] text-[#53637A]">{t('paymentContactBody')}</p>
      </div>
      {fields.includes('email') ? (
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[#0D2046]" htmlFor="checkout-contact-email">
            {t('paymentContactEmail')}
          </label>
          <Input
            id="checkout-contact-email"
            data-testid="checkout-contact-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => onEmailChange(ev.target.value)}
            className="h-10 rounded-[12px]"
          />
        </div>
      ) : null}
      {fields.includes('phone') ? (
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[#0D2046]" htmlFor="checkout-contact-phone">
            {t('paymentContactPhone')}
          </label>
          <Input
            id="checkout-contact-phone"
            data-testid="checkout-contact-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(ev) => onPhoneChange(ev.target.value)}
            className="h-10 rounded-[12px]"
          />
          <p className="text-[10px] text-[#8794A7]">{t('paymentContactPhoneHint')}</p>
        </div>
      ) : null}
      <Button
        className="w-full rounded-[12px] bg-[#2F6EF6] hover:bg-[#2563EB]"
        data-testid="checkout-payment-contact-continue"
        disabled={acting}
        onClick={onContinue}
      >
        {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {t('paymentContactContinue')}
      </Button>
    </section>
  );
}
