/**
 * Shared carousel layout math (no React).
 * Cards are sized for the *intended* visible slot count at a breakpoint,
 * not for the current item count — so 1–2 items do not stretch to fill the rail.
 */

export const CAROUSEL_GAP_PX = 16;

export function computeCarouselCardWidthPx(params: {
  viewportWidthPx: number;
  itemCount: number;
  intendedVisible: number;
  gapPx?: number;
}): number {
  const gap = params.gapPx ?? CAROUSEL_GAP_PX;
  const viewport = Math.max(0, params.viewportWidthPx);
  if (viewport <= 0 || params.itemCount <= 0) return 0;

  const intended = Math.max(1, Math.floor(params.intendedVisible));
  // Always divide by intended capacity so sparse rails keep normal card width.
  const slots = intended;
  const totalGap = gap * Math.max(0, slots - 1);
  return Math.max(0, (viewport - totalGap) / slots);
}

/** Empty space after placing `itemCount` normal-width cards in the viewport. */
export function computeCarouselUnusedSpacePx(params: {
  viewportWidthPx: number;
  itemCount: number;
  cardWidthPx: number;
  gapPx?: number;
}): number {
  const gap = params.gapPx ?? CAROUSEL_GAP_PX;
  const n = Math.max(0, params.itemCount);
  if (n <= 0 || params.cardWidthPx <= 0) return 0;
  const used = n * params.cardWidthPx + Math.max(0, n - 1) * gap;
  return Math.max(0, params.viewportWidthPx - used);
}
