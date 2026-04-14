# WebRTC ICE: TURN mandatory (by design)

- **TURN relay is mandatory** for Align calls. The app does not ship public discovery servers in ICE responses.
- **Non-relay discovery URIs are forbidden** in `GET /api/call/ice-config` JSON: only `turn:` and `turns:` URLs are returned with ephemeral credentials.
- **`/api/call/ice-config` returns HTTP 500** when `TURN_REALM`, `TURN_STATIC_SECRET`, or `NEXT_PUBLIC_TURN_URLS` (with at least one relay URI) are missing or invalid. **This is intentional, not a bug** — calls must not start with a broken half-config.
- **A call cannot start** unless the client receives at least one relay URL plus `username` and `credential` from that route (see `hooks/useWebRtcCall.ts` and `lib/webrtc/connection.ts`).

**REQUIRES MANUAL INFRA TEST (VPS / FIREWALL / 4G):** coturn reachability, TLS on `turns:`, DNS, corporate UDP rules, and `chrome://webrtc-internals` showing `relay` candidates cannot be fully automated in this repo.
