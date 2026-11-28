// Voice-over for the 2–3 min landscape MyEquiGrowth video (meg-long.html), one line per scene.
// Facts come from the client's deck (Presentation newlink.pptx): plan table, Bonus Bash rewards, sign-up steps.
// The deck's "Force Matrix" referral payouts are deliberately left out.
// Run from a folder where `npm i msedge-tts` was done: node voice-gen-long.mjs <out-folder> <voice>
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
const [out, voice] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
// [spoken, caption]: the spoken text spells the brand and numbers for the voice; the caption is what's shown
const LINES = [
  ["When you think about funeral cover... who would you want on your plan? At My Ekwee Growth, you can choose cover for yourself, or for the people who matter most to you.",
   "When you think about funeral cover, who would you want on your plan? At MyEquiGrowth, you can choose cover for yourself, or for the people who matter most to you."],
  ["There are three ways to build your plan. Cover for yourself only. Cover for you, your spouse, and up to six children. Or the extended family plan, which adds up to four parents, and up to four other extended family members.",
   "There are three ways to build your plan. Cover for yourself only. Cover for you, your spouse and up to 6 children. Or the extended family plan, which adds up to 4 parents and up to 4 other extended family members."],
  ["Main members can be aged eighteen to eighty-four, and there are four cover options. From eighteen to sixty-four, cover is ten, fifteen, twenty, or thirty thousand rand. From sixty-five to eighty-four, it's ten, fifteen, twenty, or fifty thousand rand.",
   "Main members can be aged 18 to 84, and there are four cover options. From 18 to 64, cover is R10 000, R15 000, R20 000 or R30 000. From 65 to 84, it's R10 000, R15 000, R20 000 or R50 000."],
  ["So, what does it cost? For main members aged eighteen to sixty-four, member-only cover starts at seventy rand a month. The family plan starts at one hundred and twenty rand, and the extended family plan at two hundred and thirty rand.",
   "So, what does it cost? For main members aged 18 to 64, member-only cover starts at R70 a month. The family plan starts at R120, and the extended family plan at R230."],
  ["For main members aged sixty-five to eighty-four, member-only cover starts at one hundred rand a month, the family plan at two hundred rand, and the extended family plan at three hundred rand.",
   "For main members aged 65 to 84, member-only cover starts at R100 a month, the family plan at R200, and the extended family plan at R300."],
  ["Depending on your package, membership also comes with value-added rewards. Grocery and pharmacy coupons. Value and discount vouchers at participating stores. And discounts on premiership match tickets.",
   "Depending on your package, membership also comes with value-added rewards. Grocery and pharmacy coupons. Value and discount vouchers at participating stores. And discounts on premiership match tickets."],
  ["There's also twenty-four seven home assist. If something goes wrong at home, the helpline can arrange a qualified expert to attend to it.",
   "There's also 24/7 Home Assist. If something goes wrong at home, the helpline can arrange a qualified expert to attend to it."],
  ["Signing up is simple. Go to the website, and choose sign up. Fill in your personal details, with your active mobile number and email address. Then complete your profile, including your bank details.",
   "Signing up is simple. Go to the website and choose Sign up. Fill in your personal details, with your active mobile number and email address. Then complete your profile, including your bank details."],
  ["Visit My Ekwee Growth online, to compare the plans, and see who you can cover.",
   "Visit MyEquiGrowth online to compare the plans and see who you can cover."],
];
const meta = [];
for (const [i, [say, caption]] of LINES.entries()) {
  const file = `line-${String(i).padStart(2, "0")}.mp3`;
  meta.push({ file, start: 0, line: say, caption });
  if (existsSync(`${out}/${file}`) && statSync(`${out}/${file}`).size > 0) continue; // a rerun fills only the lines the service dropped
  const tts = new MsEdgeTTS(); // a fresh connection per line: the service drops long-lived ones
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(out, say, { rate: "+4%" });
  renameSync(audioFilePath, `${out}/${file}`);
  tts.close();
}
writeFileSync(`${out}/lines.json`, JSON.stringify(meta, null, 2));
console.log(`${meta.length} lines in ${voice}`);
