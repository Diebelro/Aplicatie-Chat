package ro.align.app

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import ro.align.app.data.SessionStore
import ro.align.app.databinding.ActivityMainBinding
import ro.align.app.net.AlignApi

/**
 * Shell minim: salvează sesiunea + înregistrează FCM.
 * Chat-ul rămâne în Next.js (WebView poate fi adăugat aici).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        val store = SessionStore(this)
        binding.inputUserId.setText(store.userId.orEmpty())
        binding.inputSession.setText(store.sessionToken.orEmpty())

        binding.btnSaveSession.setOnClickListener {
            store.userId = binding.inputUserId.text?.toString()?.trim().orEmpty()
            store.sessionToken = binding.inputSession.text?.toString()?.trim().orEmpty()
            Toast.makeText(this, "Salvat.", Toast.LENGTH_SHORT).show()
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
