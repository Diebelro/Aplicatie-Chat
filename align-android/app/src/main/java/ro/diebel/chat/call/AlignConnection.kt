package ro.diebel.chat.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.telecom.Connection
import android.telecom.DisconnectCause
import android.telecom.TelecomManager
import android.util.Log

class AlignConnection(
    private val appContext: Context,
    private val roomId: String,
    private val callerId: String,
    private val callerName: String,
    private val audioOnly: Boolean,
) : Connection() {

    init {
        setConnectionProperties(PROPERTY_SELF_MANAGED)
        setAddress(Uri.parse("align:incoming"), TelecomManager.PRESENTATION_ALLOWED)
        setCallerDisplayName(callerName.ifEmpty { "Diebel" }, TelecomManager.PRESENTATION_ALLOWED)
    }

    override fun onShowIncomingCallUi() {
        wakeScreen(appContext)
        // Self-managed: trebuie UI propriu (sonerie + Răspunde/Respinge).
        IncomingCallNotifier.show(appContext, roomId, callerId, callerName, audioOnly)
    }

    override fun onAnswer() {
        setActive()
        IncomingCallNotifier.cancel(appContext)
        val url = IncomingCallNotifier.buildCallUrl(roomId, audioOnly)
        val i = Intent(appContext, ro.diebel.chat.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(ro.diebel.chat.MainActivity.EXTRA_DEEP_LINK_URL, url)
        }
        appContext.startActivity(i)
    }

    override fun onReject() {
        IncomingCallNotifier.cancel(appContext)
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()
    }

    override fun onDisconnect() {
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
    }

    override fun onAbort() {
        setDisconnected(DisconnectCause(DisconnectCause.CANCELED))
        destroy()
    }

    companion object {
        private const val TAG = "AlignConnection"
        const val EXTRA_ROOM_ID = "align_room_id"
        const val EXTRA_CALLER_ID = "align_caller_id"
        const val EXTRA_CALLER_NAME = "align_caller_name"
        const val EXTRA_AUDIO_ONLY = "align_audio_only"

        fun wakeScreen(context: Context) {
            try {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                @Suppress("DEPRECATION")
                val wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "align:incoming",
                )
                wl.acquire(3000)
            } catch (e: Exception) {
                Log.w(TAG, "wakeScreen failed", e)
            }
        }
    }
}
