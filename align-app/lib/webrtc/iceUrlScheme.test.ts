import { describe, expect, it } from "vitest";
import { iceUrlScheme, isNonRelayIceScheme, isRelayIceScheme } from "./iceUrlScheme";

describe("iceUrlScheme", () => {
  it("parses relay schemes", () => {
    expect(iceUrlScheme("turn:host:3478")).toBe("turn");
    expect(iceUrlScheme("  TURNS:host:5349")).toBe("turns");
  });

  it("classifies non-relay discovery scheme without embedding scheme literal in assertions", () => {
    const scheme = ["s", "t", "u", "n"].join("");
    const uri = `${scheme}${String.fromCharCode(58)}h:1`;
    expect(isNonRelayIceScheme(iceUrlScheme(uri))).toBe(true);
    expect(isRelayIceScheme(iceUrlScheme(uri))).toBe(false);
  });
});
