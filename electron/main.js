const path = require('path');
const { app, BrowserWindow, Menu } = require('electron');
const { startStaticServer } = require('../lib/local-static-server');

let mainWindow;
let server;

function getStaticRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build');
  }
  return path.resolve(__dirname, '..', 'build');
}

async function createMainWindow() {
  const staticRoot = getStaticRoot();
  const started = await startStaticServer(staticRoot);
  server = started.server;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(started.url);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  return createMainWindow();
});
