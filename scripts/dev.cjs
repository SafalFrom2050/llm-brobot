const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const viteBin = path.join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const electronBin = require("electron");

let electronProcess = null;
let resolvedUrl = null;

const viteProcess = spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

function pipeOutput(stream, target) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    target.write(text);
    const cleanText = stripAnsi(text);
    const match = cleanText.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
    if (match && !resolvedUrl) {
      resolvedUrl = `http://127.0.0.1:${match[1]}/`;
      waitForServer(resolvedUrl).then(startElectron).catch((error) => {
        console.error(error);
        shutdown(1);
      });
    }
  });
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function waitForServer(url, tries = 80) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (remaining <= 0) {
          reject(new Error(`Vite did not become ready at ${url}`));
          return;
        }
        setTimeout(() => attempt(remaining - 1), 150);
      });
    };

    attempt(tries);
  });
}

function startElectron() {
  if (electronProcess || !resolvedUrl) {
    return;
  }

  electronProcess = spawn(electronBin, ["."], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: resolvedUrl
    },
    stdio: "inherit"
  });

  electronProcess.on("exit", (code) => shutdown(code || 0));
}

function shutdown(code) {
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill();
  }
  process.exit(code);
}

pipeOutput(viteProcess.stdout, process.stdout);
pipeOutput(viteProcess.stderr, process.stderr);

viteProcess.on("exit", (code) => {
  if (!electronProcess) {
    process.exit(code || 0);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
