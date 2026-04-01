package ro.align.app.webrtc

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/** Echo din `lib/webrtc/signaling.ts` → `signalingWsConnectUrl`. */
fun buildSignalingUrl(baseUrl: String, token: String): String {
    val trimmed = baseUrl.trim().trimEnd('/')
    val withPath = if (trimmed.endsWith("/ws") || trimmed.endsWith("/ws/")) trimmed else "$trimmed/ws"
    val enc = URLEncoder.encode(token, StandardCharsets.UTF_8.name())
    return "$withPath?token=$enc"
}
