package ro.diebel.chat.ads

import android.app.Activity
import android.app.Application
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.FormError
import com.google.android.ump.UserMessagingPlatform
import ro.diebel.chat.BuildConfig
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Google UMP: formular de consimțământ doar când platforma cere (ex. EEA).
 * Mobile Ads SDK se inițializează după încheierea fluxului de form/info — fără ads încărcate fără drept.
 */
object ConsentAndMobileAds {

    private val mobileAdsInitialized = AtomicBoolean(false)
    private val consentFlowFinished = AtomicBoolean(false)
    private val umpFlowStarted = AtomicBoolean(false)
    private val readyCallbacks = CopyOnWriteArrayList<() -> Unit>()

    /** După încheierea fluxului UMP (sau imediat dacă ads sunt dezactivate). */
    fun runWhenConsentFlowDone(callback: () -> Unit) {
        if (!AdsConfig.enabled) {
            callback()
            return
        }
        if (consentFlowFinished.get()) {
            callback()
            return
        }
        readyCallbacks.add(callback)
    }

    private fun markConsentFlowFinishedAndFlush() {
        consentFlowFinished.set(true)
        val cbs = readyCallbacks.toList()
        readyCallbacks.clear()
        cbs.forEach { it() }
    }

    /**
     * Pornește din [Activity] (ex. Main). Dacă ads sunt oprite, nu atinge UMP/SDK.
     */
    fun startConsentFlowIfNeeded(activity: Activity) {
        if (!AdsConfig.enabled) {
            markConsentFlowFinishedAndFlush()
            return
        }
        if (!umpFlowStarted.compareAndSet(false, true)) return

        val consentInfo = UserMessagingPlatform.getConsentInformation(activity)
        val paramsBuilder = ConsentRequestParameters.Builder()
        if (BuildConfig.DEBUG && AdsDebug.FORCE_EEA_DEBUG_GEOGRAPHY) {
            val dbg = ConsentDebugSettings.Builder(activity)
                .setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA)
                .build()
            paramsBuilder.setConsentDebugSettings(dbg)
        }

        consentInfo.requestConsentInfoUpdate(
            activity,
            paramsBuilder.build(),
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { _: FormError? ->
                    ensureMobileAdsInitialized(activity.application as Application)
                    markConsentFlowFinishedAndFlush()
                }
            },
            {
                // Fără info de consimțământ (ex. rețea): nu încărcăm creative-uri; inițializăm SDK ca să nu crasheze viitorul AdView.
                ensureMobileAdsInitialized(activity.application as Application)
                markConsentFlowFinishedAndFlush()
            },
        )
    }

    private fun ensureMobileAdsInitialized(app: Application) {
        if (!AdsConfig.enabled) return
        if (!mobileAdsInitialized.compareAndSet(false, true)) return
        MobileAds.initialize(app) {}
    }

    fun canRequestAds(activity: Activity): Boolean {
        if (!AdsConfig.enabled) return false
        return UserMessagingPlatform.getConsentInformation(activity).canRequestAds()
    }
}
