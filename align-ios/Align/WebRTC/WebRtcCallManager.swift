import Foundation
import WebRTC

/// PeerConnection nativ; semnalizare compatibilă cu serverul Align existent.
final class WebRtcCallManager: NSObject, RTCPeerConnectionDelegate {
    private var factory: RTCPeerConnectionFactory?
    private var pc: RTCPeerConnection?
    private let signaling = SignalingWebSocket()

    private var remoteSdpApplied = false
    private var remoteIceQueue: [RTCIceCandidate] = []
    private let iceLock = NSLock()

    private var roomId = ""
    private var remoteUserId = ""
    private var myUserId = ""
    private var sessionToken = ""
    private var isCaller = false
    private var audioOnly = true

    weak var remoteVideoView: RTCMTLVideoView?
    weak var localVideoView: RTCMTLVideoView?
    private var videoCapturer: RTCCameraVideoCapturer?

    private var heartbeat: Timer?

    var onEnded: (() -> Void)?
    var onError: ((String) -> Void)?

    func start(
        meta: PendingCallMetadata,
        session: String,
        myUserId: String,
        localView: RTCMTLVideoView?,
        remoteView: RTCMTLVideoView?
    ) {
        roomId = meta.roomId
        remoteUserId = meta.remoteUserId
        self.myUserId = myUserId
        sessionToken = session
        isCaller = meta.isCaller
        audioOnly = meta.audioOnly
        localVideoView = localView
        remoteVideoView = remoteView

        signaling.onJson = { [weak self] json in self?.handleSignaling(json) }
        signaling.onConnected = { [weak self] in
            guard let self else { return }
            self.signaling.sendJoin(roomId: roomId, userId: myUserId, isCaller: isCaller)
            self.startHeartbeat()
        }

        Task { await runStart() }
    }

    private func runStart() async {
        do {
            if isCaller {
                try await AlignAPI.ringCallee(
                    session: sessionToken,
                    userId: myUserId,
                    toId: remoteUserId,
                    roomId: roomId,
                    audioOnly: audioOnly
                )
            }
            let iceJson = try await AlignAPI.fetchIceServers(session: sessionToken, userId: myUserId)
            let sigTok = try await AlignAPI.fetchSignalingToken(session: sessionToken, userId: myUserId)
            guard let wsURL = buildSignalingURL(base: AlignConfig.signalingWsBase, token: sigTok) else {
                await MainActor.run { onError?("URL semnalizare invalid") }
                return
            }
            let servers = mapIce(json: iceJson)
            guard !servers.isEmpty else {
                await MainActor.run { onError?("TURN_REQUIRED: ice-config returned no usable TURN relay servers") }
                return
            }
            await MainActor.run {
                self.bootstrapPeer(iceServers: servers)
                self.signaling.connect(url: wsURL)
            }
        } catch {
            await MainActor.run { onError?(error.localizedDescription) }
        }
    }

    private func mapIce(json: [[String: Any]]) -> [RTCIceServer] {
        json.compactMap { o -> RTCIceServer? in
            let urlsAny = o["urls"] as Any?
            let urlStrings: [String]
            if let s = urlsAny as? String { urlStrings = [s] }
            else if let a = urlsAny as? [String] { urlStrings = a }
            else { return nil }
            let relay = urlStrings.filter { raw in
                let u = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                return u.hasPrefix("turn:") || u.hasPrefix("turns:")
            }
            guard !relay.isEmpty else { return nil }
            guard let username = o["username"] as? String, !username.isEmpty,
                  let credential = o["credential"] as? String, !credential.isEmpty else { return nil }
            return RTCIceServer(urlStrings: relay, username: username, credential: credential)
        }
    }

    private func bootstrapPeer(iceServers: [RTCIceServer]) {
        RTCInitializeSSL()
        let enc = RTCDefaultVideoEncoderFactory()
        let dec = RTCDefaultVideoDecoderFactory()
        factory = RTCPeerConnectionFactory(encoderFactory: enc, decoderFactory: dec)

        let cfg = RTCConfiguration()
        cfg.iceServers = iceServers
        cfg.sdpSemantics = .unifiedPlan
        let cons = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        pc = factory?.peerConnection(with: cfg, constraints: cons, delegate: self)

        let audioSrc = factory?.audioSource(with: cons)
        if let audioSrc, let a = factory?.audioTrack(with: audioSrc, trackId: "align_a") {
            pc?.add(a, streamIds: ["local"])
        }

        if !audioOnly, let lv = localVideoView, let f = factory, let p = pc {
            let vs = f.videoSource()
            let cap = RTCCameraVideoCapturer(delegate: self)
            videoCapturer = cap
            let devices = RTCCameraVideoCapturer.captureDevices()
            guard let dev = devices.first(where: { $0.position == .front }) ?? devices.first else { return }
            let formats = RTCCameraVideoCapturer.supportedFormats(for: dev)
            guard let format = formats.last else { return }
            let track = f.videoTrack(with: vs, trackId: "align_v")
            track.add(lv)
            p.add(track, streamIds: ["local"])
            cap.startCapture(with: dev, format: format, fps: 30)
        }
    }

    private func handleSignaling(_ json: [String: Any]) {
        guard let t = json["t"] as? String else { return }
        switch t {
        case "session":
            if let r = json["remoteUserId"] as? String { remoteUserId = r }
            if json["shouldOffer"] as? Bool == true { createOffer() }
        case "offer":
            guard let sdp = json["sdp"] as? String, let from = json["from"] as? String else { return }
            remoteUserId = from
            applyRemoteSdp(sdp, type: .offer) { [weak self] in self?.createAnswer() }
        case "answer":
            guard let sdp = json["sdp"] as? String else { return }
            applyRemoteSdp(sdp, type: .answer, then: nil)
        case "ice":
            guard let cand = json["candidate"] as? [String: Any],
                  let sdp = cand["candidate"] as? String else { return }
            let mid = cand["sdpMid"] as? String
            let idx = cand["sdpMLineIndex"] as? Int32 ?? 0
            let ice = RTCIceCandidate(sdp: sdp, sdpMLineIndex: idx, sdpMid: mid)
            if remoteSdpApplied {
                pc?.add(ice)
            } else {
                iceLock.lock()
                remoteIceQueue.append(ice)
                iceLock.unlock()
            }
        case "call-end":
            endCall()
        default:
            break
        }
    }

    private func applyRemoteSdp(_ sdp: String, type: RTCSdpType, then: (() -> Void)?) {
        guard let p = pc else { return }
        let desc = RTCSessionDescription(type: type, sdp: sdp)
        p.setRemoteDescription(desc) { [weak self] err in
            guard let self, err == nil else { return }
            self.remoteSdpApplied = true
            self.iceLock.lock()
            let q = self.remoteIceQueue
            self.remoteIceQueue.removeAll()
            self.iceLock.unlock()
            for c in q { p.add(c) }
            then?()
        }
    }

    private func createOffer() {
        guard let p = pc else { return }
        let m = [
            "OfferToReceiveAudio": "true",
            "OfferToReceiveVideo": audioOnly ? "false" : "true",
        ]
        let cons = RTCMediaConstraints(mandatoryConstraints: m, optionalConstraints: nil)
        p.offer(for: cons) { [weak self] sdp, err in
            guard let self, let sdp, err == nil else { return }
            p.setLocalDescription(sdp) { e in
                if e == nil { self.signaling.sendOffer(sdp: sdp.sdp, to: self.remoteUserId) }
            }
        }
    }

    private func createAnswer() {
        guard let p = pc else { return }
        let m = [
            "OfferToReceiveAudio": "true",
            "OfferToReceiveVideo": audioOnly ? "false" : "true",
        ]
        let cons = RTCMediaConstraints(mandatoryConstraints: m, optionalConstraints: nil)
        p.answer(for: cons) { [weak self] sdp, err in
            guard let self, let sdp, err == nil else { return }
            p.setLocalDescription(sdp) { e in
                if e == nil { self.signaling.sendAnswer(sdp: sdp.sdp, to: self.remoteUserId) }
            }
        }
    }

    private func startHeartbeat() {
        heartbeat?.invalidate()
        heartbeat = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            self?.signaling.sendHeartbeat()
        }
    }

    func endCall() {
        heartbeat?.invalidate()
        heartbeat = nil
        signaling.sendCallEnd()
        signaling.disconnect()
        videoCapturer?.stopCapture()
        videoCapturer = nil
        pc?.close()
        pc = nil
        factory = nil
        onEnded?()
    }

    // MARK: RTCPeerConnectionDelegate

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}

    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        if newState == .failed || newState == .closed { endCall() }
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        signaling.sendIce(candidate: candidate, to: remoteUserId)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd rtpReceiver: RTCRtpReceiver, streams: [RTCMediaStream]) {
        if let v = rtpReceiver.track as? RTCVideoTrack, let rv = remoteVideoView {
            v.add(rv)
        }
    }
}

extension WebRtcCallManager: RTCVideoCapturerDelegate {
    func capturer(_ capturer: RTCVideoCapturer, didChange state: RTCCameraCaptureState) {}
}
