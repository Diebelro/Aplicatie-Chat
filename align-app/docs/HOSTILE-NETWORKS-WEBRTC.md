# WebRTC on hostile networks (design)

- Calls are built for **CGNAT, symmetric NAT, corporate Wi‑Fi, and mobile switching**. **TURN relay is mandatory** in configuration; there is **no public discovery ICE fallback** in app responses.
- **`iceTransportPolicy: "all"`** with **relay-only server URLs** lets the browser gather host/srflx locally while connectivity is expected to succeed via **TURN (UDP → TCP → TLS)** when URLs are ordered accordingly.
- **ICE restarts and one automatic recovery** (re-fetch `GET /api/call/ice-config`, `setConfiguration`, new offer with `iceRestart`) are **intentional** — see `lib/webrtc/hostileNetworkGuards.ts` and `hooks/useWebRtcCall.ts`.
- **Fail-fast** with `TURN_REQUIRED:*` messages is preferred over silent half-connected calls.
- **PHYSICAL NETWORK LIMITATION – NOT FIXABLE IN CODE:** site-wide blocking of UDP and TLS to your TURN host, captive portals that strip WebRTC, or broken middleboxes cannot be solved only in JavaScript.

Runtime diagnostics (browser): `globalThis.__ALIGN_HOSTILE_ICE_DIAG__` is updated while a call is active (see `hostileNetworkGuards.ts`). It merges ICE path data with optional **quality** fields (`qualityLevel`, `qualityReason`, `sampleSource`, `lastQualityChangeAt`) and **glare** counters from negotiation when relevant.

### Corporate egress and TURNS on 443

Many office networks allow **HTTPS (TCP 443)** but block **UDP 3478** or **non-443 TCP**. If calls fail only on corporate Wi‑Fi while mobile data works, add a **TURNS** relay URI on **port 443** to `NEXT_PUBLIC_TURN_URLS`, for example:

`turns:turn.example.com:443?transport=tcp`

Keep existing `turn:…:3478?transport=udp` / `turn:…:3478?transport=tcp` entries; the client sorts them **UDP → TCP → TLS** (`lib/webrtc/relayUrlOrder.ts`). When ICE struggles and the public URL list has no `turns:…:443`, the runtime may log a one-shot `[TURN_HINT]` suggesting this (`lib/webrtc/turnCorporateHint.ts`).
