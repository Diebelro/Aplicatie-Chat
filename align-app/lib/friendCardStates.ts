/**
 * Visual states and colors for friend/relationship cards.
 * Used by small cards (Toate profilurile) and big card (Descoperă).
 */

import type { CSSProperties } from "react";

export type FriendStatusType = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

/** Culori distincte per stare; nu se repetă între ele. */
export const FRIEND_CARD_COLORS = {
  friends: "#4DA6FF",
  pendingSent: "#A0A0A0",
  pendingReceived: "#C77DFF",
  visitedByYou: "#999999",
  visitedYou: "#9D4EDD",
  messageReceived: "#FF922B",
  messageSeen: "#22B8CF",
  match: "#69DB7C",
  /** Online – verde (distinct de match). */
  online: "#51CF66",
  /** Cont nou – albastru. */
  isNew: "#339AF0",
  /** Profil nedeschis (nevăzut) – gri. */
  notVisited: "#868E96",
} as const;

/** Priority order for which state to show on small card (first match wins). */
export function getSmallCardState(flags: {
  friendStatus: FriendStatusType;
  match?: boolean;
  messageSeen?: boolean;
  receivedMessage?: boolean;
  visitedByThem?: boolean;
  visited?: boolean;
  online?: boolean;
  isNew?: boolean;
}): { border: string; statusKey: string } {
  if (flags.friendStatus === "accepted")
    return { border: FRIEND_CARD_COLORS.friends, statusKey: "friends" };
  if (flags.friendStatus === "pending_sent")
    return { border: FRIEND_CARD_COLORS.pendingSent, statusKey: "pendingSent" };
  if (flags.friendStatus === "pending_received")
    return { border: FRIEND_CARD_COLORS.pendingReceived, statusKey: "pendingReceived" };
  if (flags.match) return { border: FRIEND_CARD_COLORS.match, statusKey: "match" };
  if (flags.messageSeen) return { border: FRIEND_CARD_COLORS.messageSeen, statusKey: "messageSeen" };
  if (flags.receivedMessage) return { border: FRIEND_CARD_COLORS.messageReceived, statusKey: "messageReceived" };
  if (flags.visitedByThem) return { border: FRIEND_CARD_COLORS.visitedYou, statusKey: "visitedYou" };
  if (flags.visited) return { border: FRIEND_CARD_COLORS.visitedByYou, statusKey: "visitedByYou" };
  if (flags.online) return { border: FRIEND_CARD_COLORS.online, statusKey: "online" };
  if (flags.isNew) return { border: FRIEND_CARD_COLORS.isNew, statusKey: "isNew" };
  if (!flags.visited) return { border: FRIEND_CARD_COLORS.notVisited, statusKey: "notVisited" };
  return { border: "", statusKey: "none" };
}

/** Contur + fundal discret pentru card mare (Descoperă) sau orice frame similar listei de profiluri. */
export function getProfileCardChrome(flags: {
  friendStatus: FriendStatusType;
  match?: boolean;
  messageSeen?: boolean;
  receivedMessage?: boolean;
  visitedByThem?: boolean;
  visited?: boolean;
  online?: boolean;
  isNew?: boolean;
}): {
  frameStyle: CSSProperties;
  borderClassName: string;
  statusKey: string;
  /** Profil niciodată deschis: același gri pentru toți + ușor mai închisă zona foto. */
  dimPhoto: boolean;
} {
  const { border, statusKey } = getSmallCardState(flags);
  const hasAccent = Boolean(border);
  const frameStyle: CSSProperties = hasAccent
    ? {
        borderColor: border,
        borderWidth: 2,
        borderStyle: "solid",
        backgroundColor: `${border}14`,
      }
    : {};
  return {
    frameStyle,
    borderClassName: hasAccent ? "border-2 border-solid" : "border border-dark-600",
    statusKey,
    dimPhoto: statusKey === "notVisited",
  };
}

export const SMALL_CARD_STATUS_LABELS: Record<string, string> = {
  friends: "Prieteni",
  pendingSent: "Cerere trimisă",
  pendingReceived: "Cerere primită",
  messageSeen: "A văzut mesajul tău",
  messageReceived: "Mesaj primit",
  visitedYou: "A vizitat profilul tău",
  visitedByYou: "Vizitat de tine",
  match: "Match",
  online: "Online",
  isNew: "Cont nou",
  notVisited: "Profil nedeschis",
  none: "",
};
