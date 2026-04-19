import { describe, expect, it } from "vitest";
import {
  callErrorRawForHints,
  resolveCallDisplayedError,
  stripDevHttpStatusPrefix,
} from "@/lib/i18n/callApiErrorMap";

function mockTStr(path: string): string {
  const map: Record<string, string> = {
    "pages.callRoom.apiErrors.SIGNALING_TOKEN_INVALID": "TR_INVALID",
    "pages.callRoom.apiErrors.UNKNOWN": "TR_UNKNOWN",
    "pages.callRoom.apiErrors.SIGNALING_NOT_CONFIGURED": "TR_SIG",
  };
  return map[path] ?? "";
}

describe("stripDevHttpStatusPrefix", () => {
  it("strips leading [status] prefix", () => {
    expect(stripDevHttpStatusPrefix("[401] Neautorizat.")).toBe("Neautorizat.");
  });
  it("trims whitespace", () => {
    expect(stripDevHttpStatusPrefix("  x  ")).toBe("x");
  });
  it("leaves plain message unchanged", () => {
    expect(stripDevHttpStatusPrefix("Hello")).toBe("Hello");
  });
});

describe("resolveCallDisplayedError", () => {
  it("maps known errorCode to i18n path via tStr", () => {
    expect(
      resolveCallDisplayedError({ errorCode: "SIGNALING_TOKEN_INVALID", error: "x" }, mockTStr)
    ).toBe("TR_INVALID");
  });
  it("returns raw for unknown string", () => {
    expect(resolveCallDisplayedError("Totally new server text", mockTStr)).toBe("Totally new server text");
  });
  it("returns UNKNOWN for empty string", () => {
    expect(resolveCallDisplayedError("", mockTStr)).toBe("TR_UNKNOWN");
  });
  it("returns UNKNOWN for null", () => {
    expect(resolveCallDisplayedError(null, mockTStr)).toBe("TR_UNKNOWN");
  });
  it("resolves known legacy Romanian string", () => {
    const tStr = (p: string) => (p === "pages.callRoom.apiErrors.SIGNALING_NOT_CONFIGURED" ? "SIG_OK" : "");
    expect(resolveCallDisplayedError("Semnalizare neconfigurată.", tStr)).toBe("SIG_OK");
  });
});

describe("callErrorRawForHints", () => {
  it("joins object fields", () => {
    expect(callErrorRawForHints({ errorCode: "X", error: "a", message: "b" })).toBe("a b X");
  });
});
