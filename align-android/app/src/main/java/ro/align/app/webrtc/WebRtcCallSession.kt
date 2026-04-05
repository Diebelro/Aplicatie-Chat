package ro.align.app.webrtc

import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import ro.align.app.BuildConfig
import ro.align.app.net.AlignApi

/**
 * PeerConnection nativ (Google WebRTC), semnalizare compatibilă cu serverul Align existent.
 * Video: opțional; dacă [localPreview] / [remoteView] sunt setate, pornește Camera2 pentru apel video.
 */
class WebRtcCallSession(
    private val appContext: Context,
    private val roomId: String,
    /** Celălalt participant (apelant dacă tu ești callee). */
    private val remoteUserId: String,
    private val isCaller: Boolean,
    val audioOnly: Boolean,
    private val sessionToken: String,
    private val myUserId: String,
    private val localPreview: SurfaceViewRenderer?,
    private val remoteView: SurfaceViewRenderer?,
    private val callback: Callback,
) {
    interface Callback {
        fun onError(message: String)
        fun onConnected()
        fun onEnded()
    }

    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val api = AlignApi()
    private val signaling = SignalingWs(main)

    private var factoryRef: PeerConnectionFactory? = null
    private var eglBase: EglBase? = null
    private var peerConnection: PeerConnection? = null
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null

    private val pendingRemoteIce = mutableListOf<IceCandidate>()
    private var remoteDescrSet = false
    private val signalingUrlBase = BuildConfig.SIGNALING_WS_BASE

    fun start() {
        signaling.setListener(object : SignalingWs.Listener {
            override fun onOpen() {
                signaling.sendJoin(roomId, myUserId, isCaller)
                main.post { scheduleHeartbeat() }
            }

            override fun onJoined(roomId: String, peers: List<String>) {
                /* așteptăm session */
            }

            override fun onSession(remoteUserId: String, shouldOffer: Boolean) {
                if (shouldOffer) {
                    createOffer()
                }
            }

            override fun onOffer(sdp: String, from: String) {
                setRemoteSDP(SessionDescription(SessionDescription.Type.OFFER, sdp)) {
                    createAnswer()
                }
            }

            override fun onAnswer(sdp: String, from: String) {
                setRemoteSDP(SessionDescription(SessionDescription.Type.ANSWER, sdp), null)
            }

            override fun onIce(from: String, candidate: String?, sdpMid: String?, sdpMLineIndex: Int) {
                if (candidate.isNullOrEmpty()) return
                val ice = IceCandidate(sdpMid ?: "", sdpMLineIndex, candidate)
                if (remoteDescrSet) {
                    peerConnection?.addIceCandidate(ice)
                } else {
                    synchronized(pendingRemoteIce) { pendingRemoteIce.add(ice) }
                }
            }

            override fun onCallEnd(from: String) {
                end()
            }

            override fun onError(code: String?) {
                callback.onError(code ?: "signaling")
            }
        })

        scope.launch {
            try {
                if (isCaller) {
                    withContext(Dispatchers.IO) {
                        api.ringCallee(sessionToken, myUserId, remoteUserId, roomId, audioOnly)
                    }
                }
                val iceServers = api.fetchIceServers(sessionToken, myUserId)
                val sigTok = api.fetchSignalingToken(sessionToken, myUserId)
                val wsUrl = buildSignalingUrl(signalingUrlBase, sigTok)
                withContext(Dispatchers.Main) {
                    ensureFactory()
                    localPreview?.init(eglBase!!.eglBaseContext, null)
                    remoteView?.init(eglBase!!.eglBaseContext, null)
                    createPeerConnection(iceServers)
                    signaling.connect(wsUrl)
                }
            } catch (e: Exception) {
                callback.onError(e.message ?: "start failed")
            }
        }
    }

    private var heartbeatPosted = false
    private fun scheduleHeartbeat() {
        if (heartbeatPosted) return
        heartbeatPosted = true
        main.postDelayed(object : Runnable {
            override fun run() {
                signaling.sendHeartbeat()
                main.postDelayed(this, 25_000L)
            }
        }, 25_000L)
    }

    private fun ensureFactory() {
        if (factoryRef != null) return
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext).createInitializationOptions()
        )
        val egl = EglBase.create()
        eglBase = egl
        factoryRef = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
            .createPeerConnectionFactory()
    }

    private fun createPeerConnection(iceServers: List<PeerConnection.IceServer>) {
        val rtc = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        val pc = factoryRef!!.createPeerConnection(rtc, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                if (state == PeerConnection.IceConnectionState.CONNECTED ||
                    state == PeerConnection.IceConnectionState.COMPLETED
                ) {
                    callback.onConnected()
                }
                if (state == PeerConnection.IceConnectionState.FAILED ||
                    state == PeerConnection.IceConnectionState.CLOSED
                ) {
                    callback.onEnded()
                }
            }

            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate ?: return
                signaling.sendIce(candidate, remoteUserId)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}

            override fun onTrack(transceiver: RtpTransceiver?) {
                val track = transceiver?.receiver?.track() ?: return
                if (track.kind() == "video" && remoteView != null && track is VideoTrack) {
                    track.addSink(remoteView)
                }
            }
        }) ?: return
        peerConnection = pc

        val ss = MediaConstraints()
        val audioSource = factoryRef!!.createAudioSource(ss)
        localAudioTrack = factoryRef!!.createAudioTrack("align_audio", audioSource)
        pc.addTrack(localAudioTrack, listOf("local_stream"))

        if (!audioOnly && localPreview != null && factoryRef != null) {
            try {
                val enumerator = org.webrtc.Camera2Enumerator(appContext)
                val names = enumerator.deviceNames
                val dev = names.firstOrNull { enumerator.isFrontFacing(it) } ?: names.firstOrNull()
                if (dev != null) {
                    videoCapturer = enumerator.createCapturer(dev, null)
                    val surfaceTextureHelper =
                        org.webrtc.SurfaceTextureHelper.create("CaptureThread", eglBase!!.eglBaseContext)
                    val vs: VideoSource = factoryRef!!.createVideoSource(false)
                    videoCapturer!!.initialize(surfaceTextureHelper, appContext, vs.capturerObserver)
                    videoCapturer!!.startCapture(1280, 720, 30)
                    localVideoTrack = factoryRef!!.createVideoTrack("align_video", vs)
                    localVideoTrack?.addSink(localPreview)
                    pc.addTrack(localVideoTrack, listOf("local_stream"))
                }
            } catch (_: Exception) {
                /* video opțional */
            }
        }
    }

    private fun createOffer() {
        val pc = peerConnection ?: return
        val offerS = MediaConstraints()
        pc.createOffer(object : SdpAdapter() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc ?: return
                pc.setLocalDescription(object : SdpAdapter() {
                    override fun onSetSuccess() {
                        signaling.sendOffer(desc.description, remoteUserId)
                    }
                }, desc)
            }
        }, offerS)
    }

    private fun createAnswer() {
        val pc = peerConnection ?: return
        pc.createAnswer(object : SdpAdapter() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc ?: return
                pc.setLocalDescription(object : SdpAdapter() {
                    override fun onSetSuccess() {
                        signaling.sendAnswer(desc.description, remoteUserId)
                    }
                }, desc)
            }
        }, MediaConstraints())
    }

    private fun setRemoteSDP(desc: SessionDescription, then: (() -> Unit)?) {
        val pc = peerConnection ?: return
        pc.setRemoteDescription(object : SdpAdapter() {
            override fun onSetSuccess() {
                remoteDescrSet = true
                synchronized(pendingRemoteIce) {
                    for (c in pendingRemoteIce) {
                        pc.addIceCandidate(c)
                    }
                    pendingRemoteIce.clear()
                }
                then?.invoke()
            }
        }, desc)
    }

    fun end() {
        main.post {
            try {
                signaling.sendCallEnd()
            } catch (_: Exception) {
            }
            signaling.disconnect()
            try {
                videoCapturer?.stopCapture()
                videoCapturer?.dispose()
            } catch (_: Exception) {
            }
            videoCapturer = null
            try {
                localPreview?.release()
                remoteView?.release()
            } catch (_: Exception) {
            }
            localVideoTrack?.dispose()
            localVideoTrack = null
            localAudioTrack?.dispose()
            localAudioTrack = null
            peerConnection?.close()
            peerConnection = null
            factoryRef?.dispose()
            factoryRef = null
            eglBase?.release()
            eglBase = null
            scope.cancel()
            callback.onEnded()
        }
    }

    private open class SdpAdapter : SdpObserver {
        override fun onCreateSuccess(p0: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {}
        override fun onSetFailure(p0: String?) {}
    }
}
