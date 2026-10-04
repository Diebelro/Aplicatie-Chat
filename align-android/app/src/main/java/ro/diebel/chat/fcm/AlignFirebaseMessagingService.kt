package ro.diebel.chat.fcm

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ro.diebel.chat.call.IncomingCallNotifier
import ro.diebel.chat.call.TelecomBridge
import ro.diebel.chat.data.SessionStore
import ro.diebel.chat.net.AlignApi

class AlignFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        try {
            if (message.data["type"] != "incoming_call") return
            val roomId = message.data["roomId"]?.trim().orEmpty()
            if (roomId.isEmpty()) return
            val callerId = message.data["callerId"]?.trim().orEmpty()
            val callerName = message.data["callerName"]?.trim().orEmpty()
            val audioOnly = message.data["audioOnly"] == "1"

            // 1) Telecom self-managed (UI de sistem, când e permis).
            if (callerId.isNotEmpty()) {
                TelecomBridge.addIncomingCall(
                    applicationContext,
                    roomId,
                    callerId,
                    callerName.ifBlank { "Diebel" },
                    audioOnly,
                )
            }

            // 2) Notificare CallStyle + ecran full-screen + sonerie nativă (WhatsApp-like).
            IncomingCallNotifier.show(
                applicationContext,
                roomId,
                callerId,
                callerName.ifBlank { getString(ro.diebel.chat.R.string.incoming_call) },
                audioOnly,
            )
        } catch (e: Exception) {
            Log.e(TAG, "onMessageReceived failed", e)
        }
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
