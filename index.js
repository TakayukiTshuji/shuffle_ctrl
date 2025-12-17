const { app, BrowserWindow, screen, Menu } = require('electron/main');
const path = require('path');

// インストール/アンインストール時にショートカットを作成・削除する関数
const handleSquirrelEvent = () => {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawnUpdate = function(args) {
    let spawnedProcess, error;
    try {
      spawnedProcess = ChildProcess.spawn(updateDotExe, args, { detached: true });
    } catch (error) {}
    return spawnedProcess;
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // ここでデスクトップとスタートメニューにショートカットを作成します
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // アンインストール時にショートカットを削除します
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
};

// この関数が true を返したら（インストール処理中なら）、アプリ本体は起動せずに終了する
if (handleSquirrelEvent()) {
  return;
}

try {
  const updateElectronApp = require('update-electron-app');
  updateElectronApp();
} catch (error) {
  console.log('Auto-update not available: ', error.message);
}

const createWindow = () => {
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, './img/playingcard.ico'),
    webPreferences: {
      nodeIntegration: true,
      zoomFactor: 0.46,
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
