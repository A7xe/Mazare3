import { Percent } from 'lucide-react';
import { offerIconChipClass } from '@/components/home/offer-presentation';

/** Decorative blobs shared by Homepage + Explore promotional Offers shells. */
export function OffersSectionMotifs() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -end-6 -top-8 h-24 w-24 rounded-full bg-[#F59E0B]/12 blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -start-8 h-28 w-28 rounded-full bg-[#2F6EF6]/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute end-10 top-3 h-1.5 w-1.5 rounded-full bg-[#F59E0B]/55"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute end-16 top-7 h-1 w-1 rounded-full bg-[#2F6EF6]/35"
      />
    </>
  );
}

export function OffersSectionIcon() {
  return (
    <span aria-hidden className={offerIconChipClass}>
      <Percent className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}
