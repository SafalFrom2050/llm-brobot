const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brobot", {
  listModels: () => ipcRenderer.invoke("ollama:listModels"),
  chat: (payload) => ipcRenderer.invoke("ollama:chat", payload)
});
