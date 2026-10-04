package ro.diebel.chat.call

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import ro.diebel.chat.MainActivity
import ro.diebel.chat.R

/**
 * Notificare tip apel (sonerie + full-screen) — fallback/complement la Telecom,
 * ca să sune și când app-ul e închis / ecranul e blocat.
 */
object IncomingCallNotifier {
    const val NOTIFICATION_ID = 7101
    private const val TAG = "IncomingCallNotifier"

    fun show(
        context: Context,
        roomId: String,
        callerId: String,
        callerName: String,
        audioOnly: Boolean,
    ) {
        val app = context.applicationContext
        val displayName = callerName.ifBlank { app.getString(R.string.incoming_call) }
        val callUrl = buildCallUrl(roomId, audioOnly)

        val fullScreenIntent = Intent(app, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_NO_USER_ACTION
            putExtra(IncomingCallActivity.EXTRA_ROOM_ID, roomId)
            putExtra(IncomingCallActivity.EXTRA_CALLER_ID, callerId)
            putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, displayName)
            putExtra(IncomingCallActivity.EXTRA_AUDIO_ONLY, audioOnly)
        }
        val fullScreenPi = PendingIntent.getActivity(
            app,
            roomId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val answerIntent = Intent(app, CallActionReceiver::class.java).apply {
            action = PhoneAccountRegistrar.ACTION_ANSWER
            putExtra(IncomingCallActivity.EXTRA_ROOM_ID, roomId)
            putExtra(IncomingCallActivity.EXTRA_CALLER_ID, callerId)
            putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, displayName)
            putExtra(IncomingCallActivity.EXTRA_AUDIO_ONLY, audioOnly)
            putExtra(MainActivity.EXTRA_DEEP_LINK_URL, callUrl)
        }
        val answerPi = PendingIntent.getBroadcast(
            app,
            roomId.hashCode() + 1,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val declineIntent = Intent(app, CallActionReceiver::class.java).apply {
            action = PhoneAccountRegistrar.ACTION_DECLINE
            putExtra(IncomingCallActivity.EXTRA_ROOM_ID, roomId)
        }
        val declinePi = PendingIntent.getBroadcast(
            app,
            roomId.hashCode() + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val caller = Person.Builder().setName(displayName).setImportant(true).build()
        val contentText = if (audioOnly) {
            app.getString(R.string.incoming_audio_call)
        } else {
            app.getString(R.string.incoming_video_call)
        }

        val builder = NotificationCompat.Builder(app, PhoneAccountRegistrar.CHANNEL_INCOMING)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(displayName)
            .setContentText(contentText)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(60_000L)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, app.getString(R.string.decline_call), declinePi)
            .addAction(android.R.drawable.sym_action_call, app.getString(R.string.answer_call), answerPi)
            .setColorized(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setStyle(
                NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, answerPi)
            )
        }

        try {
            NotificationManagerCompat.from(app).notify(NOTIFICATION_ID, builder.build())
        } catch (e: SecurityException) {
            Log.w(TAG, "notify denied (POST_NOTIFICATIONS?)", e)
        } catch (e: Exception) {
            Log.w(TAG, "notify failed", e)
        }

        // Pornește UI-ul full-screen și când sistemul blochează startActivity din FCM.
        try {
            app.startActivity(fullScreenIntent)
        } catch (e: Exception) {
            Log.w(TAG, "start IncomingCallActivity failed (full-screen intent still active)", e)
        }
    }

    fun cancel(context: Context) {
        try {
            NotificationManagerCompat.from(context.applicationContext).cancel(NOTIFICATION_ID)
        } catch (_: Exception) {
        }
    }

    fun buildCallUrl(roomId: String, audioOnly: Boolean): String {
        val qs = buildString {
            append("?from=push")
            if (audioOnly) append("&audio=1")
        }
        return "https://chat.diebel.ro/app/call/$roomId$qs"
    }
}
