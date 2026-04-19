import { describe, expect, it } from "vitest";
import { OUTGOING_POLL_STATUSES, parseOutgoingPollStatus } from "./callOutgoingStatus";

describe("parseOutgoingPollStatus", () => {
  it("acceptă valorile contractului", () => {
    for (const s of OUTGOING_POLL_STATUSES) {
      expect(parseOutgoingPollStatus(s)).toBe(s);
    }
  });

  it("respinge necunoscute și tipuri greșite", () => {
    expect(parseOutgoingPollStatus("pending")).toBeNull();
    expect(parseOutgoingPollStatus("")).toBeNull();
    expect(parseOutgoingPollStatus(null)).toBeNull();
    expect(parseOutgoingPollStatus(1)).toBeNull();
  });
});
