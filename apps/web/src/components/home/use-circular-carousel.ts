'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type TransitionEvent,
} from 'react';
import {
  CAROUSEL_GAP_PX,
  computeCarouselCardWidthPx,
  computeCarouselUnusedSpacePx,
} from './carousel-layout';

const TRANSITION = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';

export type CircularCarouselAlign = 'start' | 'end';

/**
 * Smooth transform-based circular carousel.
 * Card widths are always measured in viewport pixels (never % of the track),
 * because percentage widths inside an auto-sized flex track collapse to 0.
 *
 * Low-item rails size cards for the *intended* breakpoint capacity (not itemCount),
 * so a single card does not stretch to 100% of the rail on desktop/tablet.
 */
export function useCircularCarousel(
  itemCount: number,
  resolveVisibleCount: (width: number) => number,
  options?: { align?: CircularCarouselAlign },
) {
  const align = options?.align ?? 'start';
  const viewportRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const [responsiveVisible, setResponsiveVisible] = useState(1);
  /** Index on the tripled track; middle copy starts at `itemCount`. */
  const [position, setPosition] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [cardWidthPx, setCardWidthPx] = useState(0);
  const [viewportWidthPx, setViewportWidthPx] = useState(0);

  const actualVisible =
    itemCount <= 0 ? 1 : Math.min(itemCount, Math.max(1, responsiveVisible));
  const canNavigate = itemCount > 1;
  const stepPx = cardWidthPx > 0 ? cardWidthPx + CAROUSEL_GAP_PX : 0;
  const unusedSpacePx = computeCarouselUnusedSpacePx({
    viewportWidthPx,
    itemCount,
    cardWidthPx,
    gapPx: CAROUSEL_GAP_PX,
  });
  const alignOffsetPx = align === 'end' ? unusedSpacePx : 0;

  const measure = useCallback(() => {
    const node = viewportRef.current;
    if (!node || itemCount <= 0) return;

    const width = node.clientWidth;
    if (width <= 0) return;

    const nextResponsive = Math.max(1, resolveVisibleCount(width));
    setResponsiveVisible((prev) => (prev === nextResponsive ? prev : nextResponsive));
    setViewportWidthPx((prev) => (prev === width ? prev : width));

    const nextCardWidth = computeCarouselCardWidthPx({
      viewportWidthPx: width,
      itemCount,
      intendedVisible: nextResponsive,
      gapPx: CAROUSEL_GAP_PX,
    });
    setCardWidthPx(nextCardWidth);
  }, [itemCount, resolveVisibleCount]);

  useLayoutEffect(() => {
    animatingRef.current = false;
    setTransitionEnabled(false);
    setPosition(itemCount > 0 ? itemCount : 0);
    measure();
  }, [itemCount, measure]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const goNext = useCallback(() => {
    if (!canNavigate || animatingRef.current || stepPx <= 0) return;
    animatingRef.current = true;
    setTransitionEnabled(true);
    setPosition((current) => current + 1);
  }, [canNavigate, stepPx]);

  const goPrev = useCallback(() => {
    if (!canNavigate || animatingRef.current || stepPx <= 0) return;
    animatingRef.current = true;
    setTransitionEnabled(true);
    setPosition((current) => current - 1);
  }, [canNavigate, stepPx]);

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== 'transform') return;
      if (itemCount <= 0) {
        animatingRef.current = false;
        return;
      }

      setPosition((current) => {
        let next = current;
        if (current >= itemCount * 2) next = current - itemCount;
        else if (current < itemCount) next = current + itemCount;
        else {
          animatingRef.current = false;
          return current;
        }

        setTransitionEnabled(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransitionEnabled(true);
            animatingRef.current = false;
          });
        });
        return next;
      });
    },
    [itemCount],
  );

  // Geometry layer is always LTR so translate3d(-position * stepPx) aligns with
  // flex order. Card content keeps page locale via dir on each card/wrapper.
  // align=end (Arabic) shifts sparse rails toward the inline-end (right in LTR geometry).
  const trackStyle: CSSProperties = {
    display: 'flex',
    direction: 'ltr',
    gap: CAROUSEL_GAP_PX,
    width: 'max-content',
    transform:
      stepPx > 0
        ? `translate3d(${-position * stepPx + alignOffsetPx}px, 0, 0)`
        : 'translate3d(0, 0, 0)',
    transition: transitionEnabled && stepPx > 0 ? TRANSITION : 'none',
    willChange: 'transform',
  };

  const cardStyle: CSSProperties =
    cardWidthPx > 0
      ? {
          width: cardWidthPx,
          minWidth: cardWidthPx,
          maxWidth: cardWidthPx,
          flex: '0 0 auto',
        }
      : {
          flex: '0 0 auto',
          visibility: 'hidden' as const,
        };

  return {
    viewportRef,
    trackStyle,
    cardStyle,
    handleTransitionEnd,
    actualVisible,
    intendedVisible: responsiveVisible,
    unusedSpacePx,
    canNavigate,
    goNext,
    goPrev,
    gapPx: CAROUSEL_GAP_PX,
    ready: cardWidthPx > 0,
    cardWidthPx,
  };
}
