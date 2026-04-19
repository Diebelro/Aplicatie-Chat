/** Faze UI apel — gate fullscreen până la primul „stable”; reconectare ICE = fază + banner, fără re-overlay complet. */
export type CallUiPhase =
  | "idle"
  | "requesting_permissions"
  | "starting_media"
  | "connecting"
  | "stable"
  | "reconnecting"
  | "failed";
