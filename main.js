const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, Notification, Tray, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Persisted window bounds
const boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');
function loadBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile, 'utf-8')); } catch (e) { return null; }
}
function saveBounds(b) {
  try { fs.writeFileSync(boundsFile, JSON.stringify(b)); } catch (e) {}
}

// Track the main window for IPC / media keys
let mainWin = null;
let miniPreviousBounds = null;
let watchWatchers = [];


function createWindow() {
  const saved = loadBounds();
  const win = new BrowserWindow({
    width: saved ? saved.width : 1000,
    height: saved ? saved.height : 700,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    title: "Accessible Media Player",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Necessary for Web Audio API MediaElementSource with file:// paths
    }
  });
  mainWin = win;

  win.loadFile('index.html').catch(e => console.error('Failed to load index.html:', e));
  win.setFullScreen(true); // Open in full screen

  win.on('resize', () => { if (!win.isFullScreen() && !win.isMinimized()) saveBounds(win.getBounds()); });
  win.on('move', () => { if (!win.isFullScreen() && !win.isMinimized()) saveBounds(win.getBounds()); });

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
        { label: 'Open URL…', click: () => win.webContents.send('request-url') },
        { label: 'Watch Folder…', click: () => pickWatchFolder(win) },
        { type: 'separator' },
        { label: 'Set as Default Media Player…', click: () => { try { shell.openExternal('ms-settings:defaultapps'); } catch (e) { console.error(e); } } },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        { label: 'Play/Pause', accelerator: 'CmdOrCtrl+Space', click: () => win.webContents.send('media-key', 'play-pause') },
        { label: 'Next Track', accelerator: 'CmdOrCtrl+Right', click: () => win.webContents.send('media-key', 'next') },
        { label: 'Previous Track', accelerator: 'CmdOrCtrl+Left', click: () => win.webContents.send('media-key', 'prev') },
        { type: 'separator' },
        { label: 'Loop', click: () => win.webContents.send('menu-action', 'toggle-loop') },
      ]
    },
    {
      label: 'Audio',
      submenu: [
        { label: 'Volume Up', accelerator: 'CmdOrCtrl+Up', click: () => win.webContents.send('menu-action', 'vol-up') },
        { label: 'Volume Down', accelerator: 'CmdOrCtrl+Down', click: () => win.webContents.send('menu-action', 'vol-down') },
        { label: 'Mute', click: () => win.webContents.send('menu-action', 'toggle-mute') },
        { type: 'separator' },
        { label: 'Equalizer & Settings', click: () => win.webContents.send('menu-action', 'toggle-eq') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => win.webContents.send('menu-action', 'toggle-fullscreen') },
        { label: 'Home Screen', accelerator: 'CmdOrCtrl+H', click: () => win.webContents.send('request-home') },
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+Shift+P', click: () => win.webContents.send('request-palette') },
        { label: 'Picture-in-Picture', click: () => win.webContents.send('menu-action', 'toggle-pip') },
        { label: 'Toggle Playlist Sidebar', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.send('menu-action', 'toggle-playlist-sidebar') },
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createTray(win);

  // Close window quits the app entirely
}

function createTrayIcon() {
  const zlib = require('zlib');
  const S = 32;
  const rgba = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, dx = x - S/2 + 0.5, dy = y - S/2 + 0.5;
      if (Math.sqrt(dx*dx + dy*dy) < S/2 - 1) { rgba[i]=100; rgba[i+1]=180; rgba[i+2]=255; rgba[i+3]=255; }
    }
  }
  const raw = Buffer.alloc(S * (1 + S * 4));
  for (let y = 0; y < S; y++) {
    raw[y * (1 + S * 4)] = 0;
    for (let x = 0; x < S; x++) {
      const si = (y * S + x) * 4, di = y * (1 + S * 4) + 1 + x * 4;
      raw[di]=rgba[si]; raw[di+1]=rgba[si+1]; raw[di+2]=rgba[si+2]; raw[di+3]=rgba[si+3];
    }
  }
  const deflated = zlib.deflateSync(raw);
  const crc32 = (b) => { let c=0xFFFFFFFF; for(let i=0;i<b.length;i++){c^=b[i];for(let j=0;j<8;j++)c=(c&1)?((c>>>1)^0xEDB88320):(c>>>1);}return (c^0xFFFFFFFF)>>>0; };
  const chk = (t, d) => { const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const tb=Buffer.from(t,'ascii'); const cv=Buffer.alloc(4); cv.writeUInt32BE(crc32(Buffer.concat([tb,d]))); return Buffer.concat([l,tb,d,cv]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S,0); ihdr.writeUInt32BE(S,4); ihdr[8]=8; ihdr[9]=6;
  return nativeImage.createFromBuffer(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chk('IHDR',ihdr), chk('IDAT',deflated), chk('IEND',Buffer.alloc(0))]));
}

function createTray(win) {
  try {
    const icon = createTrayIcon();
    const tray = new Tray(icon);
    const trayMenu = Menu.buildFromTemplate([
      { label: 'Show / Hide', click: () => { if (win.isVisible() && !win.isMinimized()) win.hide(); else { win.show(); win.focus(); } } },
      { label: 'Play / Pause', click: () => win.webContents.send('media-key', 'play-pause') },
      { label: 'Next', click: () => win.webContents.send('media-key', 'next') },
      { label: 'Previous', click: () => win.webContents.send('media-key', 'prev') },
      { type: 'separator' },
      { label: 'Quit Accessible Media Player', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Accessible Media Player');
    tray.setContextMenu(trayMenu);
    tray.on('click', () => { if (win.isVisible() && !win.isMinimized()) win.hide(); else { win.show(); win.focus(); } });
  } catch (e) { console.error('Tray failed', e); }
}

// Handle files passed as CLI arguments
const pendingFiles = [];

function handleCliArgs() {
  const args = process.argv.slice(1);
  for (const a of args) {
    if (fs.existsSync(a) && !fs.statSync(a).isDirectory()) pendingFiles.push(a);
  }
}

handleCliArgs();

app.whenReady().then(() => {
  // Single instance: route additional launches / file opens to the main window
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  createWindow();

  // Global media keys (hardware keyboards / headsets)
  try {
    globalShortcut.register('MediaPlayPause', () => mainWin && mainWin.webContents.send('media-key', 'play-pause'));
    globalShortcut.register('MediaNextTrack', () => mainWin && mainWin.webContents.send('media-key', 'next'));
    globalShortcut.register('MediaPreviousTrack', () => mainWin && mainWin.webContents.send('media-key', 'prev'));
    globalShortcut.register('MediaStop', () => mainWin && mainWin.webContents.send('media-key', 'stop'));
  } catch (e) { console.error('Media keys unavailable', e); }

  // Files opened via OS (double-click / drag onto icon)
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWin) mainWin.webContents.send('open-external', filePath);
    else pendingFiles.push(filePath);
  });

  app.on('second-instance', (event, argv) => {
    const args = argv.slice(1);
    for (const a of args) {
      if (fs.existsSync(a) && !fs.statSync(a).isDirectory()) {
        if (mainWin) mainWin.webContents.send('open-external', a);
      }
    }
    if (mainWin) { mainWin.show(); mainWin.focus(); }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(err => { console.error('App init failed:', err); app.quit(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

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
      dialog.showErrorBox('Save Error', `Could not save playlist to ${filePath}:\n${e.message}`);
      return false;
    }
  }
  return false;
});

// Playlist Loading (supports .amp JSON and .m3u)
ipcMain.handle('open-playlist', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Playlist',
    properties: ['openFile'],
    filters: [
      { name: 'All Playlists', extensions: ['amp', 'm3u'] },
      { name: 'AMP Playlist', extensions: ['amp'] },
      { name: 'M3U Playlist', extensions: ['m3u'] }
    ]
  });
  if (!canceled && filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const lower = filePaths[0].toLowerCase();
      if (lower.endsWith('.m3u')) {
        const list = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        return list;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load playlist:', e);
      return null;
    }
  }
  return null;
});

// M3U Export
ipcMain.handle('save-m3u', async (event, playlistArray) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export M3U Playlist',
    defaultPath: 'playlist.m3u',
    filters: [{ name: 'M3U Playlist', extensions: ['m3u'] }]
  });
  if (!canceled && filePath) {
    try {
      fs.writeFileSync(filePath, '#EXTM3U\n' + playlistArray.join('\n') + '\n');
      return true;
    } catch (e) { console.error('Failed to save m3u', e); return false; }
  }
  return false;
});

// Add Folder (recursive media scan)
ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Add Folder to Playlist',
    properties: ['openDirectory']
  });
  if (canceled || !filePaths.length) return null;
  const exts = mediaFilters[0].extensions;
  const results = [];
  try {
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp);
        else if (exts.some(x => e.name.toLowerCase().endsWith('.' + x))) results.push(fp);
      }
    };
    walk(filePaths[0]);
  } catch (e) { console.error('Folder scan failed', e); }
  return results;
});

// Audio output device selection (forwarded to renderer for HTMLMediaElement.setSinkId)
ipcMain.on('set-audio-device', (event, deviceId) => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('set-audio-device-renderer', deviceId);
});

// Always-on-top
ipcMain.on('set-always-on-top', (event, on) => {
  if (mainWin) mainWin.setAlwaysOnTop(!!on);
});

// Launch on system startup
ipcMain.on('set-startup', (event, on) => {
  try { app.setLoginItemSettings({ openAtLogin: !!on }); } catch (e) { console.error('setLoginItemSettings failed', e); }
});

// Subtitle export
ipcMain.handle('save-subs', async (event, { name, text }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Subtitles',
    defaultPath: name || 'subtitles.srt',
    filters: [{ name: 'SubRip', extensions: ['srt'] }]
  });
  if (!canceled && filePath) {
    try { fs.writeFileSync(filePath, text); return true; } catch (e) { return false; }
  }
  return false;
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

// Desktop notification on track change
ipcMain.on('show-notification', (event, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      const n = new Notification({ title, body, silent: true });
      n.show();
    }
  } catch (e) { console.error('Notification failed', e); }
});

// Mini / compact mode
ipcMain.on('set-mini', (event, on) => {
  if (!mainWin) return;
  if (on) {
    if (!mainWin.isFullScreen()) miniPreviousBounds = mainWin.getBounds();
    mainWin.setFullScreen(false);
    mainWin.setBounds({ width: 420, height: 320, x: miniPreviousBounds ? miniPreviousBounds.x : 100, y: miniPreviousBounds ? miniPreviousBounds.y : 100 });
  } else {
    const b = miniPreviousBounds || loadBounds() || { width: 1000, height: 700 };
    mainWin.setBounds({ width: b.width || 1000, height: b.height || 700 });
  }
});

// Open URL request from renderer
ipcMain.on('request-url', (event) => {
  if (mainWin) mainWin.webContents.send('request-url');
});
ipcMain.on('request-home', () => { if (mainWin) mainWin.webContents.send('request-home'); });
ipcMain.on('request-palette', () => { if (mainWin) mainWin.webContents.send('request-palette'); });
ipcMain.on('open-default-apps', () => { try { shell.openExternal('ms-settings:defaultapps'); } catch (e) { console.error(e); } });

// Watch folder
function pickWatchFolder(win) {
  dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select Folder to Watch' })
    .then(({ canceled, filePaths }) => {
      if (canceled || !filePaths.length) return;
      startWatchFolder(filePaths[0]);
    });
}
function startWatchFolder(dir) {
  try {
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const lower = filename.toLowerCase();
      const isMedia = mediaFilters[0].extensions.some(ext => lower.endsWith('.' + ext));
      if (!isMedia) return;
      const full = path.join(dir, filename);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        if (mainWin) mainWin.webContents.send('watch-folder-file', full);
      }
    });
    watchWatchers.push(watcher);
  } catch (e) { console.error('Watch folder failed', e); }
}

// Apply any pending CLI / open-file paths once the window is ready
setTimeout(() => {
  if (mainWin && pendingFiles.length) {
    pendingFiles.forEach(f => mainWin.webContents.send('open-external', f));
    pendingFiles.length = 0;
  }
}, 600);
