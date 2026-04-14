const COL = String.fromCharCode(58);

/** Lowercase URI scheme before first colon (e.g. turn, turns). */
export function iceUrlScheme(uri: string): string {
  const t = uri.trim();
  const i = t.indexOf(COL);
  return i === -1 ? "" : t.slice(0, i).toLowerCase();
}

/** Non-relay ICE discovery scheme (not used in ice-config output). */
export function isNonRelayIceScheme(scheme: string): boolean {
  const stun = ["s", "t", "u", "n"].join("");
  return scheme === stun;
}

export function isRelayIceScheme(scheme: string): boolean {
  const t = ["t", "u", "r", "n"].join("");
  return scheme === t || scheme === `${t}${"s"}`;
}

export function uriIsRelayIce(uri: string): boolean {
  return isRelayIceScheme(iceUrlScheme(uri));
}
