// Voice-over for SoraQR_reel_silent.mp4: one explanatory line per bold caption, English-only voice so it never switches language, each placed at its caption's start time.
// Run from a folder where `npm i msedge-tts` was done: node voice-gen.mjs <out-folder> <voice>
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
const [out, voice] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
// [start s, end s (next caption), spoken text, optional speaking rate for lines that must fit a short caption]; caption times read off the video
const LINES = [
  [0.15, 1.9, "Still waiting just to order?", "+8%"],
  [2.05, 3.45, "There's a better way.", "+4%"],
  [3.6, 7.5, "With Sora Q R, your guests simply scan the code on their table.", "+8%"],
  [7.75, 11.6, "They order straight from their phone. No app, and no waiting for a waiter.", "+12%"],
  [11.9, 15.8, "The order appears on your kitchen screen instantly, and staff tap it to ready.", "+12%"],
  [16.1, 19.9, "Guests track their order live, and can call a waiter with one tap.", "+10%"],
  [20.1, 24.2, "Book your demo today at sora Q R dot co dot Z A.", "+6%"],
];
const meta = [];
for (const [i, [start, end, line, rate = "+6%"]] of LINES.entries()) {
  const file = `line-${i}.mp3`;
  meta.push({ file, start, end, line });
  if (existsSync(`${out}/${file}`) && statSync(`${out}/${file}`).size > 0) continue; // a rerun fills only dropped lines
  const tts = new MsEdgeTTS(); // a fresh connection per line: the service drops long-lived ones
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(out, line, { rate });
  renameSync(audioFilePath, `${out}/${file}`);
  tts.close();
}
writeFileSync(`${out}/lines.json`, JSON.stringify(meta, null, 2));
console.log(`${meta.length} lines in ${voice}`);
