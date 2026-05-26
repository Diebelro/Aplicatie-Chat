package ro.diebel.chat

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.ads.AdView
import ro.diebel.chat.ads.AdaptiveBannerController
import ro.diebel.chat.databinding.ActivitySecondaryScreenBinding

/**
 * Ecran secundar (ex. Explore / Setări) — singurul loc unde anexăm Adaptive Banner.
 * Chat-ul va rămâne pe alt container fără acest [FrameLayout].
 */
class SecondaryScreenActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySecondaryScreenBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySecondaryScreenBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.btnBack.setOnClickListener { finish() }
        AdaptiveBannerController.attachIfAllowed(this, binding.bannerContainer)
    }

    override fun onDestroy() {
        if (::binding.isInitialized) {
            (binding.bannerContainer.getChildAt(0) as? AdView)?.destroy()
        }
        super.onDestroy()
    }
}
