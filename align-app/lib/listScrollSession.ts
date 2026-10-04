/**
 * Păstrează locul pe liste (Profiluri, Match-uri)
 * când utilizatorul deschide un profil și dă Înapoi.
 * Scroll-ul e pe `.app-shell-main` (layout app), nu pe window.
 *
 * Salvăm cardul deschis + offset-ul în viewport, nu doar pixelii:
 * lista e goală la remount și un Y salvat se clamp-uiește la 0.
 */

const PREFIX = "align_list_scroll:";
const restoreGens = new Map<string, number>();
const restoreTimerBags = new Map<string, number[]>();

export type ListPlace = {
  y: number;
  focusId?: string;
  /** Distanța cardului față de top-ul vizibil al `.app-shell-main`. */
  focusTop?: number;
};

export function getAppShellScrollEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(".app-shell-main");
}

export function listItemDomId(listKey: string, itemId: string): string {
  return `list-${listKey}-${itemId}`;
}

function readScrollTop(el: HTMLElement | null): number {
  if (!el) return 0;
  const mainTop = Math.max(0, Math.round(el.scrollTop));
  const docTop = Math.max(
    0,
    Math.round(
      window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
    )
  );
  return Math.max(mainTop, docTop);
}

function parsePlace(raw: string | null): ListPlace | null {
  if (raw == null || raw === "") return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const v = JSON.parse(trimmed) as ListPlace;
      const y = Number(v?.y);
      const focusTop = v?.focusTop != null ? Number(v.focusTop) : undefined;
      const focusId = typeof v?.focusId === "string" && v.focusId ? v.focusId : undefined;
      if (!Number.isFinite(y) && !focusId) return null;
      return {
        y: Number.isFinite(y) && y > 0 ? y : 0,
        focusId,
        focusTop: focusTop != null && Number.isFinite(focusTop) ? focusTop : undefined,
      };
    } catch {
      return null;
    }
  }
  const y = Number(trimmed);
  if (!Number.isFinite(y) || y <= 0) return null;
  return { y };
}

function writePlace(key: string, place: ListPlace): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(place));
  } catch {
    // ignore
  }
}

function measureFocusTop(target: HTMLElement, card: Element): number {
  return Math.round(card.getBoundingClientRect().top - target.getBoundingClientRect().top);
}

function findListCard(listKey: string, focusId: string): HTMLElement | null {
  const byId = document.getElementById(listItemDomId(listKey, focusId));
  if (byId) return byId;
  try {
    return document.querySelector<HTMLElement>(`[data-list-item="${CSS.escape(focusId)}"]`);
  } catch {
    return document.querySelector<HTMLElement>(`[data-list-item="${focusId}"]`);
  }
}

function applyPlace(target: HTMLElement, listKey: string, place: ListPlace): boolean {
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch {
    // ignore
  }

  if (place.focusId) {
    const card = findListCard(listKey, place.focusId);
    if (card) {
      const desiredTop = place.focusTop != null ? place.focusTop : 8;
      const delta = measureFocusTop(target, card) - desiredTop;
      const next = Math.max(0, Math.round(target.scrollTop + delta));
      target.scrollTop = next;
      if (Math.abs(target.scrollTop - next) > 8) {
        window.scrollTo(0, next);
        document.documentElement.scrollTop = next;
        document.body.scrollTop = next;
      }
      return true;
    }
  }

  const y = place.y;
  if (!(y > 0)) return false;
  if (target.scrollHeight < y + 40) return false;
  target.scrollTop = y;
  if (Math.abs(target.scrollTop - y) > 8) {
    window.scrollTo(0, y);
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
  }
  return Math.abs(target.scrollTop - y) <= 24 || Math.abs((window.scrollY || 0) - y) <= 24;
}

function clearRestoreTimers(key: string): void {
  const bag = restoreTimerBags.get(key);
  if (!bag) return;
  for (const id of bag) window.clearTimeout(id);
  restoreTimerBags.set(key, []);
}

/** Salvează locul: cardul apăsat + offset, ca Înapoi să nimerescă același profil. */
export function saveListPlace(key: string, focusId?: string, el?: HTMLElement | null): void {
  if (typeof window === "undefined") return;
  const target = el ?? getAppShellScrollEl();
  const y = readScrollTop(target);
  let focusTop: number | undefined;
  if (focusId && target) {
    const card = findListCard(key, focusId);
    if (card) focusTop = measureFocusTop(target, card);
  }
  const prev = peekListPlace(key);
  if (y <= 0 && !focusId && !prev?.focusId) return;
  writePlace(key, {
    y: y > 0 ? y : prev?.y ?? 0,
    focusId: focusId || prev?.focusId,
    focusTop: focusTop != null ? focusTop : prev?.focusTop,
  });
}

export function saveListScroll(key: string, el?: HTMLElement | null): void {
  saveListPlace(key, undefined, el);
}

export function clearListScroll(key: string): void {
  if (typeof window === "undefined") return;
  clearRestoreTimers(key);
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function peekListPlace(key: string): ListPlace | null {
  if (typeof window === "undefined") return null;
  try {
    return parsePlace(sessionStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}

export function peekListScroll(key: string): number {
  return peekListPlace(key)?.y ?? 0;
}

export function hasListPlace(key: string): boolean {
  const p = peekListPlace(key);
  return p != null && ((p.y > 0 && Number.isFinite(p.y)) || Boolean(p.focusId));
}

/**
 * Restaurează locul după ce lista e randată.
 * Revine true dacă a găsit cardul sau a putut aplica Y-ul.
 */
export function restoreListScroll(key: string, el?: HTMLElement | null): boolean {
  if (typeof window === "undefined") return false;
  const place = peekListPlace(key);
  if (!place) return false;
  const target = el ?? getAppShellScrollEl();
  if (!target) return false;

  const gen = (restoreGens.get(key) ?? 0) + 1;
  restoreGens.set(key, gen);
  clearRestoreTimers(key);

  const apply = (): boolean => {
    if (restoreGens.get(key) !== gen) return false;
    const live = el ?? getAppShellScrollEl();
    if (!live) return false;
    return applyPlace(live, key, place);
  };

  const okNow = apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(() => {
      apply();
    });
  });
  // Fetch + filtre + Next scroll-to-top pot veni târziu; reîncearcă până găsim cardul.
  const delays = [16, 48, 120, 280, 480, 800, 1400, 2200];
  const bag: number[] = [];
  for (const ms of delays) {
    bag.push(
      window.setTimeout(() => {
        apply();
      }, ms)
    );
  }
  restoreTimerBags.set(key, bag);
  return okNow;
}

const RETURN_KEY = "align_profile_return_path";

/** Salvează de unde ai deschis profilul public (/app, /app/profiles, …). */
export function saveProfileReturnPath(path: string): void {
  if (typeof window === "undefined") return;
  const clean = path.startsWith("/app") ? path.split("?")[0] : "/app/profiles";
  try {
    sessionStorage.setItem(RETURN_KEY, clean);
  } catch {
    // ignore
  }
}

export function readProfileReturnPath(fallback = "/app/profiles"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    if (v && v.startsWith("/app") && !v.startsWith("/app/user/")) return v;
  } catch {
    // ignore
  }
  return fallback;
}
