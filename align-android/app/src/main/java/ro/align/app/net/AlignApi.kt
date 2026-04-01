package ro.align.app.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.PeerConnection
import ro.align.app.BuildConfig
import java.util.concurrent.TimeUnit

/** REST Align: token semnalizare + ICE (același contract ca web). */
class AlignApi(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
) {
    private val base = BuildConfig.API_BASE_URL.trimEnd('/')

    suspend fun fetchSignalingToken(sessionToken: String, userId: String): String = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/api/call/signaling-token")
            .header("x-session-token", sessionToken)
            .header("x-user-id", userId)
            .get()
            .build()
        client.newCall(req).execute().use { res ->
            val body = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw ApiException("signaling-token ${res.code}: $body")
            val j = JSONObject(body)
            return@withContext j.getString("token")
        }
    }

    suspend fun fetchIceServers(sessionToken: String, userId: String): List<PeerConnection.IceServer> =
        withContext(Dispatchers.IO) {
            val req = Request.Builder()
                .url("$base/api/call/ice-config")
                .header("x-session-token", sessionToken)
                .header("x-user-id", userId)
                .get()
                .build()
            client.newCall(req).execute().use { res ->
                val body = res.body?.string().orEmpty()
                if (!res.isSuccessful) throw ApiException("ice-config ${res.code}: $body")
                val j = JSONObject(body)
                val arr = j.getJSONArray("iceServers")
                val out = ArrayList<PeerConnection.IceServer>()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val urlsJson = o.get("urls")
                    val urls = when (urlsJson) {
                        is String -> listOf(urlsJson)
                        is JSONArray -> List(urlsJson.length()) { urlsJson.getString(it) }
                        else -> emptyList()
                    }
                    val user = o.optString("username", "")
                    val pass = o.optString("credential", "")
                    val builder = PeerConnection.IceServer.builder(urls)
                    if (user.isNotEmpty() && pass.isNotEmpty()) {
                        builder.setUsername(user).setPassword(pass)
                    }
                    out.add(builder.createIceServer())
                }
                return@withContext out
            }
        }

    fun registerFcmToken(sessionToken: String, userId: String, fcmToken: String) {
        val json = JSONObject().put("token", fcmToken).put("platform", "android").toString()
        val body = json.toRequestBody(JSON_MEDIA)
        val req = Request.Builder()
            .url("$base/api/me/push-token")
            .header("x-session-token", sessionToken)
            .header("x-user-id", userId)
            .post(body)
            .build()
        client.newCall(req).execute().close()
    }

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }

    class ApiException(message: String) : Exception(message)
}
