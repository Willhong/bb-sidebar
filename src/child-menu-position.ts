export const CHILD_MENU_VIEWPORT_GUTTER = 8;

/**
 * The visible viewport the compact child menu has to fit inside.
 *
 * On a phone the layout viewport is not what the reader sees: the URL bar and
 * the on-screen keyboard shrink `visualViewport`, and a notch or home bar eats
 * the edges through the safe-area insets. A menu placed against
 * `window.innerWidth` lands underneath both.
 */
export interface CompactViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  safeAreaLeft: number;
  safeAreaTop: number;
  safeAreaRight: number;
  safeAreaBottom: number;
}

export interface CompactChildMenuPlacement {
  left: number;
  top: number;
  maxHeight: string;
  maxWidth: number;
}

/**
 * Right-align the menu under its trigger, then pull it back inside the
 * viewport. The trigger sits at the right end of a narrow header, so the
 * natural placement runs off the left edge as soon as the menu is wider than
 * the space to the trigger's left.
 */
export function clampCompactMenuLeft({
  triggerRight,
  menuWidth,
  viewport,
}: {
  triggerRight: number;
  menuWidth: number;
  viewport: CompactViewportBounds;
}): number {
  const minLeft =
    viewport.left + viewport.safeAreaLeft + CHILD_MENU_VIEWPORT_GUTTER;
  const maxLeft = Math.max(
    minLeft,
    viewport.left +
      viewport.width -
      viewport.safeAreaRight -
      CHILD_MENU_VIEWPORT_GUTTER -
      menuWidth,
  );
  return Math.min(Math.max(triggerRight - menuWidth, minLeft), maxLeft);
}

/**
 * Where the compact child menu goes, given the trigger it hangs from and the
 * viewport it must stay inside.
 *
 * The menu opens below the trigger and never above the safe area, and its
 * height stops at the bottom edge so a long child list scrolls inside the menu
 * instead of running past the end of the screen.
 */
export function compactChildMenuPlacement({
  triggerBottom,
  triggerRight,
  menuWidth,
  viewport,
}: {
  triggerBottom: number;
  triggerRight: number;
  menuWidth: number;
  viewport: CompactViewportBounds;
}): CompactChildMenuPlacement {
  const minTop = viewport.top + viewport.safeAreaTop + CHILD_MENU_VIEWPORT_GUTTER;
  const viewportBottom =
    viewport.top +
    viewport.height -
    viewport.safeAreaBottom -
    CHILD_MENU_VIEWPORT_GUTTER;
  const top = Math.min(
    Math.max(triggerBottom + CHILD_MENU_VIEWPORT_GUTTER, minTop),
    Math.max(minTop, viewportBottom),
  );
  return {
    left: clampCompactMenuLeft({ triggerRight, menuWidth, viewport }),
    top,
    maxHeight: `min(32rem, ${Math.max(0, viewportBottom - top)}px)`,
    maxWidth: Math.max(
      0,
      viewport.width -
        viewport.safeAreaLeft -
        viewport.safeAreaRight -
        CHILD_MENU_VIEWPORT_GUTTER * 2,
    ),
  };
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Read the live viewport. `safeAreaProbe` is an off-screen element whose
 * padding is set from the `env(safe-area-inset-*)` variables, because those
 * are only readable through a resolved style.
 */
export function readCompactViewportBounds(
  safeAreaProbe: Element | null,
): CompactViewportBounds {
  const visualViewport = window.visualViewport;
  const safeArea = safeAreaProbe ? getComputedStyle(safeAreaProbe) : null;
  return {
    left: visualViewport?.offsetLeft ?? 0,
    top: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
    safeAreaLeft: parsePixelValue(safeArea?.paddingLeft ?? ""),
    safeAreaTop: parsePixelValue(safeArea?.paddingTop ?? ""),
    safeAreaRight: parsePixelValue(safeArea?.paddingRight ?? ""),
    safeAreaBottom: parsePixelValue(safeArea?.paddingBottom ?? ""),
  };
}

export function sameCompactViewportBounds(
  left: CompactViewportBounds | null,
  right: CompactViewportBounds,
): boolean {
  return (
    left?.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height &&
    left.safeAreaLeft === right.safeAreaLeft &&
    left.safeAreaTop === right.safeAreaTop &&
    left.safeAreaRight === right.safeAreaRight &&
    left.safeAreaBottom === right.safeAreaBottom
  );
}
