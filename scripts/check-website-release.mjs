// Configured as the first step of the sora-website project's Vercel build.
// Checkouts from before the website audit lack this script, so their builds fail before promotion.
const productionBranch = "sora-website-waitlist";
const branch = process.env.VERCEL_GIT_COMMIT_REF;

if (process.env.VERCEL_ENV === "production" && branch && branch !== productionBranch) {
  throw new Error(`Publish the Sora website from ${productionBranch}. This build uses ${branch}.`);
}

console.log(`Sora website release check passed${branch ? ` for ${branch}` : ""}.`);
