import Foundation

/// Echo `lib/webrtc/signaling.ts` → `signalingWsConnectUrl`.
func buildSignalingURL(base: String, token: String) -> URL? {
    var trimmed = base.trimmingCharacters(in: .whitespacesAndNewlines)
    while trimmed.hasSuffix("/") { trimmed.removeLast() }
    let withWs: String
    if trimmed.hasSuffix("/ws") {
        withWs = trimmed
    } else {
        withWs = "\(trimmed)/ws"
    }
    var comp = URLComponents(string: withWs)
    var q = comp?.queryItems ?? []
    q.append(URLQueryItem(name: "token", value: token))
    comp?.queryItems = q
    return comp?.url
}
