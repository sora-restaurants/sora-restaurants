// Voice-over for the MyEquiGrowth reel: Edge neural voice, the brief's wording, a few flowing lines.
// Run from a folder where `npm i msedge-tts` was done: node voice-gen.mjs <out-folder> <voice>
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
const [out, voice] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
// [earliest start s, line]; spoken text spells the brand so it is said as "My Equi Growth"
const LINES = [
  [0.3, "When you think about funeral cover... who would you want on your plan?"],
  [4.0, "At My Ekwee Growth, you can choose cover for yourself, or look at options for your family."],
  [9.2, "Family options can include a spouse, and up to six children. Selected plans also let you add parents, and extended family members."],
  [18.4, "Depending on your package, you can also access grocery and pharmacy coupons... plus a 24-hour helpline that can arrange assistance for home emergencies."],
  [28.0, "If you refer someone who joins, you may qualify for a referral reward. What you can earn depends on your membership level, and the programme rules."],
  [37.0, "Visit My Ekwee Growth online, to compare the plans, and see who you can cover."],
];
const meta = [];
for (const [i, [start, line]] of LINES.entries()) {
  const file = `line-${String(i).padStart(2, "0")}.mp3`;
  meta.push({ file, start, line });
  if (existsSync(`${out}/${file}`) && statSync(`${out}/${file}`).size > 0) continue; // a rerun fills only the lines the service dropped
  // a fresh connection per line: the service drops long-lived ones
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(out, line, { rate: "+6%" });
  renameSync(audioFilePath, `${out}/${file}`);
  tts.close();
}
writeFileSync(`${out}/lines.json`, JSON.stringify(meta, null, 2));
console.log(`${meta.length} lines in ${voice}`);
