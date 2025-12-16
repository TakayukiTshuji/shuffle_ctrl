const { app, BrowserWindow, screen, Menu } = require('electron/main');

try {
  const updateElectronApp = require('update-electron-app')();
  updateElectronApp();
} catch (error) {
  console.log('Auto-update not available: ', error.message);
}

const createWindow = () => {
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width,
    height,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadFile('index.html');
};
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
