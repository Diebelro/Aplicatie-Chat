/**
 * Anti-bot: blocare device la comportament suspect (swipe-uri imposibil de rapide etc.).
 * Loghează evenimentele suspecte pentru analiză. Persistență în memorie (producție: Redis/DB).
 */

import { recordSecurityThreat, type ThreatSeverity } from "@/lib/securityThreats";

export type SuspiciousEventReason = "fast_swipe" | "rate_limit_swipe" | "blocked_device_access" | "automated_behavior";

export interface SuspiciousEventLog {
  at: string;
  reason: SuspiciousEventReason;
  userId?: string;
  deviceId?: string;
  fingerprint?: string;
  ip?: string;
  toId?: string;
  count?: number;
}

const blockedFingerprints = new Set<string>();
const blockedDeviceIds = new Set<string>();
const suspiciousByFingerprint = new Map<string, number>();
const suspiciousByDeviceId = new Map<string, number>();
const SUSPICIOUS_THRESHOLD = 3;
const MAX_LOG_ENTRIES = 5000;
const suspiciousEventsLog: SuspiciousEventLog[] = [];

function severityForDeviceReason(reason: SuspiciousEventReason): ThreatSeverity {
  if (reason === "blocked_device_access" || reason === "automated_behavior") return "high";
  if (reason === "rate_limit_swipe") return "medium";
  return "low";
}

function appendLog(entry: Omit<SuspiciousEventLog, "at">): void {
  suspiciousEventsLog.push({ ...entry, at: new Date().toISOString() });
  if (suspiciousEventsLog.length > MAX_LOG_ENTRIES) {
    suspiciousEventsLog.splice(0, suspiciousEventsLog.length - MAX_LOG_ENTRIES);
  }
  const sev = severityForDeviceReason(entry.reason);
  if (sev !== "low") {
    recordSecurityThreat({
      severity: sev,
      type: `device_${entry.reason}`,
      message:
        entry.reason === "blocked_device_access"
          ? "Încercare acces de pe device blocat"
          : entry.reason === "automated_behavior"
            ? "Comportament automat / prag de încredere depășit"
            : entry.reason === "rate_limit_swipe"
              ? "Swipe limitat (rate limit)"
              : `Eveniment: ${entry.reason}`,
      ip: entry.ip,
      userId: entry.userId,
      meta: [entry.fingerprint, entry.deviceId].filter(Boolean).join(" · ") || undefined,
    });
  }
}

/** Doar loghează un eveniment suspect, fără a incrementa contoare sau bloca. */
export function logSuspiciousEvent(entry: Omit<SuspiciousEventLog, "at">): void {
  appendLog(entry);
}

export function getSuspiciousEventsLog(): SuspiciousEventLog[] {
  return [...suspiciousEventsLog];
}

export function isDeviceBlocked(fingerprint: string | null, deviceId: string | null): boolean {
  if (fingerprint && blockedFingerprints.has(fingerprint)) return true;
  if (deviceId && blockedDeviceIds.has(deviceId)) return true;
  return false;
}

export function recordSuspiciousBehavior(
  fingerprint: string | null,
  deviceId: string | null,
  meta?: { reason?: SuspiciousEventReason; userId?: string; ip?: string; toId?: string }
): void {
  const reason = meta?.reason ?? "fast_swipe";
  appendLog({
    reason,
    userId: meta?.userId,
    deviceId: deviceId ?? undefined,
    fingerprint: fingerprint ?? undefined,
    ip: meta?.ip,
    toId: meta?.toId,
  });
  if (fingerprint) {
    const n = (suspiciousByFingerprint.get(fingerprint) ?? 0) + 1;
    suspiciousByFingerprint.set(fingerprint, n);
    if (n >= SUSPICIOUS_THRESHOLD) {
      blockedFingerprints.add(fingerprint);
      appendLog({ reason: "automated_behavior", fingerprint, count: n });
    }
  }
  if (deviceId) {
    const n = (suspiciousByDeviceId.get(deviceId) ?? 0) + 1;
    suspiciousByDeviceId.set(deviceId, n);
    if (n >= SUSPICIOUS_THRESHOLD) {
      blockedDeviceIds.add(deviceId);
      appendLog({ reason: "automated_behavior", deviceId, count: n });
    }
  }
}

export function blockDevice(fingerprint: string | null, deviceId: string | null): void {
  if (fingerprint) {
    blockedFingerprints.add(fingerprint);
    appendLog({ reason: "automated_behavior", fingerprint });
  }
  if (deviceId) {
    blockedDeviceIds.add(deviceId);
    appendLog({ reason: "automated_behavior", deviceId });
  }
}
