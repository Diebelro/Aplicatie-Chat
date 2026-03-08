/**
 * Visual states and colors for friend/relationship cards.
 * Used by small cards (Toate profilurile) and big card (Descoperă).
 */

export type FriendStatusType = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

export const FRIEND_CARD_COLORS = {
  friends: "#4DA6FF",
  pendingSent: "#A0A0A0",
  pendingReceived: "#C77DFF",
  visitedByYou: "#999999",
  visitedYou: "#9D4EDD",
  messageSent: "#FFD43B",
  messageReceived: "#FF922B",
  messageSeen: "#4DABF7",
  match: "#69DB7C",
} as const;

/** Priority order for which state to show on small card (first match wins). */
export function getSmallCardState(flags: {
  friendStatus: FriendStatusType;
  match?: boolean;
  messageSeen?: boolean;
  receivedMessage?: boolean;
  sentMessage?: boolean;
  visitedByThem?: boolean;
  visited?: boolean;
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
  if (flags.sentMessage) return { border: FRIEND_CARD_COLORS.messageSent, statusKey: "messageSent" };
  if (flags.visitedByThem) return { border: FRIEND_CARD_COLORS.visitedYou, statusKey: "visitedYou" };
  if (flags.visited) return { border: FRIEND_CARD_COLORS.visitedByYou, statusKey: "visitedByYou" };
  return { border: "", statusKey: "none" };
}

export const SMALL_CARD_STATUS_LABELS: Record<string, string> = {
  friends: "Prieteni",
  pendingSent: "Cerere trimisă",
  pendingReceived: "Cerere primită",
  messageSeen: "A văzut mesajul tău",
  messageReceived: "Mesaj primit",
  messageSent: "Mesaj trimis",
  visitedYou: "A vizitat profilul tău",
  visitedByYou: "Vizitat de tine",
  match: "Match",
  none: "",
};
