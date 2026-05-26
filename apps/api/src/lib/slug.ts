import { prisma } from '@mazare3/db';

export function slugifyBase(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base || 'property';
}

export async function uniquePropertySlug(title: string): Promise<string> {
  const base = slugifyBase(title);
  let slug = base;
  let n = 0;
  while (await prisma.property.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
