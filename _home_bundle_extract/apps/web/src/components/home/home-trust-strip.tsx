import { BadgeCheck, Home, ShieldCheck, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function HomeTrustStrip() {
  const t = await getTranslations('home');

  const items = [
    { title: t('trustFastTitle'), desc: t('trustFastDesc'), icon: Zap, color: 'text-[#7457F6]' },
    { title: t('trustPayTitle'), desc: t('trustPayDesc'), icon: ShieldCheck, color: 'text-[#12B7D6]' },
    { title: t('trustChoiceTitle'), desc: t('trustChoiceDesc'), icon: Home, color: 'text-[#2F6EF6]' },
    { title: t('trustReviewsTitle'), desc: t('trustReviewsDesc'), icon: BadgeCheck, color: 'text-[#2F6EF6]' },
  ];

  return (
    <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="flex min-h-[58px] items-center gap-2.5 rounded-[11px] border border-[#E3EAF4] bg-white px-3 py-2"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center">
              <Icon className={`h-[22px] w-[22px] ${item.color}`} strokeWidth={1.8} aria-hidden />
            </span>

            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-bold text-[#0D2046]">{item.title}</h2>
              <p className="mt-0.5 line-clamp-2 text-[8.5px] leading-[1.55] text-[#8794A7]">
                {item.desc}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
