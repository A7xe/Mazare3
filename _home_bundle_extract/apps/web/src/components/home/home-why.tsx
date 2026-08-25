import { Headset, Lock, ShieldCheck, Users } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export async function HomeWhySection() {
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const items = [
    { title: t('whyPrivacyTitle'), desc: t('whyPrivacyDesc'), icon: Lock, color: 'text-[#2F6EF6]' },
    { title: t('whyBookingsTitle'), desc: t('whyBookingsDesc'), icon: ShieldCheck, color: 'text-[#12B7D6]' },
    { title: t('whyFamiliesTitle'), desc: t('whyFamiliesDesc'), icon: Users, color: 'text-[#7457F6]' },
    { title: t('whySupportTitle'), desc: t('whySupportDesc'), icon: Headset, color: 'text-[#2F6EF6]' },
  ];

  const heading = locale === 'ar' ? 'لماذا مزارع الأردن؟' : 'Why Mazare3 Jordan?';

  return (
    <section id="how-mazare3" className="mt-4">
      <h2 className="mb-2.5 text-end text-[18px] font-extrabold text-[#0D2046]">{heading}</h2>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="flex min-h-[60px] items-center gap-2.5 rounded-[11px] border border-[#E3EAF4] bg-white px-3 py-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center">
                <Icon className={`h-[22px] w-[22px] ${item.color}`} strokeWidth={1.8} aria-hidden />
              </span>

              <div className="min-w-0">
                <h3 className="truncate text-[10.5px] font-bold text-[#0D2046]">{item.title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[8.5px] leading-[1.55] text-[#8794A7]">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-[16px] border border-[#E4EBF5] bg-white px-5 py-5 shadow-[0_6px_24px_rgba(35,72,120,.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#0D2046]">{t('ownerCtaTitle')}</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#8794A7]">
              {t('ownerCtaDesc')}
            </p>
          </div>

          <Button
            asChild
            size="sm"
            className="h-10 shrink-0 rounded-[11px] bg-[#2F6EF6] px-5 text-white hover:bg-[#1D5FE8]"
          >
            <Link href="/become-owner">{tCommon('listProperty')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
