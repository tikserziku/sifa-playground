const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true,
    title: 'Sifa Playground',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// Groq API will be handled here in Phase 5
ipcMain.handle('groq-decision', async (_event, gameState) => {
  // Placeholder — returns random decisions for now
  const agents = gameState.agentIds || [0, 1, 2, 3, 4];
  return agents.map(id => ({
    id,
    moveX: (Math.random() - 0.5) * 2,
    moveZ: (Math.random() - 0.5) * 2,
    sprint: Math.random() > 0.7,
  }));
});
