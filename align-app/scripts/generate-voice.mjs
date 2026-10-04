import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createWriteStream } from "fs";
import path from "path";

const OUT_DIR = "C:\\Users\\conta\\.cursor\\projects\\c-Projects-Aplicatie-Chat\\assets";
const OUT = path.join(OUT_DIR, process.env.OUT_NAME?.trim() || "voice-raw.mp3");
const VOICE_NAME = process.env.VOICE_NAME?.trim() || "ro-RO-EmilNeural";

const text =
  "Se lasă seara... și cineva te așteaptă. " +
  "Locuri frumoase, oameni pe măsură. " +
  "Cu Diebel Chat cunoști oameni noi, oriunde ești. " +
  "Vorbești, te suni, te vezi. Simplu și sigur. " +
  "De la primul mesaj, până la prima întâlnire. " +
  "Diebel Chat. Caută-l gratis, pe Google Play.";

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const { audioStream } = tts.toStream(text, { rate: "-4%" });

const w = createWriteStream(OUT);
audioStream.on("data", (d) => w.write(d));
audioStream.on("end", () => {
  w.end();
  console.log("VOICE RAW OK:", OUT);
});
audioStream.on("error", (e) => {
  console.error("ERR", e);
  process.exit(1);
});
