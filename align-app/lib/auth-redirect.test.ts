import { describe, expect, it } from "vitest";
import { resolveNextAuthRedirect } from "./auth-redirect";

const base = "https://app.example.com";

describe("resolveNextAuthRedirect", () => {
  it("respinge open redirect către alt origin", () => {
    expect(resolveNextAuthRedirect("https://evil.com/phish", base)).toBe(base);
  });

  it("după login, rutele de signin merg la /descopera", () => {
    expect(resolveNextAuthRedirect("/login", base)).toBe(`${base}/descopera`);
    expect(resolveNextAuthRedirect("/signup", base)).toBe(`${base}/descopera`);
    expect(resolveNextAuthRedirect("/api/auth/signin", base)).toBe(`${base}/descopera`);
  });

  it("cale relativă internă rămâne (ex. /app)", () => {
    expect(resolveNextAuthRedirect("/app", base)).toBe("/app");
  });

  it("URL absolut același origin păstrează destinația dacă nu e login/signup", () => {
    expect(resolveNextAuthRedirect(`${base}/app/chat`, base)).toBe(`${base}/app/chat`);
  });

  it("URL absolut același origin spre /login → descopera", () => {
    expect(resolveNextAuthRedirect(`${base}/login`, base)).toBe(`${base}/descopera`);
  });
});
