import { describe, expect, it } from "vitest";
import { iceConfigFetchErrorMessage } from "./iceClientErrors";

describe("iceConfigFetchErrorMessage", () => {
  it("preserves TURN_REQUIRED from API", () => {
    expect(iceConfigFetchErrorMessage(500, "TURN_REQUIRED: missing realm")).toBe(
      "TURN_REQUIRED: missing realm"
    );
  });

  it("prefixes unknown API errors", () => {
    expect(iceConfigFetchErrorMessage(500, "bad config")).toBe("TURN_REQUIRED: bad config");
  });

  it("uses default when body empty on 500", () => {
    const m = iceConfigFetchErrorMessage(500, undefined);
    expect(m).toContain("TURN_REQUIRED");
  });

  it("keeps 401 auth wording without forcing TURN prefix", () => {
    expect(iceConfigFetchErrorMessage(401, "Neautorizat.")).toBe("Neautorizat.");
  });
});
