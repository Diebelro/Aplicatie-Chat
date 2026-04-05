/**
 * Pornește Next pe portul fix 3005 și deschide browserul când serverul răspunde.
 * URL: setează ALIGN_DEV_OPEN (ex. http://localhost:3005/admin/setup) sau implicit http://localhost:3005/
 */
import { spawn, spawnSync, exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const port = 3005;
/** Aliniat cu NEXTAUTH_URL din .env.example — altfel cookies OAuth pe localhost vs 127.0.0.1 se desincronizează. */
const defaultUrl = `http://localhost:${port}/`;
const openUrl = (process.env.ALIGN_DEV_OPEN || defaultUrl).trim();

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmBin = isWin ? "npm.cmd" : "npm";

const guard = spawnSync(process.execPath, [path.join(root, "scripts", "env-guard.mjs"), "runtime"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: false,
});
if (guard.error) {
  console.error(guard.error);
  process.exit(1);
}
if (guard.status !== 0) {
  process.exit(guard.status ?? 1);
}

function openBrowser(url) {
  const safe = url.replace(/"/g, "");
  if (isWin) {
    // `cmd start` eșuează uneori din terminale integrate / fără STA; rundll32 deschide browserul implicit stabil.
    const rundll = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, "System32", "rundll32.exe")
      : "rundll32";
    const ps = spawn(
      rundll,
      ["url.dll,FileProtocolHandler", safe],
      { detached: true, stdio: "ignore", windowsHide: true }
    );
    ps.unref();
    ps.on("error", () => {
      exec(`cmd /c start "" "${safe}"`);
    });
  } else if (process.platform === "darwin") {
    exec(`open "${safe}"`);
  } else {
    exec(`xdg-open "${safe}"`);
  }
}

const child = spawn(npmBin, ["run", "dev:server"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
  shell: isWin,
});

let opened = false;

async function tryOpenWhenReady() {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 3000);
      const res = await fetch(openUrl, { signal: ac.signal });
      clearTimeout(t);
      if (!opened && res != null) {
        opened = true;
        console.log(`\n[dev] Deschid browser: ${openUrl}\n`);
        openBrowser(openUrl);
      }
      return;
    } catch {
      /* încă pornește */
    }
  }
  console.error(
    "\n[dev] Serverul nu a răspuns în 60s — verifică erorile de mai sus sau portul",
    port,
    ".\n"
  );
}

void tryOpenWhenReady();

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
