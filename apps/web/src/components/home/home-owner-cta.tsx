import Image from 'next/image';
import { Home, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type HomeOwnerCtaProps = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  contentDir?: 'rtl' | 'ltr';
  imageUrl?: string;
  imageAlt?: string;
};

const DEFAULT_IMAGE = '/home/owner-cta-villa.jpg';

export function HomeOwnerCta({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  contentDir = 'rtl',
  imageUrl = DEFAULT_IMAGE,
  imageAlt = '',
}: HomeOwnerCtaProps) {
  return (
    <section
      data-testid="home-owner-cta"
      className="overflow-hidden rounded-[20px] border border-[#E0E8F3] bg-white shadow-[0_6px_24px_rgba(35,72,120,.04)]"
    >
      {/* Geometry LTR so image stays visually on the left like the reference */}
      <div dir="ltr" className="grid min-h-[220px] lg:grid-cols-[minmax(280px,0.48fr)_minmax(0,0.52fr)]">
        <div className="relative min-h-[180px] overflow-hidden lg:min-h-full">
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover object-[center_40%]"
            sizes="(max-width: 1023px) 100vw, 48vw"
            priority={false}
          />
        </div>

        <div
          dir={contentDir}
          className="relative flex flex-col justify-center bg-[linear-gradient(135deg,#F4F8FF_0%,#FFFFFF_55%,#F7FAFF_100%)] px-5 py-6 sm:px-7 sm:py-7 lg:px-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute end-4 top-1/2 hidden -translate-y-1/2 text-[#B7D0FF]/70 sm:end-6 sm:block"
          >
            <span className="relative inline-flex">
              <Home className="h-24 w-24 stroke-[1.15] lg:h-28 lg:w-28" />
              <span className="absolute left-1/2 top-[42%] grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-current bg-transparent">
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              </span>
            </span>
          </div>

          <div className="relative z-[1] max-w-[520px] pe-0 sm:pe-16 lg:pe-20">
            <h2 className="text-[20px] font-bold leading-snug text-[#0D2046] sm:text-[22px] lg:text-[24px]">
              {title}
            </h2>
            <p className="mt-2 text-[12.5px] font-medium leading-7 text-[#53637A] sm:text-[13.5px]">
              {description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href={primaryHref}
                className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#2F6EF6] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1F5AD6]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#D7E2F0] bg-white px-4 text-[13px] font-semibold text-[#0D2046] transition hover:border-[#2F6EF6]/35 hover:bg-[#F8FBFF]"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
