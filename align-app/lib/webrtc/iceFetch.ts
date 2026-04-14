import { iceConfigFetchErrorMessage, ICE_EMPTY_AFTER_PARSE } from "@/lib/webrtc/iceClientErrors";
import { iceServersFromIceConfigResponse } from "@/lib/webrtc/connection";

export async function fetchRtcIceServers(getHeaders: () => HeadersInit): Promise<RTCIceServer[]> {
  const iceRes = await fetch("/api/call/ice-config", {
    cache: "no-store",
    credentials: "same-origin",
    headers: getHeaders(),
  });
  if (!iceRes.ok) {
    const err = await iceRes.json().catch(() => ({}));
    const apiErr = (err as { error?: string }).error?.trim();
    throw new Error(iceConfigFetchErrorMessage(iceRes.status, apiErr));
  }
  const iceJson = (await iceRes.json()) as Parameters<typeof iceServersFromIceConfigResponse>[0];
  const iceServers = iceServersFromIceConfigResponse(iceJson);
  if (!iceServers.length) {
    throw new Error(ICE_EMPTY_AFTER_PARSE);
  }
  return iceServers;
}
