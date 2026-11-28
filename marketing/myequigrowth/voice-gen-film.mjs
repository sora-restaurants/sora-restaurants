// Voice-over for film.html from film-script.mjs. Run from a folder where `npm i msedge-tts` was done:
// node voice-gen-film.mjs <script-path> <out-folder> <voice>. A rerun fills only the lines the service dropped.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [script, out, voice] = process.argv.slice(2);
const { LINES, say } = await import(pathToFileURL(script).href);
mkdirSync(out, { recursive: true });
const meta = [];
for (const [id, caption] of LINES) {
  const file = `${id}.mp3`;
  meta.push({ id, file, caption });
  if (existsSync(`${out}/${file}`) && statSync(`${out}/${file}`).size > 0) continue;
  const tts = new MsEdgeTTS(); // a fresh connection per line: the service drops long-lived ones
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(out, say(caption), { rate: "-4%" });
  renameSync(audioFilePath, `${out}/${file}`);
  tts.close();
}
writeFileSync(`${out}/lines.json`, JSON.stringify(meta, null, 2));
console.log(`${meta.length} lines, ${meta.reduce((n, l) => n + l.caption.split(/\s+/).length, 0)} words, ${voice}`);
