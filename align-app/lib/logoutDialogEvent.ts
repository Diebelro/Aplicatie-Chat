/** Eveniment global: deschide dialogul unificat de ieșire (header, setări, profil, mobil). */
export const LOGOUT_DIALOG_OPEN_EVENT = "align:logout-dialog-open";

export function requestOpenLogoutDialog(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOGOUT_DIALOG_OPEN_EVENT));
}
