import { iceConfigFetchErrorMessage, ICE_EMPTY_AFTER_PARSE } from "@/lib/webrtc/iceClientErrors";
import { iceServersFromIceConfigResponse } from "@/lib/webrtc/connection";
import { RtcIceConfigError } from "@/lib/webrtc/rtcIceConfigError";
import { VALID_CALL_API_ERROR_CODES } from "@/lib/call/callErrorCodes";

type IceErrBody = { error?: string; errorCode?: string };

function iceErrorCodeFromBody(status: number, body: IceErrBody, apiErr?: string): string {
  const fromApi = body.errorCode?.trim();
  if (fromApi && VALID_CALL_API_ERROR_CODES.has(fromApi)) return fromApi;
  if (status === 401) return "SIGNALING_TOKEN_INVALID";
  const t = apiErr ?? "";
  if (t.includes("TURN_REALM") || t.includes("TURN_STATIC_SECRET")) return "TURN_NOT_CONFIGURED";
  if (t.includes("TURN_REQUIRED") || t.includes("relay")) return "TURN_CONFIG_INVALID";
  return "TURN_NOT_CONFIGURED";
}

export async function fetchRtcIceServers(getHeaders: () => HeadersInit): Promise<RTCIceServer[]> {
  const iceRes = await fetch("/api/call/ice-config", {
    cache: "no-store",
    credentials: "same-origin",
    headers: getHeaders(),
  });
  if (!iceRes.ok) {
    const err = (await iceRes.json().catch(() => ({}))) as IceErrBody;
    const apiErr = err.error?.trim();
    const code = iceErrorCodeFromBody(iceRes.status, err, apiErr);
    throw new RtcIceConfigError(iceConfigFetchErrorMessage(iceRes.status, apiErr), iceRes.status, code);
  }
  const iceJson = (await iceRes.json()) as Parameters<typeof iceServersFromIceConfigResponse>[0];
  const iceServers = iceServersFromIceConfigResponse(iceJson);
  if (!iceServers.length) {
    throw new RtcIceConfigError(ICE_EMPTY_AFTER_PARSE, iceRes.status, "TURN_CONFIG_INVALID");
  }
  return iceServers;
}
