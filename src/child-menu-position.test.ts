import { describe, expect, it } from "vitest";
import {
  CHILD_MENU_VIEWPORT_GUTTER,
  clampCompactMenuLeft,
  compactChildMenuPlacement,
  type CompactViewportBounds,
} from "./child-menu-position";

function viewport(
  overrides: Partial<CompactViewportBounds> = {},
): CompactViewportBounds {
  return {
    left: 0,
    top: 0,
    width: 390,
    height: 700,
    safeAreaLeft: 0,
    safeAreaTop: 0,
    safeAreaRight: 0,
    safeAreaBottom: 0,
    ...overrides,
  };
}

describe("clampCompactMenuLeft", () => {
  it("right-aligns under the trigger when the menu fits", () => {
    expect(
      clampCompactMenuLeft({
        triggerRight: 370,
        menuWidth: 320,
        viewport: viewport(),
      }),
    ).toBe(50);
  });

  it("stops at the left gutter instead of running off-screen", () => {
    expect(
      clampCompactMenuLeft({
        triggerRight: 200,
        menuWidth: 320,
        viewport: viewport(),
      }),
    ).toBe(CHILD_MENU_VIEWPORT_GUTTER);
  });

  it("keeps clear of the left and right safe areas", () => {
    expect(
      clampCompactMenuLeft({
        triggerRight: 120,
        menuWidth: 320,
        viewport: viewport({ safeAreaLeft: 44, safeAreaRight: 44 }),
      }),
    ).toBe(44 + CHILD_MENU_VIEWPORT_GUTTER);
    expect(
      clampCompactMenuLeft({
        triggerRight: 390,
        menuWidth: 320,
        viewport: viewport({ safeAreaRight: 44 }),
      }),
    ).toBe(390 - 44 - CHILD_MENU_VIEWPORT_GUTTER - 320);
  });

  it("follows a visual viewport that the keyboard pushed sideways", () => {
    expect(
      clampCompactMenuLeft({
        triggerRight: 120,
        menuWidth: 320,
        viewport: viewport({ left: 100 }),
      }),
    ).toBe(100 + CHILD_MENU_VIEWPORT_GUTTER);
  });

  it("never pushes the menu past the left gutter to satisfy the right one", () => {
    const narrow = viewport({ width: 200 });
    expect(
      clampCompactMenuLeft({
        triggerRight: 190,
        menuWidth: 320,
        viewport: narrow,
      }),
    ).toBe(CHILD_MENU_VIEWPORT_GUTTER);
  });
});

describe("compactChildMenuPlacement", () => {
  it("opens below the trigger and stops at the bottom edge", () => {
    const placement = compactChildMenuPlacement({
      triggerBottom: 56,
      triggerRight: 370,
      menuWidth: 320,
      viewport: viewport(),
    });
    expect(placement.top).toBe(56 + CHILD_MENU_VIEWPORT_GUTTER);
    expect(placement.maxHeight).toBe("min(32rem, 628px)");
    expect(placement.maxWidth).toBe(390 - CHILD_MENU_VIEWPORT_GUTTER * 2);
  });

  it("shrinks the menu when the keyboard shortens the visual viewport", () => {
    const placement = compactChildMenuPlacement({
      triggerBottom: 56,
      triggerRight: 370,
      menuWidth: 320,
      viewport: viewport({ height: 300 }),
    });
    expect(placement.maxHeight).toBe("min(32rem, 228px)");
  });

  it("holds the menu below the top safe area when the trigger scrolls under it", () => {
    const placement = compactChildMenuPlacement({
      triggerBottom: -40,
      triggerRight: 370,
      menuWidth: 320,
      viewport: viewport({ safeAreaTop: 59 }),
    });
    expect(placement.top).toBe(59 + CHILD_MENU_VIEWPORT_GUTTER);
  });

  it("never reports a negative height when there is no room below", () => {
    const placement = compactChildMenuPlacement({
      triggerBottom: 900,
      triggerRight: 370,
      menuWidth: 320,
      viewport: viewport({ height: 700, safeAreaBottom: 34 }),
    });
    expect(placement.top).toBe(700 - 34 - CHILD_MENU_VIEWPORT_GUTTER);
    expect(placement.maxHeight).toBe("min(32rem, 0px)");
  });
});
