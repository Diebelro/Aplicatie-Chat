import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "ro.diebel.chat"
    compileSdk = 35
    val signingProps = Properties()
    val signingPropsFile = rootProject.file("keystore.properties")
    if (signingPropsFile.exists()) signingPropsFile.inputStream().use { signingProps.load(it) }

    defaultConfig {
        applicationId = "ro.diebel.chat"
        minSdk = 28
        targetSdk = 35
        versionCode = 27
        versionName = "1.2.7"
        val props = Properties()
        val lp = rootProject.file("local.properties")
        if (lp.exists()) lp.inputStream().use { props.load(it) }
        // API = Next app (chat). Semnalizare = host VPS (ws), același ca NEXT_PUBLIC_SIGNALING_WS_URL pe Vercel — NU amesteca cu domeniul chat.
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
            // v1 + v2 pentru telefoane care nu acceptă doar v3.
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = false
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
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
