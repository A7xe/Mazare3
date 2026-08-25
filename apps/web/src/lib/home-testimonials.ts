import type { HomePublicTestimonial } from '@mazare3/shared';
import { JORDAN_CITIES } from '@mazare3/shared';
import type { HomeTestimonial } from '@/components/home/home-testimonials';
import { apiFetch } from './api';

export async function fetchHomeTestimonials(): Promise<HomePublicTestimonial[]> {
  try {
    const res = await apiFetch<{ data: HomePublicTestimonial[] }>('/properties/testimonials', {
      next: { revalidate: 60 },
    });
    return res.data ?? [];
  } catch {
    return [];
  }
}

export function mapHomeTestimonials(
  rows: HomePublicTestimonial[],
  locale: string,
): HomeTestimonial[] {
  const isAr = locale !== 'en';
  return rows.map((row) => {
    const cityMeta = JORDAN_CITIES.find((c) => c.key === row.propertyCity);
    const city = cityMeta
      ? isAr
        ? cityMeta.labelAr
        : cityMeta.labelEn
      : row.propertyCity;
    return {
      id: row.id,
      name: row.customerDisplayName,
      city,
      quote: row.comment,
      propertyLabel: isAr ? row.propertyTitleAr : row.propertyTitleEn,
      rating: row.rating,
    };
  });
}
