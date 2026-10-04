package ro.diebel.chat.call

import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import ro.diebel.chat.MainActivity
import ro.diebel.chat.R
import ro.diebel.chat.databinding.ActivityIncomingCallBinding

/**
 * Ecran full-screen peste lock screen — sonerie nativă + Răspunde / Respinge.
 * La răspuns deschide WebView-ul pe `/app/call/...` (același WebRTC ca în app).
 */
class IncomingCallActivity : AppCompatActivity() {

    private lateinit var binding: ActivityIncomingCallBinding
    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null

    private var roomId: String = ""
    private var callerId: String = ""
    private var callerName: String = ""
    private var audioOnly: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        binding = ActivityIncomingCallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        roomId = intent.getStringExtra(EXTRA_ROOM_ID).orEmpty()
        callerId = intent.getStringExtra(EXTRA_CALLER_ID).orEmpty()
        callerName = intent.getStringExtra(EXTRA_CALLER_NAME).orEmpty()
            .ifBlank { getString(R.string.incoming_call) }
        audioOnly = intent.getBooleanExtra(EXTRA_AUDIO_ONLY, false)

        if (roomId.isBlank()) {
            finish()
            return
        }

        binding.callerName.text = callerName
        binding.callType.text = if (audioOnly) {
            getString(R.string.incoming_audio_call)
        } else {
            getString(R.string.incoming_video_call)
        }

        binding.answerBtn.setOnClickListener { answer() }
        binding.declineBtn.setOnClickListener { decline() }

        AlignConnection.wakeScreen(this)
        startRinging()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onDestroy() {
        stopRinging()
        super.onDestroy()
    }

    private fun answer() {
        stopRinging()
        IncomingCallNotifier.cancel(this)
        val url = IncomingCallNotifier.buildCallUrl(roomId, audioOnly)
        val i = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(MainActivity.EXTRA_DEEP_LINK_URL, url)
        }
        startActivity(i)
        finish()
    }

    private fun decline() {
        stopRinging()
        IncomingCallNotifier.cancel(this)
        sendBroadcast(
            Intent(this, CallActionReceiver::class.java).apply {
                action = PhoneAccountRegistrar.ACTION_DECLINE
                putExtra(EXTRA_ROOM_ID, roomId)
            }
        )
        finish()
    }

    private fun startRinging() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(applicationContext, uri)?.also { r ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    r.isLooping = true
                }
                r.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                r.play()
            }
        } catch (_: Exception) {
        }
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(VibratorManager::class.java)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Vibrator::class.java)
            }
            val pattern = longArrayOf(0, 800, 400, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (_: Exception) {
        }
    }

    private fun stopRinging() {
        try {
            ringtone?.stop()
        } catch (_: Exception) {
        }
        ringtone = null
        try {
            vibrator?.cancel()
        } catch (_: Exception) {
        }
        vibrator = null
    }

    companion object {
        const val EXTRA_ROOM_ID = "roomId"
        const val EXTRA_CALLER_ID = "callerId"
        const val EXTRA_CALLER_NAME = "callerName"
        const val EXTRA_AUDIO_ONLY = "audioOnly"
    }
}
