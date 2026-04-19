/** Coduri stabile `{ errorCode }` din `app/api/call/**` + mapare `pages.callRoom.apiErrors.<CODE>`. */
export const CALL_API_ERROR_CODES = [
  "SIGNALING_NOT_CONFIGURED",
  "SIGNALING_TOKEN_INVALID",
  "SIGNALING_SERVICE_UNAVAILABLE",
  "TURN_NOT_CONFIGURED",
  "TURN_CONFIG_INVALID",
  "CALL_TIMEOUT",
  "NEGOTIATION_FAILED",
  "PERMISSION_DENIED",
  "DEVICE_NOT_FOUND",
  "NETWORK_UNREACHABLE",
  "UNKNOWN",
] as const;

export type CallApiErrorCode = (typeof CALL_API_ERROR_CODES)[number];

export const VALID_CALL_API_ERROR_CODES = new Set<string>(CALL_API_ERROR_CODES);
