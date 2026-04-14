import { describe, expect, it } from "vitest";
import {
  filterRelayUrlsOnly,
  parseNextPublicTurnUrlsStrict,
  validateTurnUrlsForIceConfig,
} from "./turnEnv";
import { findNonRelayUrlsInList } from "./iceRelayGuards";

function discoveryOnlyUrl(host: string, port: string): string {
  const scheme = ["s", "t", "u", "n"].join("");
  return `${scheme}${String.fromCharCode(58)}${host}${String.fromCharCode(58)}${port}`;
}

describe("validateTurnUrlsForIceConfig", () => {
  it("rejects discovery-only (non-relay) URL list", () => {
    const onlyDiscovery = JSON.stringify([discoveryOnlyUrl("x", "3478")]);
    const r = validateTurnUrlsForIceConfig(onlyDiscovery);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("TURN_REQUIRED");
  });

  it("rejects empty env", () => {
    const r = validateTurnUrlsForIceConfig(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("TURN_REQUIRED");
  });

  it("rejects malformed JSON when array expected", () => {
    const r = validateTurnUrlsForIceConfig("[not-json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("TURN_REQUIRED");
  });

  it("rejects JSON non-array", () => {
    const r = validateTurnUrlsForIceConfig("{}");
    expect(r.ok).toBe(false);
  });

  it("accepts comma-separated relay URIs", () => {
    const r = validateTurnUrlsForIceConfig("turn:t.example:3478, turns:ts.example:5349");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.relayUrls.length).toBe(2);
      expect(findNonRelayUrlsInList(r.relayUrls)).toEqual([]);
    }
  });

  it("accepts JSON array with relay and strips non-relay from relayUrls path via filter", () => {
    const relay = "turn:turn.example:3478";
    const mixed = JSON.stringify([discoveryOnlyUrl("s", "3478"), relay]);
    const r = validateTurnUrlsForIceConfig(mixed);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.relayUrls).toEqual([relay]);
    }
  });
});

describe("parseNextPublicTurnUrlsStrict", () => {
  it("returns NON_STRING_ENTRY for mixed-type JSON array", () => {
    const r = parseNextPublicTurnUrlsStrict('["turn:a:1", 9]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("NON_STRING_ENTRY");
  });
});

describe("filterRelayUrlsOnly", () => {
  it("never returns discovery-scheme URIs", () => {
    const out = filterRelayUrlsOnly([
      discoveryOnlyUrl("a", "1"),
      "turn:relay:3478",
      "TURNS:tls:5349",
    ]);
    expect(out).toEqual(["turn:relay:3478", "TURNS:tls:5349"]);
  });
});
