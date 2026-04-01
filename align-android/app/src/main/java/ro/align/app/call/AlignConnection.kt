package ro.align.app.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.telecom.Connection
import android.telecom.DisconnectCause
import android.telecom.TelecomManager

/**
 * Legătură unică cu sistemul: sonerie nativă, ecran complet, răspuns/respinge.
 */
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
        setCallerDisplayName(callerName.ifEmpty { "Align" }, TelecomManager.PRESENTATION_ALLOWED)
    }

    override fun onShowIncomingCallUi() {
        wakeScreen(appContext)
    }

    override fun onAnswer() {
        setActive()
        val i = Intent(appContext, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(CallActivity.EXTRA_ROOM_ID, roomId)
            putExtra(CallActivity.EXTRA_REMOTE_USER_ID, callerId)
            putExtra(CallActivity.EXTRA_AUDIO_ONLY, audioOnly)
            putExtra(CallActivity.EXTRA_IS_CALLER, false)
        }
        appContext.startActivity(i)
    }

    override fun onReject() {
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
        const val EXTRA_ROOM_ID = "align_room_id"
        const val EXTRA_CALLER_ID = "align_caller_id"
        const val EXTRA_CALLER_NAME = "align_caller_name"
        const val EXTRA_AUDIO_ONLY = "align_audio_only"

        fun wakeScreen(context: Context) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            val wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "align:incoming"
            )
            wl.acquire(3000)
            wl.release()
        }
    }
}
