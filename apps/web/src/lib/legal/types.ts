export const LEGAL_PAGE_SLUGS = [
  'about',
  'contact',
  'terms',
  'privacy',
  'cancellation-refund',
  'booking-payment',
  'verification',
  'cookie-policy',
  'community-reviews',
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tableMarkdown?: string;
};

export type LegalDocument = {
  slug: LegalPageSlug;
  title: string;
  intro: string;
  sections: LegalSection[];
};
