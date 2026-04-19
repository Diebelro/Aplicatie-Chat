/** Valori `status` returnate de `GET /api/call/outgoing-status` (contract client–server). */
export const OUTGOING_POLL_STATUSES = ["ringing", "rejected", "unreachable"] as const;
export type OutgoingPollStatus = (typeof OUTGOING_POLL_STATUSES)[number];

const SET = new Set<string>(OUTGOING_POLL_STATUSES);

export function parseOutgoingPollStatus(value: unknown): OutgoingPollStatus | null {
  if (typeof value !== "string") return null;
  return SET.has(value) ? (value as OutgoingPollStatus) : null;
}
