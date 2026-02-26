const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  askGroq: (gameState) => ipcRenderer.invoke('groq-decision', gameState),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
