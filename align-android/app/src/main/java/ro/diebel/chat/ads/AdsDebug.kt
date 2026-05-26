package ro.diebel.chat.ads

/**
 * Pentru testare UMP în afara UE: pune temporar `true`, rulează pe emulator,
 * formularul de consimțământ poate apărea ca în EEA. NU lăsa true în release.
 */
object AdsDebug {
    const val FORCE_EEA_DEBUG_GEOGRAPHY: Boolean = false
}
