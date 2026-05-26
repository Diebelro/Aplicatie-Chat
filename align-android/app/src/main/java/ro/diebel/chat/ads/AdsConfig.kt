package ro.diebel.chat.ads

import ro.diebel.chat.BuildConfig

// Ads infrastructure only. Monetization disabled by default.

/**
 * Comutator central pentru reclame. [BuildConfig.ADS_ENABLED] vine din `defaultConfig` / `buildTypes`
 * (release: false implicit; debug: true ca să poți testa infrastructura).
 */
object AdsConfig {
    val enabled: Boolean get() = BuildConfig.ADS_ENABLED

    /** Google sample App ID (DEBUG / integrare) — înlocuiește în manifest la go-live. */
    const val TEST_APPLICATION_ID = "ca-app-pub-3940256099942544~3347511713"

    /** Adaptive Banner test unit — mereu acest ID până la producție reală. */
    const val TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/6300978111"
}
