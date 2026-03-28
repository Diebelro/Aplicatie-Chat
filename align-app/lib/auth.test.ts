import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, normalizeAuthEmail, verifyPassword } from "./auth";

describe("normalizeAuthEmail", () => {
  it("trim, lowercase", () => {
    expect(normalizeAuthEmail("  User@MAIL.COM  ")).toBe("user@mail.com");
  });

  it("NFKC pentru compatibilitate Unicode", () => {
    const fullWidth = "\uff41"; // ａ
    expect(normalizeAuthEmail(`${fullWidth}@x.com`)).toBe("a@x.com");
  });
});

describe("verifyPassword", () => {
  it("bcrypt: hash și verificare reușită", () => {
    const h = hashPassword("Parola-Sigura-9");
    expect(verifyPassword("Parola-Sigura-9", h)).toBe(true);
    expect(verifyPassword("altceva", h)).toBe(false);
  });

  it("legacy scrypt: salt:hash", () => {
    const salt = "testsalt";
    const hash = crypto.scryptSync("legacy-secret", salt, 64).toString("hex");
    const stored = `${salt}:${hash}`;
    expect(verifyPassword("legacy-secret", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("format invalid", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
