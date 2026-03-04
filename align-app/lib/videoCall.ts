const ROOM_PREFIX = "align-";

/** Generează același roomId pentru cei doi utilizatori (ids sortați). */
export function getVideoRoomId(userId1: string, userId2: string): string {
  const ids = [userId1, userId2].sort();
  return ROOM_PREFIX + ids.join("__");
}

/** Extrage id-urile din roomId; returnează null dacă format invalid (nu e pereche). */
export function parseVideoRoomId(roomId: string): [string, string] | null {
  if (!roomId.startsWith(ROOM_PREFIX)) return null;
  const rest = roomId.slice(ROOM_PREFIX.length);
  const parts = rest.split("__");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

/** Room pentru conferință (3+ participanți). Oricine are linkul poate intra. */
export function getConferenceRoomId(): string {
  return ROOM_PREFIX + "conf-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Verifică dacă roomId e de tip conferință. */
export function isConferenceRoomId(roomId: string): boolean {
  return roomId.startsWith(ROOM_PREFIX + "conf-");
}

/** Verifică dacă utilizatorul are acces la room (pereche sau orice room align-*). */
export function canAccessRoom(roomId: string, userId: string): boolean {
  if (!roomId.startsWith(ROOM_PREFIX)) return false;
  const ids = parseVideoRoomId(roomId);
  if (ids) return ids[0] === userId || ids[1] === userId;
  return true; // conferință sau alt format: allow by link
}
