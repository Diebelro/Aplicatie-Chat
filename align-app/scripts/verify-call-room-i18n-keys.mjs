/**
 * Verifică că ro/en/de au aceleași chei (frunze) sub `pages.callRoom`.
 * Rulează: node scripts/verify-call-room-i18n-keys.mjs
 * În CI e acoperit de `npm run verify-i18n` (tot arborele); acest script e util local/pre-commit.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = ["ro", "en", "de"];
const MESSAGES_DIR = path.join(__dirname, "..", "messages");

function collectLeafKeys(obj, prefix = "") {
  const keys = [];
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) keys.push(prefix);
    return keys;
  }
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectLeafKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function main() {
  const pagesCallRoomByLocale = {};
  const keySets = {};

  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${filePath}`);
      process.exit(1);
    }
    let root;
    try {
      root = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
      console.error(`Invalid JSON in ${filePath}:`, e.message);
      process.exit(1);
    }
    const callRoom = root?.pages?.callRoom;
    if (callRoom == null || typeof callRoom !== "object" || Array.isArray(callRoom)) {
      console.error(`[${locale}.json] Missing object pages.callRoom`);
      process.exit(1);
    }
    pagesCallRoomByLocale[locale] = callRoom;
    keySets[locale] = new Set(collectLeafKeys(callRoom, ""));
  }

  const reference = LOCALES[0];
  const refKeys = keySets[reference];
  let hasError = false;

  for (const locale of LOCALES.slice(1)) {
    const keys = keySets[locale];
    const missingInLocale = [...refKeys].filter((k) => !keys.has(k));
    const extraInLocale = [...keys].filter((k) => !refKeys.has(k));
    if (missingInLocale.length) {
      console.error(
        `[pages.callRoom][${locale}.json] Missing keys (present in ${reference}.json): ${missingInLocale.join(", ")}`
      );
      hasError = true;
    }
    if (extraInLocale.length) {
      console.error(
        `[pages.callRoom][${locale}.json] Extra keys (not in ${reference}.json): ${extraInLocale.join(", ")}`
      );
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  }
  console.log("OK: pages.callRoom has the same leaf keys in ro, en, de.");
}

main();
