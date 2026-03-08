import type { InternalAd } from "@/lib/internalAds";

export type FeedItemType = "profile" | "internal_ad" | "external_ad";

export interface FeedItemProfile {
  type: "profile";
  data: unknown; // UserWithMeta
}

export interface FeedItemInternalAd {
  type: "internal_ad";
  data: InternalAd;
}

/** external_ad nu are data (doar type). */
export interface FeedItemExternalAd {
  type: "external_ad";
}

export type FeedItem = FeedItemProfile | FeedItemInternalAd | FeedItemExternalAd;

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface BuildFeedOptions {
  profiles: unknown[];
  internalAds: InternalAd[];
  isPremium: boolean;
  minCardsBeforeAds: number;
  internalInterval: number;
  externalInterval: number;
}

/**
 * Construiește feed-ul conform specificației (data, nu payload).
 * Semnătură: buildFeed({ profiles, internalAds, isPremium, minCardsBeforeAds, internalInterval, externalInterval }).
 */
export function buildFeed(options: BuildFeedOptions): FeedItem[] {
  const { profiles, internalAds, isPremium, minCardsBeforeAds, internalInterval, externalInterval } = options;

  if (isPremium) {
    return profiles.map((p) => ({ type: "profile" as const, data: p }));
  }

  const feed: FeedItem[] = [];
  let index = 0;
  let lastWasAd = false;
  let internalIndex = 0;

  for (const profile of profiles) {
    feed.push({ type: "profile", data: profile });
    index += 1;

    if (index < minCardsBeforeAds) {
      lastWasAd = false;
      continue;
    }

    if (lastWasAd) {
      lastWasAd = false;
      continue;
    }

    if (index % internalInterval === 0 && internalAds[internalIndex]) {
      feed.push({ type: "internal_ad", data: internalAds[internalIndex] });
      internalIndex += 1;
      lastWasAd = true;
      continue;
    }

    if (index % externalInterval === 0) {
      feed.push({ type: "external_ad" });
      lastWasAd = true;
      continue;
    }

    lastWasAd = false;
  }

  return feed;
}

/** Intervale inițiale aleatoare în range. */
export function getInitialIntervals(
  internalMin: number,
  internalMax: number,
  externalMin: number,
  externalMax: number
): { internal: number; external: number } {
  return {
    internal: randomInRange(internalMin, internalMax),
    external: randomInRange(externalMin, externalMax),
  };
}

/** Intervale după like: internalInterval = min(14, +1), externalInterval = min(25, +1). Compatibil cu API-ul din spec. */
export function adjustIntervalsAfterLike(
  internalInterval: number,
  externalInterval: number
): { internalInterval: number; externalInterval: number } {
  return {
    internalInterval: Math.min(14, internalInterval + 1),
    externalInterval: Math.min(25, externalInterval + 1),
  };
}

/** Swipe rapid (< 2.5 s/card): externalInterval = max(10, externalInterval - 1). Returnează doar external (internal neschimbat). */
export function adjustIntervalsAfterFastSwipe(externalInterval: number): { externalInterval: number } {
  return { externalInterval: Math.max(10, externalInterval - 1) };
}

/** Intervale după interacțiune (like): primește obiect intervals, returnează { internal, external }. */
export function adjustAfterInteraction(intervals: { internal: number; external: number }): { internal: number; external: number } {
  return {
    internal: Math.min(14, intervals.internal + 1),
    external: Math.min(25, intervals.external + 1),
  };
}

/** Swipe rapid: primește obiect intervals, returnează { internal, external } (doar external scade). */
export function adjustAfterFastSwipeState(intervals: { internal: number; external: number }): { internal: number; external: number } {
  return {
    internal: intervals.internal,
    external: Math.max(10, intervals.external - 1),
  };
}

