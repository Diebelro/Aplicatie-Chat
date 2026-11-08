import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "ro.diebel.chat"
    compileSdk = 36
    val signingProps = Properties()
    val signingPropsFile = rootProject.file("keystore.properties")
    if (signingPropsFile.exists()) signingPropsFile.inputStream().use { signingProps.load(it) }

    defaultConfig {
        applicationId = "ro.diebel.chatapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 47
        versionName = "47.0.0"
        val props = Properties()
        val lp = rootProject.file("local.properties")
        if (lp.exists()) lp.inputStream().use { props.load(it) }
        // API + semnalizare = VPS producție (chat.diebel.ro / ws.diebel.ro) — același stack ca web-ul live.
        val baseUrl = props.getProperty("align.apiBaseUrl", "https://chat.diebel.ro/")
        val signalingWs = props.getProperty("align.signalingWsUrl", "wss://ws.diebel.ro")
        buildConfigField("String", "API_BASE_URL", "\"${baseUrl.trimEnd('/')}/\"")
        buildConfigField("String", "SIGNALING_WS_BASE", "\"${signalingWs.trimEnd('/')}\"")
        // Ads: set true only when you want banners live; false = zero AdMob/UMP work at runtime.
        buildConfigField("boolean", "ADS_ENABLED", "false")
    }

    signingConfigs {
        create("release") {
            val storeFilePath = signingProps.getProperty("storeFile")?.trim().orEmpty()
            if (storeFilePath.isNotEmpty()) {
                storeFile = rootProject.file(storeFilePath)
                storePassword = signingProps.getProperty("storePassword")
                keyAlias = signingProps.getProperty("keyAlias")
                keyPassword = signingProps.getProperty("keyPassword")
            }
            // v1 + v2 — compatibilitate instalare directă (WhatsApp); fără doar-v3.
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = false
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (signingPropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            // Debug builds: poți testa bannerul + UMP (tot cu ID-uri de test de mai jos).
            buildConfigField("boolean", "ADS_ENABLED", "true")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.getstream:stream-webrtc-android:1.3.7")

    // AdMob (banners) + UMP (GDPR / consimțământ). Versiuni aliniate la setul curent stabil Play services.
    implementation("com.google.android.gms:play-services-ads:24.9.0")
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")
}

/** APK debug pentru test direct pe telefon (semnătură debug — instalare fără keystore release). */
tasks.register("exportDebugApk") {
    group = "distribution"
    description = "Diebel-Debug.apk pentru instalare directă"
    dependsOn("assembleDebug")
    doLast {
        val apkIn = layout.buildDirectory.file("outputs/apk/debug/app-debug.apk").get().asFile
        val apkOut = rootProject.layout.projectDirectory.file("Diebel-Debug.apk").asFile
        check(apkIn.isFile) { "Lipsește ${apkIn.path}" }
        apkIn.copyTo(apkOut, overwrite = true)
        logger.lifecycle("OK: ${apkOut.absolutePath}")
    }
}

/** După assembleRelease + bundleRelease, copiază la nume fixe (fără Copy tasks separate — evită conflict Gradle). */
tasks.register("exportReleaseArtifacts") {
    group = "distribution"
    description = "Diebel-V46-INSTALARE-TELEFON.apk + Diebel-V46-Play-Console.aab"
    dependsOn("assembleRelease", "bundleRelease")
    doLast {
        val apkIn = layout.buildDirectory.file("outputs/apk/release/app-release.apk").get().asFile
        val aabIn = layout.buildDirectory.file("outputs/bundle/release/app-release.aab").get().asFile
        val apkOut = rootProject.layout.projectDirectory.file("Diebel-V46-INSTALARE-TELEFON.apk").asFile
        val aabOut =
            rootProject.layout.projectDirectory.dir("../play-store-assets")
                .file("Diebel-V46-Play-Console.aab").asFile
        check(apkIn.isFile) { "Lipsește ${apkIn.path} — rulează assembleRelease" }
        check(aabIn.isFile) { "Lipsește ${aabIn.path} — rulează bundleRelease" }
        check(rootProject.file("keystore.properties").exists()) {
            "Lipsește keystore.properties — APK-ul trebuie semnat pentru instalare"
        }
        apkIn.copyTo(apkOut, overwrite = true)
        // Nume scurt alternativ — unele telefoane/WhatsApp strică fișiere cu nume lung.
        val apkShort = rootProject.layout.projectDirectory.file("Diebel-Instalare.apk").asFile
        apkIn.copyTo(apkShort, overwrite = true)
        val webDir = rootProject.layout.projectDirectory.dir("../align-app/public/download").asFile
        webDir.mkdirs()
        apkIn.copyTo(webDir.resolve("diebel.apk"), overwrite = true)
        aabIn.copyTo(aabOut, overwrite = true)
        logger.lifecycle("OK: ${apkOut.absolutePath}")
        logger.lifecycle("OK: ${apkShort.absolutePath}")
        logger.lifecycle("OK: ${webDir.resolve("diebel.apk").absolutePath}")
        logger.lifecycle("OK: ${aabOut.absolutePath}")
    }
}
