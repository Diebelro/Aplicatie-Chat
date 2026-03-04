/**
 * Verifies that all locale JSON files (messages/ro.json, en.json, de.json)
 * have the same key structure. Exits with code 1 if any key is missing.
 * Run: node scripts/verify-i18n-keys.cjs
 */

const path = require("path");
const fs = require("fs");

const LOCALES = ["ro", "en", "de"];
const MESSAGES_DIR = path.join(__dirname, "..", "messages");

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function main() {
  const byLocale = {};
  const keySets = {};

  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${filePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, "utf8");
    try {
      byLocale[locale] = JSON.parse(content);
    } catch (e) {
      console.error(`Invalid JSON in ${filePath}:`, e.message);
      process.exit(1);
    }
    keySets[locale] = new Set(collectKeys(byLocale[locale]));
  }

  const reference = LOCALES[0];
  const refKeys = keySets[reference];
  let hasError = false;

  for (const locale of LOCALES.slice(1)) {
    const keys = keySets[locale];
    const missingInLocale = [...refKeys].filter((k) => !keys.has(k));
    const extraInLocale = [...keys].filter((k) => !refKeys.has(k));
    if (missingInLocale.length) {
      console.error(`[${locale}.json] Missing keys (present in ${reference}.json): ${missingInLocale.join(", ")}`);
      hasError = true;
    }
    if (extraInLocale.length) {
      console.error(`[${locale}.json] Extra keys (not in ${reference}.json): ${extraInLocale.join(", ")}`);
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  }
  console.log("OK: All locale JSON files have the same key structure.");
}

main();
