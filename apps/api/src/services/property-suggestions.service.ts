import { prisma, PropertyStatus } from '@mazare3/db';
import { propertyTitleMatchScore } from '@mazare3/shared';

export type PropertyTitleSuggestion = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  type: string;
  city: string;
};

const MAX_CANDIDATES = 40;

/**
 * Lightweight public property-name suggestions for Explore autocomplete.
 * Does NOT run Recommended ranking, booking aggregates, or review aggregates.
 */
export async function listPropertyTitleSuggestions(params: {
  q: string;
  limit?: number;
}): Promise<PropertyTitleSuggestion[]> {
  const q = params.q.trim();
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 12);
  if (q.length < 2) return [];

  const rows = await prisma.property.findMany({
    where: {
      status: PropertyStatus.published,
      owner: { status: 'approved' },
      OR: [
        { titleAr: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      type: true,
      city: true,
    },
    take: MAX_CANDIDATES,
  });

  return rows
    .map((row) => ({
      ...row,
      type: String(row.type),
      _score: propertyTitleMatchScore(q, row.titleAr, row.titleEn),
    }))
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ _score: _ignored, ...row }) => row);
}
