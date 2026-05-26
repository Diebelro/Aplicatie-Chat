package ro.diebel.chat.webrtc

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class SignalingWs(
    private val mainHandler: Handler = Handler(Looper.getMainLooper()),
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var socket: WebSocket? = null
    private val connected = AtomicBoolean(false)
    @Volatile
    private var listener: Listener? = null

    interface Listener {
        fun onOpen()
        fun onJoined(roomId: String, peers: List<String>)
        fun onSession(remoteUserId: String, shouldOffer: Boolean)
        fun onOffer(sdp: String, from: String)
        fun onAnswer(sdp: String, from: String)
        fun onIce(from: String, candidate: String?, sdpMid: String?, sdpMLineIndex: Int)
        fun onCallEnd(from: String)
        fun onError(code: String?)
    }

    fun setListener(l: Listener?) {
        listener = l
    }

    fun connect(url: String) {
        disconnect()
        val req = Request.Builder().url(url).build()
        socket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                connected.set(true)
                mainHandler.post { listener?.onOpen() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                mainHandler.post { dispatchMessage(text) }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected.set(false)
                mainHandler.post { listener?.onError(t.message) }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected.set(false)
            }
        })
    }

    private fun dispatchMessage(text: String) {
        try {
            val j = try {
                JSONObject(text)
            } catch (_: Exception) {
                return
            }
            val t = j.optString("t", "")
            val l = listener ?: return
            when (t) {
                "joined" -> {
                    val rid = j.optString("roomId", "")
                    val peersArr = j.optJSONArray("peers") ?: return
                    val peers = List(peersArr.length()) { peersArr.optString(it, "") }
                    l.onJoined(rid, peers)
                }
                "session" -> l.onSession(
                    j.optString("remoteUserId", ""),
                    j.optBoolean("shouldOffer", false),
                )
                "offer" -> l.onOffer(j.optString("sdp", ""), j.optString("from", ""))
                "answer" -> l.onAnswer(j.optString("sdp", ""), j.optString("from", ""))
                "ice" -> {
                    val cand = j.optJSONObject("candidate") ?: return
                    val from = j.optString("from", "")
                    l.onIce(
                        from,
                        cand.optString("candidate").takeIf { it.isNotEmpty() },
                        cand.optString("sdpMid").takeIf { it.isNotEmpty() },
                        cand.optInt("sdpMLineIndex", 0),
                    )
                }
                "call-end" -> l.onCallEnd(j.optString("from", ""))
                "error" -> l.onError(if (j.has("code")) j.optString("code") else null)
            }
        } catch (e: Exception) {
            Log.w(TAG, "dispatchMessage error", e)
        }
    }

    fun sendJoin(roomId: String, userId: String, isCaller: Boolean) {
        sendJson(
            JSONObject()
                .put("t", "join")
                .put("roomId", roomId)
                .put("userId", userId)
                .put("isCaller", isCaller),
        )
    }

    fun sendOffer(sdp: String, to: String) {
        sendJson(JSONObject().put("t", "offer").put("sdp", sdp).put("to", to))
    }

    fun sendAnswer(sdp: String, to: String) {
        sendJson(JSONObject().put("t", "answer").put("sdp", sdp).put("to", to))
    }

    fun sendIce(candidate: org.webrtc.IceCandidate, to: String) {
        val c = JSONObject()
            .put("candidate", candidate.sdp)
            .put("sdpMid", candidate.sdpMid)
            .put("sdpMLineIndex", candidate.sdpMLineIndex)
        sendJson(JSONObject().put("t", "ice").put("candidate", c).put("to", to))
    }

    fun sendCallEnd() {
        sendJson(JSONObject().put("t", "call-end"))
    }

    fun sendHeartbeat() {
        socket?.send("""{"t":"heartbeat"}""")
    }

    private fun sendJson(o: JSONObject) {
        socket?.send(o.toString())
    }

    fun disconnect() {
        connected.set(false)
        socket?.close(1000, null)
        socket = null
    }

    companion object {
        private const val TAG = "SignalingWs"
    }
}
