import { safeSetItem } from "./lib/safe-storage";

/** Channel every open sidebar re-reads the sort mode on. */
export const ACTIVE_SORT_CHANNEL = "active-sort";

export const ACTIVE_SORT_MODES = [
  "manual",
  "activity",
  "created",
  "project",
] as const;

export type ActiveSortMode = (typeof ACTIVE_SORT_MODES)[number];

export const DEFAULT_ACTIVE_SORT_MODE: ActiveSortMode = "manual";

export const ACTIVE_SORT_LABELS: Record<ActiveSortMode, string> = {
  manual: "Manual order",
  activity: "Recent activity",
  created: "Date created",
  project: "Project",
};

export function isActiveSortMode(value: string): value is ActiveSortMode {
  return ACTIVE_SORT_MODES.some((mode) => mode === value);
}

/**
 * The sort mode lives in the plugin's database so every window and every
 * device agrees on it, which a per-browser store cannot do. These two keys are
 * only a first-paint cache: the list renders before the first RPC answers, and
 * without them it would show the default for a frame and then jump.
 */
const ACTIVE_SORT_CACHE_KEY = "bb-sidebar:active-sort:v1";
const LEGACY_ACTIVE_GROUPING_KEY = "bb-sidebar:active-grouping:v1";

/**
 * The mode to paint before the server answers: this browser's last known
 * value, or the grouping toggle that preceded the sort picker.
 */
export function cachedActiveSortMode(): ActiveSortMode | null {
  try {
    const stored = window.localStorage.getItem(ACTIVE_SORT_CACHE_KEY);
    if (stored && isActiveSortMode(stored)) return stored;
    return window.localStorage.getItem(LEGACY_ACTIVE_GROUPING_KEY) === "true"
      ? "project"
      : null;
  } catch {
    return null;
  }
}

export function cacheActiveSortMode(mode: ActiveSortMode): ActiveSortMode {
  safeSetItem(ACTIVE_SORT_CACHE_KEY, mode);
  return mode;
}

/**
 * What a browser that stored its choice before the move to the database should
 * hand up to the server, so upgrading does not silently reset the list.
 *
 * Only a server still sitting on the default can be adopted: once someone has
 * chosen a mode, the stored choice is the older one and must not win.
 */
export function activeSortModeToAdopt({
  server,
  cached,
}: {
  server: ActiveSortMode;
  cached: ActiveSortMode | null;
}): ActiveSortMode | null {
  if (server !== DEFAULT_ACTIVE_SORT_MODE) return null;
  if (cached === null || cached === server) return null;
  return cached;
}
