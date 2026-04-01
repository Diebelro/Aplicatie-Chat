package ro.align.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Acțiuni din notificări custom (dacă extinzi UI). */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            PhoneAccountRegistrar.ACTION_END -> {
                /* oprește WebRtcCallSession prin serviciu dedicat când integrezi */
            }
        }
    }
}
