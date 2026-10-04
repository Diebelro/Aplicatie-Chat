/**
 * Clip promo CINEMATIC vertical (9:16) pentru Diebel Chat — cu VOCE românească.
 * Logo "Diebel Chat" permanent + buton Google Play permanent + mișcare fluidă + voce.
 * Rezultat: play-store-assets/promo-video/diebel-promo-cinematic-9x16.mp4
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
const VOICE = path.join(ASSETS, "voice.mp3");

const TMP = path.join(os.tmpdir(), "diebelcine");
const FONT = "C\\\\:/Windows/Fonts/arialbd.ttf";
const FONT_REG = "C\\\\:/Windows/Fonts/arial.ttf";

const T = 0.5;
const GREEN = "0x0b3d2e";
const LOOK = "eq=contrast=1.07:saturation=1.12:brightness=-0.015,vignette=PI/5";

// durate per scenă (ultima = CTA), calibrate pe vocea de ~26.4s
const scenes = [
  { img: "cine-01-drive.png", title: "Se lasă seara", sub: "și cineva te așteaptă", d: 4.6, fadein: true },
  { img: "cine-02-hotel.png", title: "Locuri frumoase", sub: "oameni pe măsură", d: 3.8 },
  { img: "cine-03-woman.png", title: "Cunoaște oameni noi", sub: "oriunde ești", d: 4.4 },
  { img: "cine-04-meet.png", title: "Vorbești. Te suni. Te vezi.", sub: "", d: 4.2 },
  { img: "cine-05-beach.png", title: "De la primul mesaj", sub: "la prima întâlnire", d: 4.2 },
  { img: "cine-06-close.png", title: "Simplu. Sigur. Al tău.", sub: "", d: 3.2 },
];
const CTA_D = 6.0;

function tf(name, text) {
  writeFileSync(path.join(TMP, name), text, "utf8");
  return "C\\\\:/Users/conta/AppData/Local/Temp/diebelcine/" + name;
}

function run(args) {
  try {
    execFileSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString() : e.message;
    throw new Error("FFMPEG failed:\n" + msg.split("\n").slice(-25).join("\n"));
  }
}

// Suprapunere permanentă: logo "Diebel Chat" sus-stânga + buton Google Play jos
function brandingSteps(inLabel, outLabel) {
  return [
    // logo sus-stânga
    `[${inLabel}]drawbox=x=24:y=40:w=386:h=120:color=black@0.42:t=fill[b0]`,
    `[b0][logo]overlay=46:56[b1]`,
    `[b1]drawtext=fontfile=${FONT}:text='Diebel Chat':fontcolor=white:fontsize=50:x=152:y=70[b2]`,
    // buton Google Play jos (permanent) — alb cu text verde, în tonul brandului
    `[b2]drawbox=x=280:y=1665:w=520:h=150:color=white@0.96:t=fill[b3]`,
    `[b3]drawbox=x=280:y=1665:w=520:h=150:color=0x14b8a6@0.95:t=4[b4]`,
    `[b4]drawtext=fontfile=${FONT_REG}:text='DISPONIBIL PE':fontcolor=${GREEN}@0.75:fontsize=28:x=(w-text_w)/2:y=1688[b5]`,
    `[b5]drawtext=fontfile=${FONT}:text='Google Play':fontcolor=${GREEN}:fontsize=56:x=(w-text_w)/2:y=1722[${outLabel}]`,
  ];
}

function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_FINAL_DIR, { recursive: true });

  const sceneOut = [];

  scenes.forEach((s, i) => {
    const img = path.join(ASSETS, s.img);
    const out = path.join(TMP, `s${i}.mp4`);
    const titleFile = tf(`t${i}title.txt`, s.title);

    const zexpr =
      i % 2 === 0
        ? "z='min(1.0+0.0011*on\\,1.12)'"
        : "z='max(1.12-0.0011*on\\,1.0)'";

    const steps = [];
    steps.push(
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,scale=2160:3840,` +
        `zoompan=${zexpr}:d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,setsar=1,${LOOK}[bg]`
    );
    steps.push(`[1:v]scale=88:88[logo]`);
    // caption band + text
    steps.push(`[bg]drawbox=x=0:y=1330:w=1080:h=250:color=black@0.5:t=fill[cap0]`);
    steps.push(
      `[cap0]drawtext=fontfile=${FONT}:textfile=${titleFile}:fontcolor=white:fontsize=64:x=(w-text_w)/2:y=1372:shadowcolor=black@0.9:shadowx=3:shadowy=3[cap1]`
    );
    let last = "cap1";
    if (s.sub) {
      const subFile = tf(`t${i}sub.txt`, s.sub);
      steps.push(
        `[cap1]drawtext=fontfile=${FONT_REG}:textfile=${subFile}:fontcolor=white@0.92:fontsize=42:x=(w-text_w)/2:y=1470:shadowcolor=black@0.9:shadowx=2:shadowy=2[cap2]`
      );
      last = "cap2";
    }
    // branding permanent
    const brandOut = "brd";
    steps.push(...brandingSteps(last, brandOut));
    last = brandOut;

    if (s.fadein) {
      steps.push(`[${last}]fade=t=in:st=0:d=0.7[vout]`);
    } else {
      steps.push(`[${last}]null[vout]`);
    }

    run([
      "-y",
      "-framerate", "30", "-loop", "1", "-t", String(s.d), "-i", img,
      "-framerate", "30", "-loop", "1", "-t", String(s.d), "-i", ICON,
      "-filter_complex", steps.join(";"),
      "-map", "[vout]",
      "-r", "30", "-pix_fmt", "yuv420p",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      out,
    ]);
    sceneOut.push(out);
    console.log("scene", i, "OK");
  });

  // CTA
  const ctaOut = path.join(TMP, "cta.mp4");
  const ctaTitle = tf("ctatitle.txt", "Diebel Chat");
  const ctaTag = tf("ctatag.txt", "Chat • Apeluri video • Oameni noi");
  const ctaBtn = tf("ctabtn.txt", "Caută «Diebel Chat»");
  const ctaBtn2 = tf("ctabtn2.txt", "pe Google Play — GRATIS");

  const ctaFilter = [
    "[1:v]scale=320:320[ic]",
    `[0:v][ic]overlay=(W-w)/2:440[bgc]`,
    `[bgc]drawtext=fontfile=${FONT}:textfile=${ctaTitle}:fontcolor=white:fontsize=112:x=(w-text_w)/2:y=810[a]`,
    `[a]drawtext=fontfile=${FONT_REG}:textfile=${ctaTag}:fontcolor=white@0.9:fontsize=42:x=(w-text_w)/2:y=990[b]`,
    `[b]drawbox=x=150:y=1220:w=780:h=190:color=white@1:t=fill[c]`,
    `[c]drawtext=fontfile=${FONT}:textfile=${ctaBtn}:fontcolor=${GREEN}:fontsize=56:x=(w-text_w)/2:y=1248[d]`,
    `[d]drawtext=fontfile=${FONT_REG}:textfile=${ctaBtn2}:fontcolor=${GREEN}:fontsize=40:x=(w-text_w)/2:y=1330[e]`,
    `[e]drawtext=fontfile=${FONT_REG}:text='chat.diebel.ro':fontcolor=white@0.85:fontsize=40:x=(w-text_w)/2:y=1520[f]`,
    `[f]fade=t=in:st=0:d=0.5,fade=t=out:st=${(CTA_D - 0.7).toFixed(2)}:d=0.7[vout]`,
  ].join(";");

  run([
    "-y",
    "-f", "lavfi", "-i", `color=c=${GREEN}:s=1080x1920:d=${CTA_D}:r=30`,
    "-framerate", "30", "-loop", "1", "-t", String(CTA_D), "-i", ICON,
    "-filter_complex", ctaFilter,
    "-map", "[vout]",
    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    ctaOut,
  ]);
  sceneOut.push(ctaOut);
  console.log("cta OK");

  // Merge crossfade
  const durs = scenes.map((s) => s.d).concat([CTA_D]);
  const inputs = [];
  sceneOut.forEach((f) => inputs.push("-i", f));
  let filter = "";
  let prev = "0:v";
  let off = durs[0] - T;
  for (let i = 1; i < sceneOut.length; i++) {
    const outLabel = i === sceneOut.length - 1 ? "vmix" : `v${i}`;
    filter += `[${prev}][${i}:v]xfade=transition=fade:duration=${T}:offset=${off.toFixed(3)}[${outLabel}];`;
    prev = outLabel;
    off += durs[i] - T;
  }
  filter = filter.replace(/;$/, "");

  const finalTmp = path.join(TMP, "final.mp4");
  run([
    "-y",
    ...inputs,
    "-i", VOICE,
    "-filter_complex", filter,
    "-map", "[vmix]",
    "-map", `${sceneOut.length}:a`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    finalTmp,
  ]);

  const finalDest = path.join(OUT_FINAL_DIR, "diebel-promo-cinematic-9x16.mp4");
  copyFileSync(finalTmp, finalDest);
  console.log("DONE:", finalDest);
}

main();
