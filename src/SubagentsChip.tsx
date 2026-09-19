import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  experimental_useSidebarThreadActions as useSidebarThreadActions,
  experimental_useSidebarThreads as useSidebarThreads,
  type PluginThreadHeaderActionProps,
} from "@get-bb/plugin-sdk/app";
import {
  ChildThreadDots,
  ChildThreadList,
  childThreadsByParent,
  childNeedsYouCount,
  childrenOf,
} from "./ChildThreadList";
import { cn } from "./lib/utils";
import { Tooltip } from "./components/Tooltip";
import {
  CHILD_MENU_VIEWPORT_GUTTER,
  compactChildMenuPlacement,
  readCompactViewportBounds,
  sameCompactViewportBounds,
  type CompactChildMenuPlacement,
  type CompactViewportBounds,
} from "./child-menu-position";

/**
 * The home for child threads the flat list hides: a chip in the thread header
 * that opens the list of this thread's children.
 *
 * These are bb CHILD THREADS — forks, side chats, and plugin-spawned threads.
 * bb's in-turn subagents are activity counters on the parent, not threads, so
 * the label deliberately says "children".
 */
export function SubagentsChip({
  threadId,
  isCompactViewport,
}: PluginThreadHeaderActionProps) {
  const { threads } = useSidebarThreads();
  const actions = useSidebarThreadActions();
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeAreaProbeRef = useRef<HTMLSpanElement>(null);
  const [viewportBounds, setViewportBounds] =
    useState<CompactViewportBounds | null>(null);
  const [placement, setPlacement] = useState<CompactChildMenuPlacement | null>(
    null,
  );

  const measureViewport = useCallback(() => {
    const next = readCompactViewportBounds(safeAreaProbeRef.current);
    setViewportBounds((current) =>
      sameCompactViewportBounds(current, next) ? current : next,
    );
  }, []);

  const children = childrenOf(threads, threadId);
  const childrenByParent = useMemo(
    () => childThreadsByParent(threads),
    [threads],
  );
  useEffect(() => {
    setOpen(false);
  }, [threadId]);
  useEffect(() => {
    if (children.length === 0) setOpen(false);
  }, [children.length]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !isCompactViewport) return;
    measureViewport();
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", measureViewport);
    visualViewport?.addEventListener("resize", measureViewport);
    visualViewport?.addEventListener("scroll", measureViewport);
    return () => {
      window.removeEventListener("resize", measureViewport);
      visualViewport?.removeEventListener("resize", measureViewport);
      visualViewport?.removeEventListener("scroll", measureViewport);
    };
  }, [isCompactViewport, measureViewport, open]);
  useLayoutEffect(() => {
    if (!open || !isCompactViewport || !viewportBounds) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menu.getBoundingClientRect().width;
    if (menuWidth <= 0) return;
    setPlacement(
      compactChildMenuPlacement({
        triggerBottom: triggerRect.bottom,
        triggerRight: triggerRect.right,
        menuWidth,
        viewport: viewportBounds,
      }),
    );
  }, [isCompactViewport, open, viewportBounds]);
  if (children.length === 0) return null;

  const needsYou = childNeedsYouCount(children) > 0;
  const threadCountLabel = `${children.length} child thread${
    children.length === 1 ? "" : "s"
  }`;
  const label = needsYou
    ? "Needs you"
    : `${children.length} ${children.length === 1 ? "child" : "children"}`;

  return (
    <span className="relative">
      <Tooltip label={threadCountLabel} side="bottom">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={popupId}
          aria-label={threadCountLabel}
          onClick={() => {
            if (!open && isCompactViewport) measureViewport();
            setOpen((value) => !value);
          }}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full border border-border px-2 text-2xs text-muted-foreground",
            "hover:bg-accent hover:text-foreground",
            open && "bg-accent text-foreground",
          )}
        >
          <ChildThreadDots threads={children} />
          {isCompactViewport ? null : (
            <span className="truncate">{label}</span>
          )}
        </button>
      </Tooltip>
      {isCompactViewport ? (
        <span
          ref={safeAreaProbeRef}
          data-child-menu-safe-area-probe=""
          aria-hidden
          className="pointer-events-none fixed invisible size-0"
          style={{
            paddingLeft: "env(safe-area-inset-left)",
            paddingTop: "env(safe-area-inset-top)",
            paddingRight: "env(safe-area-inset-right)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        />
      ) : null}
      {open ? (
        <>
          {/* Click-away. The header is a short row, so the list itself is
              absolutely positioned rather than inline. */}
          <span
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={menuRef}
            id={popupId}
            role="region"
            aria-label="Child threads"
            data-child-menu-placement={
              isCompactViewport ? "viewport" : "trigger"
            }
            className={cn(
              "z-50 flex max-h-[min(32rem,calc(100dvh-6rem))] w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg",
              isCompactViewport ? "fixed" : "absolute right-0 top-9",
            )}
            style={
              isCompactViewport
                ? {
                    left: placement?.left ?? CHILD_MENU_VIEWPORT_GUTTER,
                    top: placement?.top ?? CHILD_MENU_VIEWPORT_GUTTER,
                    maxHeight: placement?.maxHeight,
                    maxWidth: placement?.maxWidth,
                  }
                : undefined
            }
          >
            <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2.5">
              <span className="text-xs font-semibold">Children</span>
              <span className="ml-auto text-2xs text-muted-foreground">
                {children.length}
              </span>
            </div>
            {/* A long child list scrolls inside the menu instead of pushing it
                off the bottom of a phone screen. */}
            <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              <ChildThreadList
                threads={children}
                childrenByParent={childrenByParent}
                variant="header"
                onOpenThread={(childId) => {
                  setOpen(false);
                  actions.open(childId);
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </span>
  );
}
