package ro.diebel.chat.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ro.diebel.chat.MainActivity
import ro.diebel.chat.data.SessionStore
import ro.diebel.chat.net.AlignApi

/** Răspunde / Respinge din notificare sau din [IncomingCallActivity]. */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            PhoneAccountRegistrar.ACTION_ANSWER -> {
                IncomingCallNotifier.cancel(context)
                val roomId = intent.getStringExtra(IncomingCallActivity.EXTRA_ROOM_ID).orEmpty()
                val audioOnly = intent.getBooleanExtra(IncomingCallActivity.EXTRA_AUDIO_ONLY, false)
                val url = intent.getStringExtra(MainActivity.EXTRA_DEEP_LINK_URL)
                    ?: IncomingCallNotifier.buildCallUrl(roomId, audioOnly)
                if (roomId.isBlank()) return
                val i = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra(MainActivity.EXTRA_DEEP_LINK_URL, url)
                }
                context.startActivity(i)
            }
            PhoneAccountRegistrar.ACTION_DECLINE -> {
                IncomingCallNotifier.cancel(context)
                val pending = goAsync()
                val store = SessionStore(context)
                val sid = store.sessionToken
                val uid = store.userId
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        if (!sid.isNullOrBlank() && !uid.isNullOrBlank()) {
                            AlignApi().declineCall(sid, uid)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "declineCall", e)
                    } finally {
                        pending.finish()
                    }
                }
            }
            PhoneAccountRegistrar.ACTION_END -> {
                IncomingCallNotifier.cancel(context)
            }
        }
    }

    companion object {
        private const val TAG = "CallActionReceiver"
    }
}
