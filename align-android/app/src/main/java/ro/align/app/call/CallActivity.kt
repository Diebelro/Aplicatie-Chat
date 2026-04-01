package ro.align.app.call

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.webrtc.SurfaceViewRenderer
import ro.align.app.R
import ro.align.app.data.SessionStore
import ro.align.app.databinding.ActivityCallBinding
import ro.align.app.webrtc.WebRtcCallSession

class CallActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCallBinding
    private var session: WebRtcCallSession? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
        if (!store.isLoggedIn()) {
            Toast.makeText(this, "Lipsește sesiunea — conectează-te în Align.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        ensureMicAndCamera(audioOnly) {
            startCall(roomId, remoteUserId, audioOnly, isCaller, store)
        }

        binding.hangUp.setOnClickListener {
            session?.end()
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
            Toast.makeText(this, R.string.app_name, Toast.LENGTH_SHORT).show()
            finish()
        }
        pendingAfterPerm = null
    }

    private fun startCall(
        roomId: String,
        remoteUserId: String,
        audioOnly: Boolean,
        isCaller: Boolean,
        store: SessionStore,
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
            store.sessionToken!!,
            store.userId!!,
            local,
            remote,
            object : WebRtcCallSession.Callback {
                override fun onError(message: String) {
                    runOnUiThread {
                        Toast.makeText(this@CallActivity, message, Toast.LENGTH_LONG).show()
                    }
                }

                override fun onConnected() {}

                override fun onEnded() {
                    runOnUiThread { finish() }
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
        const val EXTRA_ROOM_ID = "roomId"
        const val EXTRA_REMOTE_USER_ID = "remoteUserId"
        const val EXTRA_AUDIO_ONLY = "audioOnly"
        const val EXTRA_IS_CALLER = "isCaller"
        private const val REQ_PERM = 1001
    }
}
