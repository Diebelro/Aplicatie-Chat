package ro.align.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import ro.align.app.call.PhoneAccountRegistrar

class AlignApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        PhoneAccountRegistrar.ensureAccount(this)
        createCallChannels()
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
            setSound(null, null)
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
