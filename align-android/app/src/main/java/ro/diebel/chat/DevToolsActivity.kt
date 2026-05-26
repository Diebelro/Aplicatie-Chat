package ro.diebel.chat

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import ro.diebel.chat.call.CallActivity
import ro.diebel.chat.data.SessionStore
import ro.diebel.chat.databinding.ActivityDevToolsBinding
import ro.diebel.chat.net.AlignApi

/** Ecran tehnic FCM / apeluri — nu e launcher; nu apare la review Play. */
class DevToolsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDevToolsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDevToolsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val store = SessionStore(this)
        binding.inputUserId.setText(store.userId.orEmpty())
        binding.inputSession.setText(store.sessionToken.orEmpty())

        binding.btnSaveSession.setOnClickListener {
            store.userId = binding.inputUserId.text?.toString()?.trim().orEmpty()
            store.sessionToken = binding.inputSession.text?.toString()?.trim().orEmpty()
            Toast.makeText(this, "Salvat.", Toast.LENGTH_SHORT).show()
        }

        binding.btnStartOutgoingCall.setOnClickListener {
            val uid = store.userId?.trim().orEmpty()
            val remote = binding.inputRemoteUserId.text?.toString()?.trim().orEmpty()
            if (uid.isEmpty() || remote.isEmpty()) {
                Toast.makeText(this, "Completează userId, sesiunea și ID-ul sunat.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (uid == remote) {
                Toast.makeText(this, "ID-ul sunat trebuie să fie alt cont.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val sorted = listOf(uid, remote).sorted()
            val roomId = "align-${sorted[0]}__${sorted[1]}"
            val audioOnly = binding.checkAudioOnlyCall.isChecked
            startActivity(
                Intent(this, CallActivity::class.java).apply {
                    putExtra(CallActivity.EXTRA_ROOM_ID, roomId)
                    putExtra(CallActivity.EXTRA_REMOTE_USER_ID, remote)
                    putExtra(CallActivity.EXTRA_AUDIO_ONLY, audioOnly)
                    putExtra(CallActivity.EXTRA_IS_CALLER, true)
                },
            )
        }

        binding.btnOpenSecondary.setOnClickListener {
            startActivity(Intent(this, SecondaryScreenActivity::class.java))
        }

        binding.btnRegisterFcm.setOnClickListener {
            val uid = store.userId?.trim().orEmpty()
            val tok = store.sessionToken?.trim().orEmpty()
            if (uid.isEmpty() || tok.isEmpty()) {
                Toast.makeText(this, "Completează userId și token.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val fcm = FirebaseMessaging.getInstance().token.await()
                    withContext(Dispatchers.IO) {
                        AlignApi().registerFcmToken(tok, uid, fcm)
                    }
                    binding.fcmStatus.text = "FCM înregistrat OK."
                } catch (e: Exception) {
                    binding.fcmStatus.text = "Eroare: ${e.message}"
                }
            }
        }
    }
}
