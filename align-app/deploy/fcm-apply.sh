#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Diebel Chat — configurare FCM (apeluri native Android) pe Hetzner, de pe PC.
#   Intrare: JSON-ul de service account Firebase (proiect chat-diebel), salvat LOCAL, în afara git-ului.
#   Face: backup .env.production → scrie FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY (fără a le afișa)
#         → recreează containerul app cu noul env → health (dbOk) → validare FCM (dry-run pe un token real).
#   Utilizare: bash deploy/fcm-apply.sh "C:/Projects/Aplicatie Chat/_secrets/chat-diebel-firebase.json"
# ----------------------------------------------------------------------------
set -euo pipefail
JSON="${1:?calea către JSON-ul service account}"
HOST="${DEPLOY_HOST:-root@178.104.2.31}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/Aplicatie-Chat/align-app}"
[ -s "$JSON" ] || { echo "fișierul nu există sau e gol: $JSON"; exit 1; }

# 1) extrage valorile (fără a le afișa); cheia PEM → o singură linie cu \n literal (normalizeMultilineEnv o reface)
PAYLOAD="$(node -e '
const j = require(process.argv[1]);
if (!j.project_id || !j.client_email || !j.private_key) { console.error("JSON incomplet (project_id/client_email/private_key)"); process.exit(1); }
process.stdout.write(JSON.stringify({ pid: j.project_id, email: j.client_email, key: j.private_key.replace(/\r?\n/g, "\\n") }));
' "$JSON")"
echo "JSON valid: proiect $(node -e 'console.log(JSON.parse(process.argv[1]).pid)' "$PAYLOAD"), cont de serviciu prezent, cheie privată prezentă (nu se afișează)"

# 2) payload-ul ajunge pe server într-un fișier temporar doar-root, citit și șters imediat de python
TS="$(date +%Y%m%d-%H%M%S)"
printf '%s' "$PAYLOAD" | ssh "$HOST" "umask 077; cat > /root/.fcm-payload.json"
cat > /tmp/fcm-apply-remote.py <<'PY'
import json, re, io, os
path = '.env.production'
p = json.load(io.open('/root/.fcm-payload.json', encoding='utf-8'))
os.remove('/root/.fcm-payload.json')
lines = io.open(path, encoding='utf-8').read().split('\n')
vals = {'FIREBASE_PROJECT_ID': p['pid'], 'FIREBASE_CLIENT_EMAIL': p['email'], 'FIREBASE_PRIVATE_KEY': '"' + p['key'] + '"'}
seen = set(); out = []
for ln in lines:
    m = re.match(r'^(FIREBASE_PROJECT_ID|FIREBASE_CLIENT_EMAIL|FIREBASE_PRIVATE_KEY)=', ln)
    if m:
        k = m.group(1)
        if k in seen:
            continue
        seen.add(k); out.append(k + '=' + vals[k])
    else:
        out.append(ln)
for k in vals:
    if k not in seen:
        out.append(k + '=' + vals[k])
io.open(path, 'w', encoding='utf-8').write('\n'.join(out))
print('scris: ' + ', '.join(sorted(vals)))
PY
scp -q /tmp/fcm-apply-remote.py "$HOST:/root/.fcm-apply-remote.py"; rm -f /tmp/fcm-apply-remote.py
ssh "$HOST" "set -e; cd '$REMOTE_DIR'; B=/root/backups/chat-fcm-$TS; mkdir -p \"\$B\"; cp .env.production \"\$B/env.production.bak\"; chmod 600 \"\$B/env.production.bak\"; python3 /root/.fcm-apply-remote.py; rm -f /root/.fcm-apply-remote.py /root/.fcm-payload.json; chmod 600 .env.production; echo \"backup: \$B\"; echo \"linii FIREBASE în env: \$(grep -c '^FIREBASE_' .env.production)\""

# 3) recreează doar containerul app (imaginea nu se schimbă) și așteaptă health + dbOk; altfel revine la backup
ssh "$HOST" "cd '$REMOTE_DIR' && docker compose up -d app >/dev/null 2>&1; for i in \$(seq 1 30); do c=\$(curl -s -o /tmp/hz.json -w '%{http_code}' -m 5 http://127.0.0.1:3002/api/healthz || true); if [ \"\$c\" = 200 ] && grep -q '\"dbOk\":true' /tmp/hz.json; then echo \"health 200, dbOk true\"; exit 0; fi; sleep 2; done; echo 'health NU a revenit — revin la backup'; cp /root/backups/chat-fcm-$TS/env.production.bak .env.production; docker compose up -d app >/dev/null 2>&1; exit 1"

# 4) validare FCM în container: credențialele + un token Android real, DRY-RUN (nu ajunge nimic pe telefon)
cat > /tmp/fcm-dryrun.cjs <<'JS'
const admin = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const key = String(process.env.FIREBASE_PRIVATE_KEY || "").trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
const app = admin.initializeApp({ credential: admin.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: key }) });
getMessaging(app).send({ token: process.env.FCM_TEST_TOKEN, data: { type: "fcm_config_check" }, android: { priority: "high" } }, true)
  .then((id) => { console.log("FCM DRY-RUN OK:", id.replace(/projects\/[^/]+/, "projects/***")); process.exit(0); })
  .catch((e) => { console.log("FCM DRY-RUN EȘUAT:", e.code || "", String(e.message || e).slice(0, 160)); process.exit(3); });
JS
scp -q /tmp/fcm-dryrun.cjs "$HOST:/root/.fcm-dryrun.cjs"; rm -f /tmp/fcm-dryrun.cjs
ssh "$HOST" "cd '$REMOTE_DIR'; TOKEN=\$(docker exec align-app-postgres-1 psql -U diebel -d diebel_chat -tAc \"select \\\"fcmToken\\\" from \\\"UserPushDevice\\\" where \\\"fcmToken\\\" is not null order by \\\"updatedAt\\\" desc limit 1\" | tr -d '[:space:]'); [ -n \"\$TOKEN\" ] || { echo 'niciun token FCM în DB'; exit 2; }; docker cp /root/.fcm-dryrun.cjs align-app-app-1:/tmp/fcm-dryrun.cjs; rm -f /root/.fcm-dryrun.cjs; docker exec -e NODE_PATH=/app/node_modules -e FCM_TEST_TOKEN=\"\$TOKEN\" align-app-app-1 node /tmp/fcm-dryrun.cjs; r=\$?; docker exec -u root align-app-app-1 rm -f /tmp/fcm-dryrun.cjs; exit \$r"
echo "FCM configurat; pentru confirmarea finală: apel real către un telefon cu aplicația închisă."
