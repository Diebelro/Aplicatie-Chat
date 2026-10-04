package ro.diebel.chat

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import ro.diebel.chat.ads.LaunchTracker
import ro.diebel.chat.call.PhoneAccountRegistrar

class AlignApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            LaunchTracker.incrementColdStart(this)
            FirebaseBootstrap.initializeIfConfigured(this)
            PhoneAccountRegistrar.ensureAccount(this)
            createCallChannels()
        } catch (e: Exception) {
            Log.e("AlignApplication", "onCreate partial failure", e)
        }
    }

    private fun createCallChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java) ?: return
        // Recreează canalul ca să aplice soneria de tip ringtone (importanță MAX).
        try {
            nm.deleteNotificationChannel(PhoneAccountRegistrar.CHANNEL_INCOMING)
        } catch (_: Exception) {
        }
        val incoming = NotificationChannel(
            PhoneAccountRegistrar.CHANNEL_INCOMING,
            getString(R.string.call_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.call_channel_desc)
            val ring: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(ring, attrs)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 800, 400, 800)
            setBypassDnd(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        val ongoing = NotificationChannel(
            PhoneAccountRegistrar.CHANNEL_ONGOING,
            getString(R.string.ongoing_call),
            NotificationManager.IMPORTANCE_LOW
        )
        nm.createNotificationChannel(incoming)
        nm.createNotificationChannel(ongoing)
    }
}
