/** Version bump if you need to show the gate again after policy changes. */
export const AGE_GATE_STORAGE_KEY = "diebel_age_gate_v1";

export function readAgeGateAccepted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AGE_GATE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAgeGateAccepted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, "1");
  } catch {
    /* ignore quota */
  }
}
