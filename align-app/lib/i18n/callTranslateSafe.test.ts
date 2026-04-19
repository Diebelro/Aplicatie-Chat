import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import { wrapCallTranslate } from "@/lib/i18n/callTranslateSafe";

describe("wrapCallTranslate", () => {
  it("uses EN when current locale string missing", () => {
    const enVal = (enMessages as { pages?: { callRoom?: { ui?: { noVideo?: string } } } }).pages?.callRoom?.ui
      ?.noVideo;
    expect(enVal).toBeTruthy();
    const { tStr } = wrapCallTranslate(
      () => "",
      () => []
    );
    const v = tStr("pages.callRoom.ui.noVideo");
    expect(v).toBe(enVal);
  });

  it("returns Unknown error when missing in both", () => {
    const { tStr } = wrapCallTranslate(
      () => "",
      () => []
    );
    expect(tStr("pages.callRoom.ui.__nonexistent_key_xyz__")).toBe("Unknown error");
  });

  it("tArray falls back to EN then empty", () => {
    const enLines = (enMessages as { pages?: { callRoom?: { mediaHelp?: { insecureContext?: { lines?: string[] } } } } })
      .pages?.callRoom?.mediaHelp?.insecureContext?.lines;
    expect(Array.isArray(enLines) && enLines.length > 0).toBe(true);
    const { tArray } = wrapCallTranslate(
      () => "",
      () => []
    );
    const a = tArray("pages.callRoom.mediaHelp.insecureContext.lines");
    expect(a.length).toBeGreaterThan(0);
    expect(wrapCallTranslate(() => "", () => []).tArray("pages.callRoom.__no_such__.x")).toEqual([]);
  });
});
