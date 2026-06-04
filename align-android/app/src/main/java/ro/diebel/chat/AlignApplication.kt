package ro.diebel.chat

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
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
        val incoming = NotificationChannel(
            PhoneAccountRegistrar.CHANNEL_INCOMING,
            getString(R.string.call_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.call_channel_desc)
            val ring: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            setSound(ring, null)
            enableVibration(true)
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
