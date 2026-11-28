// Second voice-over: a more natural voice and fewer, longer lines, so it reads as one person talking.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
const [out, voice] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const LINES = [
  [0.2, 3.0, "Modern restaurants have a new strategy."],
  [3.0, 8.6, "One QR code on every chair. Every waiter. Even the bread... and the dog."],
  [8.6, 10.2, "Countless QR codes."],
  [10.2, 15.4, "So when a guest scans one... it takes them straight to..."],
  [15.9, 19.6, "Sora. QR table ordering for South African restaurants."],
  [19.7, 22.8, "Guests order at the table, and the kitchen sees it instantly."],
  [22.8, 25.6, "Call a waiter with one tap. No app to download."],
  [25.6, 27.3, "And no commission on orders."],
  [27.4, 31.2, "We're choosing our founding restaurants. Only five spots."],
  [31.4, 35.6, "Join the waitlist at sora Q R dot co dot za."],
];
const tts = new MsEdgeTTS();
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const meta = [];
for (const [i, [start, end, line]] of LINES.entries()) {
  const { audioFilePath } = await tts.toFile(out, line);
  const file = `line-${String(i).padStart(2, "0")}.mp3`;
  renameSync(audioFilePath, `${out}/${file}`);
  meta.push({ file, start, end, line });
}
writeFileSync(`${out}/lines.json`, JSON.stringify(meta, null, 2));
tts.close();
console.log(`${meta.length} lines in ${voice}`);
