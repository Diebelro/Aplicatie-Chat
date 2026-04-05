import SwiftUI

struct ContentView: View {
    @State private var userId = SessionStore.userId ?? ""
    @State private var session = SessionStore.sessionToken ?? ""
    @State private var status = ""
    @State private var calleeId = ""
    @State private var outgoingAudioOnly = false

    var body: some View {
        NavigationView {
            Form {
                Section("Sesiune (dev)") {
                    TextField("userId", text: $userId)
                    TextField("Session token", text: $session)
                    Button("Salvează") {
                        SessionStore.userId = userId.trimmingCharacters(in: .whitespacesAndNewlines)
                        SessionStore.sessionToken = session.trimmingCharacters(in: .whitespacesAndNewlines)
                        status = "Salvat. Apoi pornește aplicația din nou sau așteaptă token VoIP."
                    }
                }
                Section("Apel ieșitor (1-la-1)") {
                    Text("Introdu ID-ul utilizatorului sunat (același ca în web). Se trimite `/api/call/ring` apoi WebSocket — browser/Android primesc „te sună”.")
                        .font(.footnote)
                    TextField("ID utilizator sunat", text: $calleeId)
                    Toggle("Doar audio", isOn: $outgoingAudioOnly)
                    Button("Sună acum") {
                        let me = SessionStore.userId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                        let other = calleeId.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !me.isEmpty, !other.isEmpty, me != other else {
                            status = "Completează sesiunea și ID-ul celuilalt."
                            return
                        }
                        let room = AlignPairRoom.roomId(userId1: me, userId2: other)
                        let meta = PendingCallMetadata(
                            roomId: room,
                            remoteUserId: other,
                            audioOnly: outgoingAudioOnly,
                            isCaller: true
                        )
                        NotificationCenter.default.post(name: .alignStartNativeCall, object: meta)
                        status = "Apel pornit — așteaptă celălalt să răspundă."
                    }
                }
                Section("Apeluri") {
                    Text("PushKit + CallKit sunt active. Înregistrează token VoIP trimițând sesiunea (se face automat la token actualizat).")
                        .font(.footnote)
                    Text(status)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Align")
        }
    }
}

#Preview {
    ContentView()
}
