const { spawnSync } = require("node:child_process");
const electronBin = require("electron");

const result = spawnSync(electronBin, ["."], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    BROBOT_SMOKE: "1"
  },
  stdio: "inherit"
});

process.exit(result.status || 0);
