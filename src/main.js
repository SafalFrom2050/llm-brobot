import "./styles.css";
import { RobotScene } from "./robotScene.js";
import {
  ACTION_JSON_SCHEMA,
  DEFAULT_ACTION,
  DEMO_ACTIONS,
  actionSummary,
  buildSystemPrompt,
  fallbackActionForText,
  normalizeRobotAction
} from "./robotSchema.js";

const elements = {
  stage: document.querySelector("#robotStage"),
  connectionState: document.querySelector("#connectionState"),
  robotState: document.querySelector("#robotState"),
  resetViewButton: document.querySelector("#resetViewButton"),
  demoHappyButton: document.querySelector("#demoHappyButton"),
  demoShyButton: document.querySelector("#demoShyButton"),
  demoSleepyButton: document.querySelector("#demoSleepyButton"),
  modelInput: document.querySelector("#modelInput"),
  modelSelect: document.querySelector("#modelSelect"),
  refreshModelsButton: document.querySelector("#refreshModelsButton"),
  systemPrompt: document.querySelector("#systemPrompt"),
  voiceButton: document.querySelector("#voiceButton"),
  imageButton: document.querySelector("#imageButton"),
  imageInput: document.querySelector("#imageInput"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraPreview: document.querySelector("#cameraPreview"),
  cameraCanvas: document.querySelector("#cameraCanvas"),
  attachmentTray: document.querySelector("#attachmentTray"),
  speakToggle: document.querySelector("#speakToggle"),
  timeline: document.querySelector("#timeline"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton")
};

const robot = new RobotScene(elements.stage);
let currentAction = normalizeRobotAction(DEFAULT_ACTION);
let conversation = [];
let pendingImage = null;
let cameraStream = null;
let cameraTimer = null;
let cameraFrame = null;
let recognition = null;
let listening = false;
let busy = false;

elements.systemPrompt.value = buildSystemPrompt();
updateRobotState(currentAction);
appendTimeline("robot", currentAction.text, currentAction);
setupEvents();
setupSpeechRecognition();
refreshModels();

function setupEvents() {
  elements.resetViewButton.addEventListener("click", () => robot.resetView());
  elements.demoHappyButton.addEventListener("click", () => playAction(DEMO_ACTIONS.happy));
  elements.demoShyButton.addEventListener("click", () => playAction(DEMO_ACTIONS.shy));
  elements.demoSleepyButton.addEventListener("click", () => playAction(DEMO_ACTIONS.sleepy));
  elements.refreshModelsButton.addEventListener("click", refreshModels);
  elements.modelSelect.addEventListener("change", () => {
    if (elements.modelSelect.value) {
      elements.modelInput.value = elements.modelSelect.value;
    }
  });
  elements.imageButton.addEventListener("click", () => elements.imageInput.click());
  elements.imageInput.addEventListener("change", handleImagePick);
  elements.cameraButton.addEventListener("click", toggleCamera);
  elements.voiceButton.addEventListener("click", toggleVoice);
  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
}

async function refreshModels() {
  setConnection("Checking Ollama", "working");
  elements.refreshModelsButton.disabled = true;

  if (!window.brobot?.listModels) {
    setConnection("Electron bridge unavailable", "offline");
    elements.refreshModelsButton.disabled = false;
    return;
  }

  const result = await window.brobot.listModels();
  elements.modelSelect.replaceChildren(new Option("Installed models", ""));

  if (!result.ok) {
    setConnection("Ollama offline", "offline");
    elements.refreshModelsButton.disabled = false;
    return;
  }

  const names = result.models.map((model) => model.name).filter(Boolean);
  names.forEach((name) => elements.modelSelect.add(new Option(name, name)));

  const preferred = names.find((name) => /gemma.*4/i.test(name))
    || names.find((name) => /gemma/i.test(name))
    || names.find((name) => /vision/i.test(name))
    || names[0];

  if (preferred && (!elements.modelInput.value || elements.modelInput.value === "gemma4:latest")) {
    elements.modelInput.value = preferred;
    elements.modelSelect.value = preferred;
  }

  setConnection(names.length ? `Ollama ready (${names.length})` : "Ollama ready", "online");
  elements.refreshModelsButton.disabled = false;
}

async function sendMessage() {
  const text = elements.messageInput.value.trim();
  if (!text || busy) {
    return;
  }

  busy = true;
  elements.sendButton.disabled = true;
  elements.messageInput.value = "";
  appendTimeline("user", text);

  const images = await collectImagesForMessage();
  const userContent = images.length
    ? `${text}\n\n${images.length} image frame(s) are attached. Use them only if your model can inspect images.`
    : text;

  const userMessage = {
    role: "user",
    content: userContent,
    ...(images.length ? { images } : {})
  };

  try {
    const action = await requestRobotAction(userMessage, text);
    playAction(action);
    appendTimeline("robot", action.text, action);
    conversation.push({ role: "user", content: userContent });
    conversation.push({ role: "assistant", content: JSON.stringify(action) });
    conversation = conversation.slice(-10);
  } finally {
    busy = false;
    elements.sendButton.disabled = false;
    elements.messageInput.focus();
  }
}

async function requestRobotAction(userMessage, originalText) {
  if (!window.brobot?.chat) {
    setConnection("Local fallback", "offline");
    return fallbackActionForText(originalText);
  }

  setConnection("Thinking", "working");
  const model = elements.modelInput.value.trim();
  const payload = {
    model,
    systemPrompt: elements.systemPrompt.value,
    schema: ACTION_JSON_SCHEMA,
    messages: [...conversation.slice(-8), userMessage],
    temperature: 0.68
  };

  const result = await window.brobot.chat(payload);
  if (!result.ok) {
    setConnection("Fallback action", "offline");
    appendTimeline("system", result.error || "Ollama request failed.");
    return fallbackActionForText(originalText);
  }

  if (result.warning) {
    appendTimeline("system", `Schema retry: ${result.warning}`);
  }

  setConnection(`Ollama: ${result.model || model}`, "online");
  const action = normalizeRobotAction(result.content, fallbackActionForText(originalText));
  return action;
}

function playAction(action) {
  currentAction = normalizeRobotAction(action, currentAction);
  robot.applyAction(currentAction);
  updateRobotState(currentAction);
  speak(currentAction);
}

function updateRobotState(action) {
  elements.robotState.textContent = actionSummary(action);
}

function appendTimeline(role, text, action) {
  const item = document.createElement("article");
  item.className = `timeline-item ${role}`;

  const label = document.createElement("div");
  label.className = "timeline-label";
  label.textContent = role === "robot" ? "Brobot" : role === "user" ? "You" : "System";
  item.appendChild(label);

  const body = document.createElement("div");
  body.className = "timeline-body";
  body.textContent = text;
  item.appendChild(body);

  if (action) {
    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    meta.textContent = actionSummary(action);
    item.appendChild(meta);
  }

  elements.timeline.appendChild(item);
  while (elements.timeline.children.length > 28) {
    elements.timeline.firstElementChild.remove();
  }
  elements.timeline.scrollTop = elements.timeline.scrollHeight;
}

function setConnection(text, mode) {
  elements.connectionState.textContent = text;
  elements.connectionState.dataset.mode = mode;
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    elements.voiceButton.disabled = true;
    elements.voiceButton.title = "Speech recognition is unavailable";
    return;
  }

  recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.addEventListener("result", (event) => {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }
    elements.messageInput.value = (finalText || interimText).trim();
  });

  recognition.addEventListener("end", () => {
    listening = false;
    elements.voiceButton.classList.remove("active");
  });
}

function toggleVoice() {
  if (!recognition) {
    return;
  }

  if (listening) {
    recognition.stop();
    listening = false;
    elements.voiceButton.classList.remove("active");
    return;
  }

  elements.messageInput.value = "";
  recognition.start();
  listening = true;
  elements.voiceButton.classList.add("active");
}

function speak(action) {
  if (!elements.speakToggle.checked || !("speechSynthesis" in window)) {
    robot.setSpeaking(false);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(action.text);
  utterance.pitch = action.voice.pitch;
  utterance.rate = action.voice.rate;
  utterance.volume = action.voice.tone === "whisper" ? 0.58 : 0.9;

  window.speechSynthesis.cancel();
  utterance.addEventListener("start", () => robot.setSpeaking(true));
  utterance.addEventListener("end", () => robot.setSpeaking(false));
  utterance.addEventListener("error", () => robot.setSpeaking(false));
  window.speechSynthesis.speak(utterance);

  window.setTimeout(() => {
    if (window.speechSynthesis.speaking) {
      robot.setSpeaking(true);
    }
  }, 80);
}

async function handleImagePick() {
  const file = elements.imageInput.files?.[0];
  if (!file) {
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  pendingImage = {
    source: "image",
    name: file.name,
    mime: file.type || "image/png",
    dataUrl,
    base64: dataUrlToBase64(dataUrl)
  };
  elements.imageInput.value = "";
  renderAttachmentTray();
}

async function toggleCamera() {
  if (cameraStream) {
    stopCamera();
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 420 },
        height: { ideal: 280 },
        frameRate: { ideal: 1, max: 2 }
      },
      audio: false
    });
    elements.cameraPreview.srcObject = cameraStream;
    await elements.cameraPreview.play();
    elements.cameraPreview.classList.add("active");
    elements.cameraButton.classList.add("active");
    captureCameraFrame();
    cameraTimer = window.setInterval(captureCameraFrame, 3200);
    renderAttachmentTray();
  } catch (error) {
    appendTimeline("system", `Camera unavailable: ${error.message}`);
    stopCamera();
  }
}

function stopCamera() {
  if (cameraTimer) {
    window.clearInterval(cameraTimer);
    cameraTimer = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraFrame = null;
  elements.cameraPreview.srcObject = null;
  elements.cameraPreview.classList.remove("active");
  elements.cameraButton.classList.remove("active");
  renderAttachmentTray();
}

function captureCameraFrame() {
  if (!cameraStream || elements.cameraPreview.readyState < 2) {
    return null;
  }

  const video = elements.cameraPreview;
  const canvas = elements.cameraCanvas;
  const width = video.videoWidth || 420;
  const height = video.videoHeight || 280;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  cameraFrame = {
    source: "camera",
    name: "low-fps camera frame",
    mime: "image/jpeg",
    dataUrl,
    base64: dataUrlToBase64(dataUrl)
  };
  renderAttachmentTray();
  return cameraFrame;
}

async function collectImagesForMessage() {
  const images = [];
  if (pendingImage?.base64) {
    images.push(pendingImage.base64);
  }
  const frame = cameraStream ? captureCameraFrame() || cameraFrame : null;
  if (frame?.base64) {
    images.push(frame.base64);
  }
  pendingImage = null;
  renderAttachmentTray();
  return images;
}

function renderAttachmentTray() {
  elements.attachmentTray.replaceChildren();

  if (pendingImage) {
    elements.attachmentTray.appendChild(createAttachmentPreview(pendingImage, () => {
      pendingImage = null;
      renderAttachmentTray();
    }));
  }

  if (cameraFrame) {
    elements.attachmentTray.appendChild(createAttachmentPreview(cameraFrame));
  }
}

function createAttachmentPreview(attachment, onRemove) {
  const item = document.createElement("div");
  item.className = "attachment-item";

  const image = document.createElement("img");
  image.src = attachment.dataUrl;
  image.alt = attachment.name;
  item.appendChild(image);

  const label = document.createElement("span");
  label.textContent = attachment.source === "camera" ? "camera" : attachment.name;
  item.appendChild(label);

  if (onRemove) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", onRemove);
    item.appendChild(button);
  }

  return item;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl) {
  return String(dataUrl).split(",")[1] || "";
}
