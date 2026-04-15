/**
 * Verificări „produs” pentru panoul admin: apeluri (env + semnalizare), mesaje (DB).
 * Fără secrete în răspuns.
 */

import { prisma } from "@/lib/db";
import { isPrismaAvailable } from "@/lib/repo-prisma";
import { buildWebrtcPublicEnvSnapshot } from "@/lib/webrtcPublicEnvSnapshot";

export type SignalingHealthResult = {
  checked: boolean;
  url: string | null;
  ok: boolean | null;
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
};

export type MessagesHealthResult = {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  lastMessageAt: string | null;
};

export type AdminProductHealth = {
  webrtc: ReturnType<typeof buildWebrtcPublicEnvSnapshot> & {
    summaryOk: boolean;
  };
  signalingHealth: SignalingHealthResult;
  messages: MessagesHealthResult;
};

/** URL HTTPS pentru GET /health al serverului de semnalizare (Nginx → Node). */
export function resolveSignalingHealthUrl(): string | null {
  const explicit = process.env.SIGNALING_HEALTH_URL?.trim();
  if (explicit) return explicit;
  const ws = process.env.NEXT_PUBLIC_SIGNALING_WS_URL?.trim();
  if (!ws) return null;
  try {
    const u = new URL(ws);
    const proto = u.protocol === "wss:" ? "https:" : "http:";
    return `${proto}//${u.host}/health`;
  } catch {
    return null;
  }
}

async function probeSignalingHealth(url: string): Promise<Omit<SignalingHealthResult, "checked" | "url">> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "text/plain,*/*" },
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const text = (await r.text()).trim();
    const bodyOk = text.toLowerCase() === "ok" || text.startsWith("ok");
    const ok = r.ok && bodyOk;
    return {
      ok,
      httpStatus: r.status,
      latencyMs: ms,
      error: ok ? null : r.ok ? `Răspuns neașteptat: ${text.slice(0, 120)}` : `HTTP ${r.status}`,
    };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      httpStatus: null,
      latencyMs: Date.now() - t0,
      error: msg.slice(0, 200),
    };
  }
}

export async function getAdminProductHealth(opts: { dbUp: boolean }): Promise<AdminProductHealth> {
  const snap = buildWebrtcPublicEnvSnapshot();
  const summaryOk = snap.envLayerCompleteForCalls && snap.turnRequiredOk;

  const healthUrl = resolveSignalingHealthUrl();
  let signalingHealth: SignalingHealthResult = {
    checked: false,
    url: healthUrl,
    ok: null,
    httpStatus: null,
    latencyMs: null,
    error: null,
  };
  if (healthUrl) {
    signalingHealth = { checked: true, url: healthUrl, ...(await probeSignalingHealth(healthUrl)) };
  }

  let messages: MessagesHealthResult = {
    ok: true,
    skipped: true,
    error: null,
    lastMessageAt: null,
  };
  if (opts.dbUp && isPrismaAvailable()) {
    messages.skipped = false;
    try {
      const row = await prisma.message.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      messages.lastMessageAt = row?.createdAt?.toISOString() ?? null;
      messages.ok = true;
    } catch (e) {
      messages.ok = false;
      messages.error = e instanceof Error ? e.message.slice(0, 240) : "Eroare citire mesaje";
    }
  }

  return {
    webrtc: { ...snap, summaryOk },
    signalingHealth,
    messages,
  };
}

export function productHealthShortStrip(p: AdminProductHealth): string {
  const w = p.webrtc.summaryOk ? "Apeluri env OK" : "Apeluri env incomplet";
  let s: string;
  if (!p.signalingHealth.checked) s = "Semnalizare nedeclarată";
  else if (p.signalingHealth.ok) s = `Semnalizare OK (${p.signalingHealth.latencyMs ?? "?"}ms)`;
  else s = "Semnalizare FAIL";
  const m = p.messages.skipped ? "Mesaje (DB oprit)" : p.messages.ok ? "Mesaje OK" : "Mesaje FAIL";
  return `${w} · ${s} · ${m}`;
}
