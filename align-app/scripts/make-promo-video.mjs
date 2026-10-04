/**
 * Construiește un clip promo vertical (9:16) pentru Diebel din imaginile generate.
 * Scene cu zoom lent + text RO + tranziții crossfade + card final cu logo.
 * Rezultat: play-store-assets/promo-video/diebel-promo-ro-9x16.mp4
 */
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "fs";
import os from "os";
import path from "path";

const FFMPEG =
  "C:\\Users\\conta\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";

const ASSETS = "C:\\Users\\conta\\.cursor\\projects\\c-Projects-Aplicatie-Chat\\assets";
const OUT_FINAL_DIR = "C:\\Projects\\Aplicatie Chat\\play-store-assets\\promo-video";
const ICON = "C:\\Projects\\Aplicatie Chat\\play-store-assets\\app_icon_512.png";

const TMP = path.join(os.tmpdir(), "diebelpromo");
const FONT = "C\\\\:/Windows/Fonts/arialbd.ttf";
const FONT_REG = "C\\\\:/Windows/Fonts/arial.ttf";

const D = 2.6; // durata pe scenă
const T = 0.5; // durata crossfade
const CTA_D = 3.6;
const GREEN = "0x0b3d2e";

const scenes = [
  { img: "promo-00-hero.png", title: "Cunoaște oameni noi", sub: "oriunde ești" },
  { img: "promo-01-beach.png", title: "La mare", sub: "o vară plină de conexiuni" },
  { img: "promo-02-picnic.png", title: "În parc", sub: "momente frumoase împreună" },
  { img: "promo-03-home.png", title: "Acasă", sub: "apeluri video oricând" },
  { img: "promo-04-hotel.png", title: "În vacanță", sub: "cunoaște lume nouă" },
  { img: "promo-05-car.png", title: "În drum spre o întâlnire", sub: "" },
  { img: "promo-06-date.png", title: "La prima întâlnire", sub: "totul începe cu un mesaj" },
];

function tf(name, text) {
  const p = path.join(TMP, name);
  writeFileSync(p, text, "utf8");
  return "C\\\\:/Users/conta/AppData/Local/Temp/diebelpromo/" + name;
}

function run(args) {
  try {
    execFileSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString() : e.message;
    throw new Error("FFMPEG failed:\n" + msg.split("\n").slice(-25).join("\n"));
  }
}

function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_FINAL_DIR, { recursive: true });

  const sceneOut = [];

  scenes.forEach((s, i) => {
    const img = path.join(ASSETS, s.img);
    const out = path.join(TMP, `scene${i}.mp4`);
    const titleFile = tf(`t${i}title.txt`, s.title);

    const parts = [
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      "setsar=1",
      "fps=30",
      "zoompan=z='min(1.0+0.0011*on\\,1.14)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920",
      "drawbox=x=0:y=1360:w=1080:h=560:color=black@0.0:t=fill",
      // gradient fals: două benzi translucide pentru lizibilitate
      "drawbox=x=0:y=1500:w=1080:h=420:color=black@0.55:t=fill",
    ];
    parts.push(
      `drawtext=fontfile=${FONT}:textfile=${titleFile}:fontcolor=white:fontsize=70:x=(w-text_w)/2:y=1600:shadowcolor=black@0.85:shadowx=3:shadowy=3`
    );
    if (s.sub) {
      const subFile = tf(`t${i}sub.txt`, s.sub);
      parts.push(
        `drawtext=fontfile=${FONT_REG}:textfile=${subFile}:fontcolor=white@0.92:fontsize=44:x=(w-text_w)/2:y=1710:shadowcolor=black@0.85:shadowx=2:shadowy=2`
      );
    }
    const vf = parts.join(",");

    run([
      "-y", "-loop", "1", "-t", String(D), "-i", img,
      "-vf", vf,
      "-r", "30", "-pix_fmt", "yuv420p",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      out,
    ]);
    sceneOut.push(out);
    console.log("scene", i, "OK");
  });

  // Card final CTA
  const ctaOut = path.join(TMP, "cta.mp4");
  const ctaTitle = tf("ctatitle.txt", "Diebel");
  const ctaTag = tf("ctatag.txt", "Chat • Apeluri video • Oameni noi");
  const ctaBtn = tf("ctabtn.txt", "Descarcă GRATIS");
  const ctaBtn2 = tf("ctabtn2.txt", "pe Google Play");

  const ctaFilter = [
    "[1:v]scale=300:300[ic]",
    `[0:v][ic]overlay=(W-w)/2:470[bg]`,
    `[bg]drawtext=fontfile=${FONT}:textfile=${ctaTitle}:fontcolor=white:fontsize=130:x=(w-text_w)/2:y=830[a]`,
    `[a]drawtext=fontfile=${FONT_REG}:textfile=${ctaTag}:fontcolor=white@0.9:fontsize=42:x=(w-text_w)/2:y=1010[b]`,
    `[b]drawbox=x=190:y=1230:w=700:h=180:color=white@1:t=fill[c]`,
    `[c]drawtext=fontfile=${FONT}:textfile=${ctaBtn}:fontcolor=${GREEN}:fontsize=62:x=(w-text_w)/2:y=1260[d]`,
    `[d]drawtext=fontfile=${FONT_REG}:textfile=${ctaBtn2}:fontcolor=${GREEN}:fontsize=44:x=(w-text_w)/2:y=1335[e]`,
    `[e]drawtext=fontfile=${FONT_REG}:text='chat.diebel.ro':fontcolor=white@0.85:fontsize=40:x=(w-text_w)/2:y=1520`,
  ].join(";");

  run([
    "-y",
    "-f", "lavfi", "-i", `color=c=${GREEN}:s=1080x1920:d=${CTA_D}:r=30`,
    "-loop", "1", "-t", String(CTA_D), "-i", ICON,
    "-filter_complex", ctaFilter,
    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    ctaOut,
  ]);
  sceneOut.push(ctaOut);
  console.log("cta OK");

  // Merge cu crossfade
  const durs = scenes.map(() => D).concat([CTA_D]);
  const inputs = [];
  sceneOut.forEach((f) => {
    inputs.push("-i", f);
  });
  let filter = "";
  let prev = "0:v";
  let off = durs[0] - T;
  for (let i = 1; i < sceneOut.length; i++) {
    const outLabel = i === sceneOut.length - 1 ? "vout" : `v${i}`;
    filter += `[${prev}][${i}:v]xfade=transition=fade:duration=${T}:offset=${off.toFixed(3)}[${outLabel}];`;
    prev = outLabel;
    off += durs[i] - T;
  }
  filter = filter.replace(/;$/, "");

  const finalTmp = path.join(TMP, "final.mp4");
  run([
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", "[vout]",
    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-movflags", "+faststart",
    finalTmp,
  ]);

  const finalDest = path.join(OUT_FINAL_DIR, "diebel-promo-ro-9x16.mp4");
  copyFileSync(finalTmp, finalDest);
  console.log("DONE:", finalDest);
}

main();
