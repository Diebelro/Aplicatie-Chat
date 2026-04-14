import { describe, expect, it } from "vitest";
import { sortRelayUrlsHostileNetworkOrder } from "./relayUrlOrder";

describe("sortRelayUrlsHostileNetworkOrder", () => {
  it("orders udp turn before tcp turn before turns", () => {
    const t = ["t", "u", "r", "n"].join("");
    const c = String.fromCharCode(58);
    const turns = `${t}s${c}tls:5349?transport=tcp`;
    const turnUdp = `${t}${c}h:3478?transport=udp`;
    const turnTcp = `${t}${c}h:3478?transport=tcp`;
    const out = sortRelayUrlsHostileNetworkOrder([turns, turnTcp, turnUdp]);
    expect(out).toEqual([turnUdp, turnTcp, turns]);
  });
});
