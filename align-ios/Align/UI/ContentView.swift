import SwiftUI

struct ContentView: View {
    @State private var userId = SessionStore.userId ?? ""
    @State private var session = SessionStore.sessionToken ?? ""
    @State private var status = ""

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
