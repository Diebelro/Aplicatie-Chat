export type IceTransportKind = "udp" | "tcp" | "tls";

export type IceLinkDiag = {
  transport: IceTransportKind | null;
  candidateType: string | null;
  effectiveType: string | null;
};

function readStr(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === "string" && v.length ? v : null;
}

function inferTransport(cand: Record<string, unknown>): IceTransportKind | null {
  const url = (readStr(cand, "url") ?? readStr(cand, "address") ?? "").toLowerCase();
  if (url.startsWith("turns:")) return "tls";
  const proto = (readStr(cand, "protocol") ?? "").toLowerCase();
  if (proto === "tcp") return "tcp";
  if (readStr(cand, "tcpType")) return "tcp";
  const relayProto = (readStr(cand, "relayProtocol") ?? "").toLowerCase();
  if (relayProto === "tls") return "tls";
  if (relayProto === "tcp") return "tcp";
  if (proto === "udp") return "udp";
  if (url.startsWith("turn:")) return "udp";
  return null;
}

/**
 * Best-effort selected-path diagnostics from getStats (Chrome-oriented fields).
 */
export function extractIceLinkDiagFromStats(report: RTCStatsReport): IceLinkDiag {
  let transport: IceTransportKind | null = null;
  let candidateType: string | null = null;
  let effectiveType: string | null = null;

  report.forEach((r) => {
    if (r.type !== "candidate-pair") return;
    const pair = r as Record<string, unknown>;
    if (pair.state !== "succeeded") return;
    const lid = pair.localCandidateId;
    if (typeof lid !== "string") return;
    const lc = report.get(lid) as Record<string, unknown> | undefined;
    if (!lc) return;
    const t = inferTransport(lc);
    if (t) transport = t;
    const ct = readStr(lc, "candidateType");
    if (ct) candidateType = ct;
    const et = readStr(lc, "effectiveType");
    if (et) effectiveType = et;
  });

  return { transport, candidateType, effectiveType };
}
