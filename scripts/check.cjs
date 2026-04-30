const { spawnSync } = require("node:child_process");

const files = [
  "electron/main.cjs",
  "electron/preload.cjs",
  "scripts/dev.cjs",
  "scripts/check.cjs",
  "scripts/run-smoke.cjs",
  "vite.config.js",
  "src/main.js",
  "src/robotScene.js",
  "src/robotSchema.js"
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("Syntax check passed.");
