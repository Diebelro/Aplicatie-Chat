package ro.diebel.chat.ads

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import ro.diebel.chat.BuildConfig

/**
 * Un singur Adaptive Banner ancorat (lățime ecran). Folosit doar pe ecrane secundare, niciodată în chat WebView.
 */
object AdaptiveBannerController {

    fun attachIfAllowed(
        activity: Activity,
        container: ViewGroup,
    ) {
        container.removeAllViews()
        if (!BuildConfig.ADS_ENABLED) {
            container.visibility = View.GONE
            return
        }
        if (LaunchTracker.isFirstLaunchSession(activity)) {
            container.visibility = View.GONE
            return
        }

        // Așteptăm încheierea fluxului UMP + MobileAds.initialize (sau „no-op” dacă ads oprite).
        ConsentAndMobileAds.runWhenConsentFlowDone {
            activity.runOnUiThread {
                if (activity.isDestroyed) return@runOnUiThread
                if (!BuildConfig.ADS_ENABLED) {
                    container.visibility = View.GONE
                    return@runOnUiThread
                }
                if (LaunchTracker.isFirstLaunchSession(activity)) {
                    container.visibility = View.GONE
                    return@runOnUiThread
                }
                if (!ConsentAndMobileAds.canRequestAds(activity)) {
                    container.visibility = View.GONE
                    return@runOnUiThread
                }

                val adWidthDp = (activity.resources.displayMetrics.widthPixels /
                    activity.resources.displayMetrics.density).toInt()
                val adView = AdView(activity).apply {
                    adUnitId = AdsConfig.TEST_BANNER_AD_UNIT_ID
                    setAdSize(
                        AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, adWidthDp),
                    )
                }
                container.addView(adView)
                container.visibility = View.VISIBLE
                adView.loadAd(AdRequest.Builder().build())
            }
        }
    }
}
