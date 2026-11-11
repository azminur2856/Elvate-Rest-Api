/** URL slug: lowercase kebab-case ASCII ("Men's T-Shirts & Polos" -> "mens-t-shirts-and-polos"). */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)
      .replace(/-+$/g, '') || 'item'
  );
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First free slug of `base`, `base-2`, `base-3`, ... */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  for (let n = 2; await isTaken(slug); n++) slug = `${base}-${n}`;
  return slug;
}
