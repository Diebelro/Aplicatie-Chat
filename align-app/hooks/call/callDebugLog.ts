/**
 * Jurnal local în memorie pentru diagnostic apel (fără backend / upload).
 * Acces: `callDebugLog` din consolă sau DevTools după import dinamic în dev.
 */
export type CallDebugEvent = {
  t: number;
  kind: string;
  detail?: Record<string, unknown>;
};

export const callDebugLog: CallDebugEvent[] = [];

const MAX = 400;

export function pushCallDebug(event: Omit<CallDebugEvent, "t">): void {
  callDebugLog.push({ t: Date.now(), ...event });
  while (callDebugLog.length > MAX) callDebugLog.shift();
}
