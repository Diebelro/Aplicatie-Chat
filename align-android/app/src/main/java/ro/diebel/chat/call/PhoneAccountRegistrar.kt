package ro.diebel.chat.call

import android.content.ComponentName
import android.content.Context
import android.os.Process
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log

/**
 * Cont VoIP self-managed — necesar pentru [android.telecom.ConnectionService] și apeluri cu ecran blocat.
 */
object PhoneAccountRegistrar {
    const val ACCOUNT_ID = "align_voip"
    const val CHANNEL_INCOMING = "align_calls_incoming"
    const val CHANNEL_ONGOING = "align_calls_ongoing"
    const val ACTION_DECLINE = "ro.diebel.chat.ACTION_DECLINE_CALL"
    const val ACTION_END = "ro.diebel.chat.ACTION_END_CALL"

    private const val TAG = "PhoneAccountRegistrar"

    fun ensureAccount(context: Context) {
        val app = context.applicationContext
        val tm = app.getSystemService(TelecomManager::class.java) ?: return
        val handle = handle(app)
        if (tm.getPhoneAccount(handle) != null) return
        val account = PhoneAccount.Builder(handle, "Align")
            .setCapabilities(
                PhoneAccount.CAPABILITY_SELF_MANAGED or PhoneAccount.CAPABILITY_VIDEO_CALLING
            )
            .build()
        try {
            tm.registerPhoneAccount(account)
        } catch (e: SecurityException) {
            // Play / unele build-uri: MANAGE_OWN_CALLS sau politici Telecom — nu crăpăm la cold start.
            Log.w(TAG, "registerPhoneAccount denied", e)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "registerPhoneAccount invalid", e)
        } catch (e: RuntimeException) {
            Log.w(TAG, "registerPhoneAccount failed", e)
        }
    }

    fun handle(context: Context): PhoneAccountHandle {
        val cn = ComponentName(context, AlignConnectionService::class.java)
        return PhoneAccountHandle(cn, ACCOUNT_ID, Process.myUserHandle())
    }
}
