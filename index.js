const { app, BrowserWindow, autoUpdater, ipcMain, dialog, screen, Menu } = require('electron/main');
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

// 本番環境（パッケージ化されたアプリ）でのみ動作させる
if (app.isPackaged) {
  const server = 'https://update.electronjs.org';
  const repo = 'TakayukiTshuji/shuffle_ctrl'; 
  
  const feedURL = `${server}/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;

  try {
    autoUpdater.setFeedURL({ url: feedURL });
    
    // 更新が見つかった時のイベント
    autoUpdater.on('update-available', () => {
      // 必要ならログ出し
      console.log('更新が見つかりました。ダウンロード中...');
    });

    // 更新のダウンロードが完了した時のイベント
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['再起動して更新', '後で'],
        title: '更新あり',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: '新しいバージョンがダウンロードされました。再起動して適用しますか？'
      };
      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    // ▼▼▼ 更新がなかった場合（最新の場合）の処理 ▼▼▼
    autoUpdater.on('update-not-available', () => {
      dialog.showMessageBox({
        type: 'info',
        title: '更新なし',
        message: 'お使いのバージョンは最新です。',
        detail: `現在のバージョン: ${app.getVersion()}`
      });
    });

    // ▼▼▼ エラーが起きた場合（ネット未接続など）も画面に出す ▼▼▼
    autoUpdater.on('error', (message) => {
      dialog.showMessageBox({
        type: 'error',
        title: 'エラー',
        message: '更新の確認中にエラーが発生しました。',
        detail: message.toString() // エラー内容を表示
      });
    });

  } catch (err) {
    console.log('Auto updater setup failed:', err);
  }
}

// 画面（ボタン）からの更新チェック要求を受け取る
ipcMain.on('check-for-update', () => {
  if (!app.isPackaged) {
    // 開発中は動作しないのでメッセージだけ返す
    console.log('開発モードのため更新チェックはスキップします');
    return;
  }
  
  // 更新チェック開始
  autoUpdater.checkForUpdates();
});

const createWindow = () => {
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, './img/playingcard.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
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
