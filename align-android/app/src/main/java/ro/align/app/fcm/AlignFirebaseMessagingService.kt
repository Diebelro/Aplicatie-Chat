package ro.align.app.fcm

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ro.align.app.call.TelecomBridge
import ro.align.app.data.SessionStore
import ro.align.app.net.AlignApi

/**
 * Data-only high priority — fără notification payload implicită; sistemul trezește procesul.
 * Pornește fluxul [TelecomManager] + [AlignConnectionService].
 */
class AlignFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["type"] != "incoming_call") return
        val roomId = message.data["roomId"] ?: return
        val callerId = message.data["callerId"] ?: return
        val callerName = message.data["callerName"].orEmpty()
        val audioOnly = message.data["audioOnly"] == "1"
        TelecomBridge.addIncomingCall(this, roomId, callerId, callerName, audioOnly)
    }

    override fun onNewToken(token: String) {
        val store = SessionStore(this)
        val sid = store.sessionToken ?: return
        val uid = store.userId ?: return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlignApi().registerFcmToken(sid, uid, token)
            } catch (e: Exception) {
                Log.w(TAG, "register FCM token", e)
            }
        }
    }

    companion object {
        private const val TAG = "AlignFCM"
    }
}
