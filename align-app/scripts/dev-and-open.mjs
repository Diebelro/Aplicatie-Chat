/**
 * Pornește Next pe portul fix 3005 și deschide browserul când serverul răspunde.
 * URL: setează ALIGN_DEV_OPEN (ex. http://localhost:3005/admin/setup) sau implicit http://localhost:3005/
 */
import { spawn, exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const port = 3005;
const defaultUrl = `http://127.0.0.1:${port}/`;
const openUrl = (process.env.ALIGN_DEV_OPEN || defaultUrl).trim();

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmBin = isWin ? "npm.cmd" : "npm";

function openBrowser(url) {
  const safe = url.replace(/"/g, "");
  if (isWin) {
    exec(`cmd /c start "" "${safe}"`);
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
        console.log(`\n[dev] Browser: ${openUrl}\n`);
        openBrowser(openUrl);
      }
      return;
    } catch {
      /* încă pornește */
    }
  }
}

void tryOpenWhenReady();

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
