const { app, BrowserWindow, autoUpdater, ipcMain, dialog, screen, Menu } = require('electron/main');
const path = require('path');
const pptxgen = require('pptxgenjs');

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

// pptxのカードのサイズ調整
ipcMain.on('export-pptx', async (event, cards) => {
    if (!cards || cards.length === 0) {
        event.reply('export-pptx-result', { message: 'カードがありません' });
        return;
    }

    const CARD_W = 112;
    const CARD_H = 160;
    const CARD_SCALE = 0.7;        // カードの表示サイズ倍率（小さく）
    const CORNER_RADIUS = 0.08;    // 角丸の半径（インチ）

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(c => {
        const x = parseInt(c.left) || 0;
        const y = parseInt(c.top) || 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + CARD_W > maxX) maxX = x + CARD_W;
        if (y + CARD_H > maxY) maxY = y + CARD_H;
    });

    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;

    const SLIDE_W = 13.33;
    const SLIDE_H = 7.5;
    const MARGIN = 0.4;
    const availW = SLIDE_W - 2 * MARGIN;
    const availH = SLIDE_H - 2 * MARGIN;

    const scale = Math.min(availW / contentW, availH / contentH);
    const scaledW = contentW * scale;
    const scaledH = contentH * scale;
    const offsetX = MARGIN + (availW - scaledW) / 2;
    const offsetY = MARGIN + (availH - scaledH) / 2;
    const cardW = CARD_W * scale * CARD_SCALE;
    const cardH = CARD_H * scale * CARD_SCALE;

    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    const slide = pptx.addSlide();
    slide.background = { color: '1B5E20' };

    const sorted = [...cards].sort((a, b) => (parseInt(a.zIndex) || 0) - (parseInt(b.zIndex) || 0));
    const fontSize = Math.max(8, Math.round(cardH * 72 * 0.32));

    sorted.forEach(card => {
        const x = (parseInt(card.left) - minX) * scale + offsetX;
        const y = (parseInt(card.top) - minY) * scale + offsetY;

        if (card.flipped) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y, w: cardW, h: cardH,
                fill: { color: '4A90E2' },
                line: { color: 'FFFFFF', width: 0.5 },
                rectRadius: CORNER_RADIUS,
            });
            slide.addText('?', {
                x, y, w: cardW, h: cardH,
                fontSize, color: 'FFFFFF', bold: true,
                align: 'center', valign: 'middle',
                fontFace: '游ゴシック',
            });
        } else if (card.cardType === 'playingCard') {
            const suit = card.suit || '';
            const isRed = suit === '♥' || suit === '♦';
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y, w: cardW, h: cardH,
                fill: { color: 'FFFFFF' },
                line: { color: '9CA3AF', width: 0.5 },
                rectRadius: CORNER_RADIUS,
            });
            slide.addText(suit, {
                x, y, w: cardW, h: cardH,
                fontSize, color: isRed ? 'DC2626' : '111111',
                bold: true, align: 'center', valign: 'middle',
                fontFace: '游ゴシック',
            });
        } else {
            const color = (card.color || '#888888').replace('#', '');
            slide.addShape(pptx.ShapeType.roundRect, {
              x, y, w: cardW, h: cardH,
              fill: { color },
              line: { color: '333333', width: 0.5 },
              rectRadius: CORNER_RADIUS,
          });
        }
    });

    const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'PPTXファイルを保存',
        defaultPath: 'card_layout.pptx',
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    });

    if (canceled || !filePath) {
        event.reply('export-pptx-result', { message: 'キャンセルされました' });
        return;
    }

    try {
        await pptx.writeFile({ fileName: filePath });
        event.reply('export-pptx-result', { message: 'PPTXを保存しました！' });
    } catch (err) {
        event.reply('export-pptx-result', { message: 'エラー: ' + err.message });
    }
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
