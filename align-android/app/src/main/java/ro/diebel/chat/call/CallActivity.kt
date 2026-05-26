package ro.diebel.chat.call

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.webrtc.SurfaceViewRenderer
import ro.diebel.chat.R
import ro.diebel.chat.data.SessionStore
import ro.diebel.chat.databinding.ActivityCallBinding
import ro.diebel.chat.webrtc.WebRtcCallSession

class CallActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCallBinding
    private var session: WebRtcCallSession? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            binding = ActivityCallBinding.inflate(layoutInflater)
            setContentView(binding.root)

            val roomId = intent.getStringExtra(EXTRA_ROOM_ID) ?: run {
                finish()
                return
            }
            val remoteUserId = intent.getStringExtra(EXTRA_REMOTE_USER_ID) ?: run {
                finish()
                return
            }
            val audioOnly = intent.getBooleanExtra(EXTRA_AUDIO_ONLY, false)
            val isCaller = intent.getBooleanExtra(EXTRA_IS_CALLER, false)

            val store = SessionStore(this)
            val token = store.sessionToken
            val userId = store.userId
            if (token.isNullOrBlank() || userId.isNullOrBlank()) {
                Toast.makeText(this, "Lipsește sesiunea — conectează-te în Diebel.", Toast.LENGTH_LONG).show()
                finish()
                return
            }

            ensureMicAndCamera(audioOnly) {
                startCall(roomId, remoteUserId, audioOnly, isCaller, token, userId)
            }

            binding.hangUp.setOnClickListener {
                session?.end()
                finish()
            }
        } catch (e: Exception) {
            Log.e(TAG, "CallActivity.onCreate failed", e)
            finish()
        }
    }

    private fun ensureMicAndCamera(audioOnly: Boolean, onOk: () -> Unit) {
        val need = mutableListOf<String>()
        need.add(Manifest.permission.RECORD_AUDIO)
        if (!audioOnly) need.add(Manifest.permission.CAMERA)
        val missing = need.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            onOk()
            return
        }
        ActivityCompat.requestPermissions(this, missing.toTypedArray(), REQ_PERM)
        pendingAfterPerm = { onOk() }
    }

    private var pendingAfterPerm: (() -> Unit)? = null

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PERM && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            pendingAfterPerm?.invoke()
        } else {
            Toast.makeText(this, "Permisiuni necesare pentru apel.", Toast.LENGTH_SHORT).show()
            finish()
        }
        pendingAfterPerm = null
    }

    private fun startCall(
        roomId: String,
        remoteUserId: String,
        audioOnly: Boolean,
        isCaller: Boolean,
        sessionToken: String,
        userId: String,
    ) {
        val local: SurfaceViewRenderer? = if (audioOnly) null else binding.localVideo
        val remote: SurfaceViewRenderer? = if (audioOnly) null else binding.remoteVideo
        binding.localVideo.visibility = if (audioOnly) android.view.View.GONE else android.view.View.VISIBLE
        binding.remoteVideo.visibility = if (audioOnly) android.view.View.GONE else android.view.View.VISIBLE

        session = WebRtcCallSession(
            applicationContext,
            roomId,
            remoteUserId,
            isCaller,
            audioOnly,
            sessionToken,
            userId,
            local,
            remote,
            object : WebRtcCallSession.Callback {
                override fun onError(message: String) {
                    runOnUiThread {
                        if (!isFinishing && !isDestroyed) {
                            Toast.makeText(this@CallActivity, message, Toast.LENGTH_LONG).show()
                        }
                    }
                }

                override fun onConnected() {}

                override fun onEnded() {
                    runOnUiThread {
                        if (!isFinishing) finish()
                    }
                }
            }
        )
        session?.start()
    }

    override fun onDestroy() {
        session?.end()
        session = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "CallActivity"
        const val EXTRA_ROOM_ID = "roomId"
        const val EXTRA_REMOTE_USER_ID = "remoteUserId"
        const val EXTRA_AUDIO_ONLY = "audioOnly"
        const val EXTRA_IS_CALLER = "isCaller"
        private const val REQ_PERM = 1001
    }
}
