const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "Accessible Media Player",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Necessary for Web Audio API MediaElementSource with file:// paths
    }
  });

  win.loadFile('index.html');
  win.setFullScreen(true); // Open in full screen

  // Massive organization: Native Application Menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File(s)', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu-action', 'open-file') },
        { type: 'separator' },
        { label: 'Open Playlist', click: () => win.webContents.send('menu-action', 'open-playlist') },
        { label: 'Save Playlist', click: () => win.webContents.send('menu-action', 'save-playlist') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        { label: 'Play/Pause', click: () => win.webContents.send('menu-action', 'play-pause') },
        { label: 'Next Track', accelerator: 'CmdOrCtrl+Right', click: () => win.webContents.send('menu-action', 'next-track') },
        { label: 'Previous Track', accelerator: 'CmdOrCtrl+Left', click: () => win.webContents.send('menu-action', 'prev-track') },
        { type: 'separator' },
        { label: 'Loop', click: () => win.webContents.send('menu-action', 'toggle-loop') },
      ]
    },
    {
      label: 'Audio',
      submenu: [
        { label: 'Volume Up', click: () => win.webContents.send('menu-action', 'vol-up') },
        { label: 'Volume Down', click: () => win.webContents.send('menu-action', 'vol-down') },
        { label: 'Mute', click: () => win.webContents.send('menu-action', 'toggle-mute') },
        { type: 'separator' },
        { label: 'Equalizer & Settings', click: () => win.webContents.send('menu-action', 'toggle-eq') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Fullscreen', click: () => win.webContents.send('menu-action', 'toggle-fullscreen') },
        { label: 'Picture-in-Picture', click: () => win.webContents.send('menu-action', 'toggle-pip') },
        { label: 'Toggle Playlist Sidebar', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.send('menu-action', 'toggle-playlist-sidebar') },
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const mediaFilters = [
  { name: 'All Media Files', extensions: ['mp4', 'mkv', 'avi', 'webm', 'ogv', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
  { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'webm', 'ogv'] },
  { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
  { name: 'All Files', extensions: ['*'] }
];

ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: "Select Media Files",
    filters: mediaFilters
  });
  return canceled ? null : filePaths;
});

// Playlist Saving (custom .amp JSON format)
ipcMain.handle('save-playlist', async (event, playlistArray) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Playlist',
    defaultPath: 'MyPlaylist.amp',
    filters: [{ name: 'AMP Playlist', extensions: ['amp'] }]
  });
  if (!canceled && filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(playlistArray, null, 2));
      return true;
    } catch (e) {
      console.error('Failed to save playlist:', e);
      return false;
    }
  }
  return false;
});

// Playlist Loading
ipcMain.handle('open-playlist', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Playlist',
    properties: ['openFile'],
    filters: [{ name: 'AMP Playlist', extensions: ['amp'] }]
  });
  if (!canceled && filePaths.length > 0) {
    try {
      const data = fs.readFileSync(filePaths[0], 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load playlist:', e);
      return null;
    }
  }
  return null;
});

// Screenshot Saving Handler
ipcMain.on('save-screenshot', async (event, dataUrl) => {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Screenshot',
    defaultPath: `Screenshot_${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (!canceled && filePath) {
    try {
      fs.writeFileSync(filePath, base64Data, 'base64');
    } catch (e) {
      console.error('Failed to save screenshot:', e);
    }
  }
});

