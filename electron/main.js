// 一一助手 — Electron 桌面应用入口
const { app, BrowserWindow } = require('electron');
const { readFileSync, existsSync } = require('fs');

const PORT = 3456;
let mainWindow = null;
let httpServer = null;

// 从配置文件读取 BIT_KEY（跟 start.sh 一样的逻辑）
function loadBitKey() {
  const paths = [
    __dirname + '/../config/.bit_key',
    __dirname + '/../.bit_key',
    '/tmp/bit_key.txt'
  ];
  for (const p of paths) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8').trim();
      }
    } catch {}
  }
  return process.env.BIT_KEY || '';
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '一一助手',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:' + PORT);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // 设置 BIT_KEY 后再启动服务器
    const bitKey = loadBitKey();
    if (bitKey) process.env.BIT_KEY = bitKey;

    // 动态 import ESM 模块启动 HTTP 服务器
    const serverModule = await import('../server/server.mjs');
    httpServer = await serverModule.startServer(PORT);
    console.log('✅ 服务器已启动');
  } catch (e) {
    console.error('❌ 服务器启动失败:', e.message);
    app.quit();
    return;
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS: Cmd+Q 才退出，关闭窗口不退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (httpServer) {
    httpServer.close();
    console.log('🛑 服务器已关闭');
  }
});
