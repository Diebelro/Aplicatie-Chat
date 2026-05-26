package ro.diebel.chat.call

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import ro.diebel.chat.R

/** Rezervat pentru notificare apel în curs + tip foreground persistent (extinde când adaugi hold / transfer). */
class CallForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val n = NotificationCompat.Builder(this, PhoneAccountRegistrar.CHANNEL_ONGOING)
            .setContentTitle(getString(R.string.ongoing_call))
            .setSmallIcon(android.R.drawable.sym_call_outgoing)
            .setOngoing(true)
            .build()
        startForeground(NOTIFICATION_ID, n)
        return START_STICKY
    }

    companion object {
        private const val NOTIFICATION_ID = 7021
    }
}
