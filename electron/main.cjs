const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const SMOKE_MODE = process.env.BROBOT_SMOKE === "1";

if (SMOKE_MODE) {
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  app.commandLine.appendSwitch("in-process-gpu");
  app.disableHardwareAcceleration();
  const smokeUserData = path.join(process.cwd(), "artifacts", "electron-smoke-profile");
  fs.mkdirSync(smokeUserData, { recursive: true });
  app.setPath("userData", smokeUserData);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: SMOKE_MODE ? 320 : 980,
    minHeight: SMOKE_MODE ? 560 : 700,
    backgroundColor: "#101211",
    title: "Brobot Companion Lab",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const loadPromise = process.env.VITE_DEV_SERVER_URL
    ? mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    : mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  if (process.env.VITE_DEV_SERVER_URL && !SMOKE_MODE) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  if (SMOKE_MODE) {
    loadPromise
      .then(() => runSmokeSuite(mainWindow))
      .catch((error) => {
        console.error(error);
        app.exit(1);
      });
  }
}

async function fetchOllama(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000);
  const url = new URL(pathname, OLLAMA_BASE_URL);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const reason = data.error || data.raw || response.statusText;
      throw new Error(`Ollama ${response.status}: ${reason}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle("ollama:listModels", async () => {
  try {
    const data = await fetchOllama("/api/tags", { method: "GET", timeoutMs: 8000 });
    return {
      ok: true,
      models: Array.isArray(data.models) ? data.models : []
    };
  } catch (error) {
    return { ok: false, error: error.message, models: [] };
  }
});

ipcMain.handle("ollama:chat", async (_event, payload) => {
  const model = String(payload?.model || "").trim();
  if (!model) {
    return { ok: false, error: "Choose an Ollama model first." };
  }

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const systemPrompt = String(payload?.systemPrompt || "");
  const baseRequest = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages
    ],
    stream: false,
    keep_alive: "10m",
    options: {
      temperature: Number.isFinite(payload?.temperature) ? payload.temperature : 0.65,
      top_p: 0.9
    }
  };

  const schema = payload?.schema && typeof payload.schema === "object" ? payload.schema : null;
  const requestWithSchema = {
    ...baseRequest,
    format: schema || "json"
  };

  try {
    const data = await fetchOllama("/api/chat", {
      method: "POST",
      body: JSON.stringify(requestWithSchema),
      timeoutMs: 120000
    });
    return {
      ok: true,
      model: data.model || model,
      content: data.message?.content || data.response || "",
      raw: data
    };
  } catch (schemaError) {
    if (!schema) {
      return { ok: false, error: schemaError.message };
    }

    try {
      const data = await fetchOllama("/api/chat", {
        method: "POST",
        body: JSON.stringify({ ...baseRequest, format: "json" }),
        timeoutMs: 120000
      });
      return {
        ok: true,
        model: data.model || model,
        content: data.message?.content || data.response || "",
        raw: data,
        warning: schemaError.message
      };
    } catch (jsonError) {
      return { ok: false, error: jsonError.message };
    }
  }
});

async function runSmokeSuite(win) {
  const outputDir = path.join(process.cwd(), "artifacts");
  const viewports = [
    { name: "desktop", width: 1365, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ];
  const results = [];

  fs.mkdirSync(outputDir, { recursive: true });

  for (const viewport of viewports) {
    win.setSize(viewport.width, viewport.height);
    win.center();
    win.webContents.sendInputEvent({ type: "mouseMove", x: 10, y: 10 });
    await delay(1200);

    const metrics = await win.webContents.executeJavaScript(`
      (() => {
        const canvas = document.querySelector("#robotStage canvas");
        const rect = canvas ? canvas.getBoundingClientRect() : null;
        const doc = document.documentElement;
        return {
          canvasRect: rect ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          } : null,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth
        };
      })()
    `);

    const image = await win.webContents.capturePage();
    const screenshotPath = path.join(outputDir, `smoke-${viewport.name}.png`);
    fs.writeFileSync(screenshotPath, image.toPNG());

    const pixelStats = countCanvasPixels(image, metrics.canvasRect);
    const pass = Boolean(metrics.canvasRect)
      && metrics.canvasRect.width > 250
      && metrics.canvasRect.height > 250
      && metrics.scrollWidth <= metrics.clientWidth + 2
      && pixelStats.brightRatio > 0.035;

    results.push({
      viewport: viewport.name,
      pass,
      screenshotPath,
      canvasRect: metrics.canvasRect,
      horizontalOverflow: metrics.scrollWidth - metrics.clientWidth,
      brightRatio: Number(pixelStats.brightRatio.toFixed(4)),
      sampledPixels: pixelStats.sampledPixels
    });
  }

  console.log(JSON.stringify(results, null, 2));
  app.exit(results.some((result) => !result.pass) ? 1 : 0);
}

function countCanvasPixels(image, rect) {
  if (!rect) {
    return { brightRatio: 0, sampledPixels: 0 };
  }

  const size = image.getSize();
  const bitmap = image.toBitmap();
  let brightPixels = 0;
  let sampledPixels = 0;
  const x0 = clamp(rect.x, 0, size.width - 1);
  const y0 = clamp(rect.y, 0, size.height - 1);
  const x1 = clamp(rect.x + rect.width, 0, size.width);
  const y1 = clamp(rect.y + rect.height, 0, size.height);
  const step = 4;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const index = (y * size.width + x) * 4;
      const blue = bitmap[index];
      const green = bitmap[index + 1];
      const red = bitmap[index + 2];
      const brightness = (red + green + blue) / 3;
      if (brightness > 58) {
        brightPixels += 1;
      }
      sampledPixels += 1;
    }
  }

  return {
    brightRatio: sampledPixels ? brightPixels / sampledPixels : 0,
    sampledPixels
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["media"].includes(permission));
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
