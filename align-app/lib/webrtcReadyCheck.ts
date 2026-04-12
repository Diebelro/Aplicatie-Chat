/**
 * Strat FINAL: ce poate confirma doar aplicația (Vercel/Next) înainte de apeluri reale.
 *
 * ---------------------------------------------------------------------------------------------
 * Dacă `readyFromApp === true`, NU mai lipsesc configurări în aplicație — tot ce urmează
 * (apel efectiv, relay ICE, semnalizare live) este rețea + infrastructură externă (VPS,
 * coturn, firewall, TLS). Nu presupunem că serverele rulează sau că porturile sunt deschise.
 * ---------------------------------------------------------------------------------------------
 */

import { runIceConfigForCheck, runSignalingTokenForCheck } from "@/lib/webrtcFullCheck";
import {
  getPublicSignalingWsBaseUrl,
  getWebrtcPublicConfig,
} from "@/lib/env/webrtcConfig";

/** Listă fixă — restul este în afara repo-ului Next/Vercel. */
export const WEBRTC_EXTERNAL_INFRA_CHECKLIST = [
  "WebSocket VPS",
  "coturn",
  "Firewall ports",
] as const;

export type WebrtcReadySummary = "APP_READY_WAITING_FOR_VPS" | "APP_NOT_READY";

export type WebrtcReadyCheckJson = {
  readyFromApp: boolean;
  missingFromApp: string[];
  requiresExternalInfra: true;
  externalInfraChecklist: readonly string[];
  summary: WebrtcReadySummary;
  /** Non-secret hints; doar pentru UI / script. */
  diagnostics?: {
    hasStunInUrls: boolean;
    hasTurnInUrls: boolean;
    signalingWsConfigured: boolean;
    webrtcPublicEnabled: boolean;
  };
};

export async function buildWebrtcReadyCheck(
  userId: string | null
): Promise<WebrtcReadyCheckJson> {
  const externalInfraChecklist = WEBRTC_EXTERNAL_INFRA_CHECKLIST;
  const base = {
    requiresExternalInfra: true as const,
    externalInfraChecklist,
  };

  if (!userId) {
    return {
      ...base,
      readyFromApp: false,
      missingFromApp: ["NOT_AUTHENTICATED"],
      summary: "APP_NOT_READY",
    };
  }

  const missing: string[] = [];
  const signalingUrl = getPublicSignalingWsBaseUrl();
  if (!signalingUrl) {
    missing.push("MISSING_NEXT_PUBLIC_SIGNALING_WS_URL");
  }

  let webrtcPublicEnabled = true;
  try {
    const pub = getWebrtcPublicConfig();
    webrtcPublicEnabled = pub.NEXT_PUBLIC_WEBRTC_ENABLED !== false;
    if (!webrtcPublicEnabled) {
      missing.push("NEXT_PUBLIC_WEBRTC_DISABLED");
    }
  } catch {
    missing.push("WEBRTC_PUBLIC_CONFIG_INVALID");
  }

  const sig = await runSignalingTokenForCheck(userId);
  if (!sig.ok) {
    missing.push(`SIGNALING_TOKEN:${sig.error}`);
  }

  const ice = await runIceConfigForCheck(userId);
  if (!ice.ok) {
    missing.push(`ICE_CONFIG:${ice.error}`);
  }

  const deduped = [...new Set(missing)];
  const readyFromApp = deduped.length === 0;

  return {
    ...base,
    readyFromApp,
    missingFromApp: deduped,
    summary: readyFromApp ? "APP_READY_WAITING_FOR_VPS" : "APP_NOT_READY",
    diagnostics: {
      hasStunInUrls: ice.hasStun,
      hasTurnInUrls: ice.hasTurn,
      signalingWsConfigured: Boolean(signalingUrl),
      webrtcPublicEnabled,
    },
  };
}
