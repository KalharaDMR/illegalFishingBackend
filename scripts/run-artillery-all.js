/**
 * Runs every *.yml in /artillery (except files starting with _).
 * Loads .env via dotenv-cli. Continues on failure; exits 1 if any run failed.
 *
 * Usage: node scripts/run-artillery-all.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const artilleryDir = path.join(root, "artillery");

const files = fs
  .readdirSync(artilleryDir)
  .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
  .sort();

let failed = 0;
for (const f of files) {
  const full = path.join(artilleryDir, f);
  console.log(`\n${"=".repeat(60)}\n ${f}\n${"=".repeat(60)}\n`);
  try {
    execSync(`npx dotenv -e .env -- npx artillery run "${full}"`, {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });
  } catch {
    failed += 1;
    console.error(`\n[FAILED] ${f}\n`);
  }
}

console.log(`\nDone. ${files.length - failed}/${files.length} succeeded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
