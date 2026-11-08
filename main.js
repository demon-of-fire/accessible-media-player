const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, Notification, shell, protocol, session, screen, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { Readable } = require('stream');

// The portable build keeps all its data beside the exe, so it can live on a USB stick.
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
if (isPortable) app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Accessible Media Player Data'));

// Local media is served through this scheme so the page can stay fully sandboxed
// with web security on. Registering it has to happen before the app is ready.
protocol.registerSchemesAsPrivileged([{
  scheme: 'amp-media',
  privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true }
}]);

const MEDIA_TYPES = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm',
  ogv: 'video/ogg', '3gp': 'video/3gpp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus',
  weba: 'audio/webm', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4'
};
const PLAYLIST_EXTS = ['.amp', '.m3u', '.m3u8'];
const extensionOf = (p) => path.extname(p).toLowerCase();
// Formats the player engine cannot decode; FFmpeg converts these before playback.
const CONVERT_ONLY = new Set(['avi', 'wmv', 'wma', 'flv', 'mpg', 'mpeg', 'vob', 'ts', 'm2ts', 'asf', 'rm', 'rmvb', 'ape', 'aiff', 'aif', 'ac3', 'dts', 'amr']);
const AUDIO_ONLY_CONVERT = new Set(['wma', 'ape', 'aiff', 'aif', 'ac3', 'dts', 'amr']);
const isDirectlyPlayable = (p) => !!MEDIA_TYPES[extensionOf(p).slice(1)];
const isMediaPath = (p) => typeof p === 'string' && path.isAbsolute(p) && (isDirectlyPlayable(p) || CONVERT_ONLY.has(extensionOf(p).slice(1)));

// Requests are only honoured from the app's own page in its own window.
function isTrustedSender(event) {
  const url = event.senderFrame && event.senderFrame.url;
  return !!mainWin && event.sender === mainWin.webContents && typeof url === 'string' && url.startsWith('file:');
}
function secureHandle(channel, handler) {
  ipcMain['handle'](channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender');
    return handler(event, ...args);
  });
}
function secureOn(channel, handler) {
  ipcMain['on'](channel, (event, ...args) => {
    if (!isTrustedSender(event)) { event.returnValue = null; return; }
    handler(event, ...args);
  });
}
const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Lets the player switch between audio tracks in multi-language or audio-described files
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

// Single instance: must be claimed before anything else happens.
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) app.quit();

// One-time copy of settings saved under the app's former folder names, so the
// rename does not lose bookmarks, history and preferences. Originals are kept.
function migrateLegacyUserData() {
  try {
    const appData = app.getPath('appData');
    const target = app.getPath('userData');
    if (fs.existsSync(path.join(target, 'Local Storage'))) return;
    for (const name of ['accessible-media-player', 'Goon Player', 'goon-player']) {
      const legacy = path.join(appData, name);
      if (legacy === target) continue;
      const legacyStore = path.join(legacy, 'Local Storage');
      if (!fs.existsSync(legacyStore)) continue;
      fs.mkdirSync(target, { recursive: true });
      fs.cpSync(legacyStore, path.join(target, 'Local Storage'), { recursive: true });
      const legacyBounds = path.join(legacy, 'window-bounds.json');
      if (fs.existsSync(legacyBounds)) fs.copyFileSync(legacyBounds, path.join(target, 'window-bounds.json'));
      return;
    }
  } catch (e) { console.error('Settings migration failed', e); }
}
if (gotInstanceLock) migrateLegacyUserData();

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


function boundsAreOnScreen(b) {
  return screen.getAllDisplays().some(({ workArea: d }) =>
    b.x < d.x + d.width - 50 && b.x + b.width > d.x + 50 && b.y >= d.y - 20 && b.y < d.y + d.height - 50);
}

function createWindow() {
  const saved = loadBounds();
  const placeSaved = saved && typeof saved.x === 'number' && boundsAreOnScreen(saved); // a monitor may have been unplugged
  const win = new BrowserWindow({
    width: saved ? saved.width : 1000,
    height: saved ? saved.height : 700,
    x: placeSaved ? saved.x : undefined,
    y: placeSaved ? saved.y : undefined,
    minWidth: 380,
    minHeight: 280,
    title: "Accessible Media Player",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false // a media player has to keep working behind other windows
    }
  });
  mainWin = win;

  win.loadFile('index.html').catch(e => console.error('Failed to load index.html:', e));
  if (!saved || saved.fullscreen !== false) win.setFullScreen(true); // Fullscreen unless last closed windowed
  win.on('close', () => {
    saveBounds({ ...(loadBounds() || win.getNormalBounds()), fullscreen: win.isFullScreen() });
  });

  // Dragging fires these constantly, so only write once the window settles
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
      saveBounds({ ...win.getBounds(), fullscreen: false });
    }, 400);
  };
  win.on('resize', rememberBounds);
  win.on('move', rememberBounds);

  const sendFullscreenState = (isFs) => { if (!win.isDestroyed()) win.webContents.send('fullscreen-state', isFs); };
  // isFullScreen() can still report the old state while these events fire
  win.on('enter-full-screen', () => sendFullscreenState(true));
  win.on('leave-full-screen', () => sendFullscreenState(false));

  win.webContents.on('did-finish-load', () => {
    sendFullscreenState(win.isFullScreen());
    // Files passed on the command line / by double-click on first launch
    pendingFiles.splice(0).forEach(sendOpenRequest);
  });

  // The renderer has Node access, so it must never navigate away from the app.
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.on('closed', () => { if (mainWin === win) mainWin = null; });

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
        { label: 'Open URL…', accelerator: 'CmdOrCtrl+U', click: () => win.webContents.send('request-url') },

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
        { label: 'Next Track', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('media-key', 'next') },
        { label: 'Previous Track', accelerator: 'CmdOrCtrl+Shift+N', click: () => win.webContents.send('media-key', 'prev') },
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
        { label: 'Toggle Playlist Sidebar', accelerator: 'CmdOrCtrl+Q', click: () => win.webContents.send('menu-action', 'toggle-playlist-sidebar') },
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'F1', click: () => win.webContents.send('request-help') },
        { label: 'Check for Updates…', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { label: 'About Accessible Media Player', click: () => dialog.showMessageBox(win, { type: 'info', title: 'About', message: 'Accessible Media Player', detail: `Version ${app.getVersion()}` }) }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);


  // Close window quits the app entirely
}

// Handle files passed as CLI arguments
const pendingFiles = [];

const isOpenable = (p) => {
  try { return (isMediaPath(p) || PLAYLIST_EXTS.includes(extensionOf(p))) && fs.statSync(p).isFile(); }
  catch (e) { return false; }
};
function sendOpenRequest(filePath) {
  if (!mainWin) return;
  if (!PLAYLIST_EXTS.includes(extensionOf(filePath))) { mainWin.webContents.send('open-external', filePath); return; }
  try { parsePlaylistFile(filePath).forEach(p => mainWin.webContents.send('open-external', p)); }
  catch (e) { console.error('Could not open playlist', e); }
}
function handleCliArgs() {
  process.argv.slice(1).filter(isOpenable).forEach(a => pendingFiles.push(a));
}

handleCliArgs();

app.whenReady().then(() => {
  if (!gotInstanceLock) return;

  protocol.handle('amp-media', serveLocalMedia);

  // Sites rarely send CORS headers, and without them Web Audio plays streams as silence.
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, respond) => {
    if (details.resourceType !== 'media') { respond({}); return; }
    const responseHeaders = {};
    for (const key of Object.keys(details.responseHeaders || {})) {
      if (key.toLowerCase() !== 'access-control-allow-origin') responseHeaders[key] = details.responseHeaders[key];
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    respond({ responseHeaders });
  });

  // Some servers reject the "Origin: null" of a local app; the header above makes it unnecessary.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, respond) => {
    if (details.resourceType === 'media') {
      for (const key of Object.keys(details.requestHeaders)) if (key.toLowerCase() === 'origin') delete details.requestHeaders[key];
    }
    respond({ requestHeaders: details.requestHeaders });
  });

  // Only what a media player actually uses; everything else (camera prompts, geolocation...) is refused.
  const ALLOWED_PERMISSIONS = new Set(['media', 'speaker-selection', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED_PERMISSIONS.has(permission));

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
    if (mainWin) sendOpenRequest(filePath);
    else pendingFiles.push(filePath);
  });

  app.on('second-instance', (event, argv) => {
    argv.slice(1).filter(isOpenable).forEach(sendOpenRequest);
    if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(err => { console.error('App init failed:', err); app.quit(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

// Serves a local media file with byte ranges, which seeking depends on.
async function serveLocalMedia(request) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' };
  let filePath = null;
  try { filePath = new URL(request.url).searchParams.get('path'); } catch (e) {}
  if (!isMediaPath(filePath) || !isDirectlyPlayable(filePath)) return new Response('Forbidden', { status: 403, headers });
  let stat;
  try { stat = await fs.promises.stat(filePath); } catch (e) { return new Response('Not found', { status: 404, headers }); }
  if (!stat.isFile()) return new Response('Not found', { status: 404, headers });

  headers['Content-Type'] = MEDIA_TYPES[extensionOf(filePath).slice(1)];
  const size = stat.size;
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  let start = 0, end = size - 1, status = 200;
  if (match && (match[1] || match[2])) {
    if (match[1]) { start = parseInt(match[1], 10); if (match[2]) end = Math.min(parseInt(match[2], 10), size - 1); }
    else start = Math.max(0, size - parseInt(match[2], 10));
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  if (request.method === 'HEAD' || size === 0) return new Response(null, { status, headers });
  return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), { status, headers });
}

const mediaFilters = [
  { name: 'All Media Files', extensions: [...Object.keys(MEDIA_TYPES), ...CONVERT_ONLY] },
  { name: 'Video Files', extensions: ['mp4', 'm4v', 'mkv', 'mov', 'webm', 'ogv', '3gp', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'vob', 'ts', 'm2ts', 'asf', 'rm', 'rmvb'] },
  { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'weba', 'flac', 'aac', 'm4a', 'wma', 'ape', 'aiff', 'aif', 'ac3', 'dts', 'amr'] },
  { name: 'All Files', extensions: ['*'] }
];

secureHandle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: "Select Media Files",
    filters: mediaFilters
  });
  return canceled ? null : filePaths;
});

// Playlist Saving (custom .amp JSON format)
secureHandle('save-playlist', async (event, playlistArray) => {
  if (!Array.isArray(playlistArray)) return false;
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

// Reads a playlist file into a clean array of paths/URLs.
function parsePlaylistFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '');
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.m3u') || lower.endsWith('.m3u8')) {
    const dir = path.dirname(filePath);
    return raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => (/^[a-z][a-z0-9+.-]+:\/\//i.test(l) || path.isAbsolute(l)) ? l : path.resolve(dir, l));
  }
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : (data && data.files);
  return Array.isArray(list) ? list.filter(p => typeof p === 'string' && p) : [];
}

secureHandle('read-playlist-file', async (event, filePath) => {
  if (typeof filePath !== 'string' || !PLAYLIST_EXTS.includes(extensionOf(filePath))) return null;
  try { return parsePlaylistFile(filePath); }
  catch (e) { console.error('Failed to read playlist:', e); return null; }
});

// Playlist Loading (supports .amp JSON and .m3u)
secureHandle('open-playlist', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Playlist',
    properties: ['openFile'],
    filters: [
      { name: 'All Playlists', extensions: ['amp', 'm3u', 'm3u8'] },
      { name: 'AMP Playlist', extensions: ['amp'] },
      { name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] }
    ]
  });
  if (!canceled && filePaths.length > 0) {
    try {
      return parsePlaylistFile(filePaths[0]);
    } catch (e) {
      console.error('Failed to load playlist:', e);
      return null;
    }
  }
  return null;
});

// M3U Export
secureHandle('save-m3u', async (event, playlistArray) => {
  if (!Array.isArray(playlistArray)) return false;
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
function scanFolderForMedia(folder) {
  const results = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (err) { return; } // one protected subfolder must not abort the whole scan
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (isMediaPath(fp)) results.push(fp);
    }
  };
  walk(folder);
  return results.sort(naturalCompare);
}

secureHandle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Add Folder to Playlist',
    properties: ['openDirectory']
  });
  if (canceled || !filePaths.length) return null;
  return scanFolderForMedia(filePaths[0]);
});

// Dragged items can be folders; they come back as the media files inside them
secureHandle('expand-dropped', async (event, paths) => {
  const out = [];
  for (const p of Array.isArray(paths) ? paths : []) {
    try {
      if (typeof p === 'string' && fs.statSync(p).isDirectory()) out.push(...scanFolderForMedia(p));
      else out.push(p);
    } catch (e) {}
  }
  return out;
});

// Subtitles / lyrics saved beside a media file. Limited to those types and sizes.
const SIDECAR_LIMIT = 5 * 1024 * 1024;
function readSidecar(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size <= SIDECAR_LIMIT ? fs.readFileSync(filePath) : null;
  } catch (e) { return null; }
}
secureHandle('read-sidecars', async (event, mediaPath) => {
  if (!isMediaPath(mediaPath)) return null;
  const base = mediaPath.slice(0, -extensionOf(mediaPath).length);
  let subtitle = null;
  for (const ext of ['.srt', '.vtt']) {
    const data = readSidecar(base + ext);
    if (data) { subtitle = { name: path.basename(base + ext), data }; break; }
  }
  return { subtitle, lyrics: readSidecar(base + '.lrc') };
});

secureHandle('file-mtimes', async (event, paths) => {
  const times = {};
  for (const p of Array.isArray(paths) ? paths : []) {
    if (!isMediaPath(p)) continue;
    try { times[p] = fs.statSync(p).mtimeMs; } catch (e) {}
  }
  return times;
});

secureOn('file-exists', (event, filePath) => {
  try { event.returnValue = isMediaPath(filePath) && fs.statSync(filePath).isFile(); }
  catch (e) { event.returnValue = false; }
});

// Window-level fullscreen (the app launches this way, so HTML fullscreen could never exit it)
secureOn('toggle-fullscreen', () => {
  if (mainWin) mainWin.setFullScreen(!mainWin.isFullScreen());
});

// Show a playlist item in the file manager
secureOn('reveal-file', (event, filePath) => {
  if (isMediaPath(filePath) && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

// Always-on-top
secureOn('set-always-on-top', (event, on) => {
  if (mainWin) mainWin.setAlwaysOnTop(!!on);
});

// Launch on system startup
secureOn('set-startup', (event, on) => {
  try { app.setLoginItemSettings({ openAtLogin: !!on }); } catch (e) { console.error('setLoginItemSettings failed', e); }
});

// Subtitle export
secureHandle('save-subs', async (event, request) => {
  const { name, text } = request || {};
  if (typeof text !== 'string') return false;
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
secureHandle('save-screenshot', async (event, dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return false;
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Screenshot',
    defaultPath: `Screenshot_${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (!canceled && filePath) {
    try {
      fs.writeFileSync(filePath, base64Data, 'base64');
      return true;
    } catch (e) {
      console.error('Failed to save screenshot:', e);
    }
  }
  return false;
});

// Desktop notification on track change
secureOn('show-notification', (event, message) => {
  try {
    const { title, body } = message || {};
    if (Notification.isSupported()) {
      const n = new Notification({ title, body, silent: true });
      n.show();
    }
  } catch (e) { console.error('Notification failed', e); }
});

secureOn('open-default-apps', () => { try { shell.openExternal('ms-settings:defaultapps'); } catch (e) { console.error(e); } });

/* ------------------------------------------------- HELPER TOOLS -- */
// yt-dlp and FFmpeg are fetched only when first needed, only after the user agrees,
// and only used if they match the checksums their publishers release.
const TOOLS = {
  ytdlp: {
    label: 'yt-dlp', size: 'about 20 MB', purpose: 'play links from sites such as YouTube', file: 'yt-dlp.exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    sums: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS', sumName: 'yt-dlp.exe'
  },
  ffmpeg: {
    label: 'FFmpeg', size: 'about 200 MB', purpose: 'convert formats such as AVI, WMV and WMA', file: 'ffmpeg.exe', zipped: true,
    url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    sums: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/checksums.sha256', sumName: 'ffmpeg-master-latest-win64-gpl.zip'
  }
};
const toolsDir = () => path.join(app.getPath('userData'), 'tools');
const toolJobs = {};
const sendProgress = (label, percent) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('tool-progress', { label, percent }); };

async function downloadToFile(url, dest, label) {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const hash = crypto.createHash('sha256');
  const out = fs.openSync(dest, 'w');
  try {
    const reader = res.body.getReader();
    let received = 0, lastPercent = -1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      fs.writeSync(out, value);
      hash.update(value);
      received += value.length;
      const percent = total ? Math.floor((received / total) * 100) : -1;
      if (percent !== lastPercent) { lastPercent = percent; if (percent >= 0) sendProgress(label, percent); }
    }
  } finally { fs.closeSync(out); }
  return hash.digest('hex');
}
function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const hit = findFile(p, name); if (hit) return hit; }
    else if (e.name.toLowerCase() === name) return p;
  }
  return null;
}
async function installTool(tool) {
  const { response } = await dialog.showMessageBox(mainWin, {
    type: 'question', buttons: ['Download', 'Cancel'], defaultId: 0, cancelId: 1,
    title: `Download ${tool.label}?`, message: `To ${tool.purpose}, the player needs ${tool.label} (${tool.size}).`,
    detail: 'It is a free tool from its official GitHub release. It is checked against the publisher\'s checksum before use and is only downloaded once.'
  });
  if (response !== 0) return null;
  fs.mkdirSync(toolsDir(), { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'amp-tool-'));
  try {
    const sumsRes = await net.fetch(tool.sums);
    if (!sumsRes.ok) throw new Error('Could not get the checksum');
    const line = (await sumsRes.text()).split(/\r?\n/).map(l => l.trim().split(/\s+\*?/)).find(([, name]) => name === tool.sumName);
    if (!line || !/^[a-f0-9]{64}$/i.test(line[0])) throw new Error('Checksum not published');
    const downloaded = path.join(work, tool.zipped ? 'tool.zip' : tool.file);
    const actual = await downloadToFile(tool.url, downloaded, `Downloading ${tool.label}`);
    if (actual.toLowerCase() !== line[0].toLowerCase()) throw new Error('Checksum did not match, so the download was discarded');
    let ready = downloaded;
    if (tool.zipped) {
      const unpacked = path.join(work, 'unpacked');
      fs.mkdirSync(unpacked);
      await new Promise((resolve, reject) => execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', downloaded, '-C', unpacked], { windowsHide: true }, (err) => err ? reject(err) : resolve()));
      ready = findFile(unpacked, tool.file);
      if (!ready) throw new Error('The download did not contain the expected program');
    }
    fs.copyFileSync(ready, path.join(toolsDir(), tool.file));
    return path.join(toolsDir(), tool.file);
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
// Resolves to the tool's path, or null if it is missing and the user said no.
function ensureTool(key, onlyIfInstalled) {
  const tool = TOOLS[key], target = path.join(toolsDir(), tool.file);
  if (fs.existsSync(target)) return Promise.resolve(target);
  if (onlyIfInstalled) return Promise.resolve(null);
  if (!toolJobs[key]) toolJobs[key] = installTool(tool).finally(() => { delete toolJobs[key]; });
  return toolJobs[key];
}

// Turns a page link (YouTube and similar) into a direct stream the player can use.
secureHandle('resolve-web-media', async (event, url, options) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { error: 'That is not a web link' };
  let tool;
  try { tool = await ensureTool('ytdlp', !!(options && options.onlyIfInstalled)); }
  catch (e) { return { error: e.message }; }
  if (!tool) return { declined: true };
  return new Promise((resolve) => {
    // "--" stops a crafted link from being read as a command-line option
    execFile(tool, ['-j', '--no-playlist', '--no-warnings', '-f', 'b[protocol^=http]/b', '--', url], { timeout: 90000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) return resolve({ error: 'The site would not give up a playable stream' });
      try {
        const info = JSON.parse(stdout);
        if (typeof info.url !== 'string' || !/^https?:\/\//i.test(info.url)) return resolve({ error: 'No playable stream was found' });
        resolve({ url: info.url, title: typeof info.title === 'string' ? info.title : null });
      } catch (e) { resolve({ error: 'The site returned something unreadable' }); }
    });
  });
});

// Converted copies are cached, so a file is only ever converted once.
const CONVERT_CACHE_LIMIT = 5 * 1024 * 1024 * 1024;
const convertedDir = () => path.join(app.getPath('userData'), 'converted');
let activeConversion = null;
function pruneConvertedCache() {
  try {
    const items = fs.readdirSync(convertedDir()).map(name => { const p = path.join(convertedDir(), name), s = fs.statSync(p); return { p, size: s.size, used: s.mtimeMs }; }).sort((a, b) => a.used - b.used);
    let total = items.reduce((sum, i) => sum + i.size, 0);
    for (const item of items) { if (total <= CONVERT_CACHE_LIMIT) break; fs.rmSync(item.p, { force: true }); total -= item.size; }
  } catch (e) {}
}
secureHandle('convert-media', async (event, filePath) => {
  if (!isMediaPath(filePath)) return { error: 'That file cannot be converted' };
  let stat;
  try { stat = fs.statSync(filePath); } catch (e) { return { error: 'The file is missing' }; }
  let tool;
  try { tool = await ensureTool('ffmpeg'); } catch (e) { return { error: e.message }; }
  if (!tool) return { declined: true };

  const audioOnly = AUDIO_ONLY_CONVERT.has(extensionOf(filePath).slice(1));
  const id = crypto.createHash('sha1').update(`${filePath}|${stat.mtimeMs}|${stat.size}`).digest('hex');
  fs.mkdirSync(convertedDir(), { recursive: true });
  const output = path.join(convertedDir(), id + (audioOnly ? '.m4a' : '.mp4'));
  if (fs.existsSync(output)) { const now = new Date(); fs.utimesSync(output, now, now); return { path: output }; }

  if (activeConversion) { activeConversion.cancelled = true; activeConversion.child.kill(); }
  const partial = output + '.part';
  const encode = audioOnly ? ['-vn', '-c:a', 'aac', '-b:a', '192k']
    : ['-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
  return new Promise((resolve) => {
    const child = spawn(tool, ['-y', '-hide_banner', '-i', filePath, ...encode, '-f', 'mp4', partial], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const job = activeConversion = { child, cancelled: false };
    const seconds = (h, m, s) => parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
    let duration = 0, lastPercent = -1;
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const d = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(text);
      if (d) duration = seconds(d[1], d[2], d[3]);
      const t = /time=(\d+):(\d+):([\d.]+)/.exec(text);
      if (t && duration) {
        const percent = Math.min(99, Math.floor(seconds(t[1], t[2], t[3]) / duration * 100));
        if (percent !== lastPercent) { lastPercent = percent; sendProgress('Converting', percent); }
      }
    });
    const finish = (result) => { if (activeConversion === job) activeConversion = null; resolve(result); };
    child.on('error', () => finish({ error: 'FFmpeg could not start' }));
    child.on('close', (code) => {
      if (job.cancelled) { fs.rmSync(partial, { force: true }); return finish({ cancelled: true }); }
      if (code !== 0) { fs.rmSync(partial, { force: true }); return finish({ error: 'FFmpeg could not read this file' }); }
      fs.renameSync(partial, output);
      pruneConvertedCache();
      finish({ path: output });
    });
  });
});
secureOn('cancel-convert', () => {
  if (activeConversion) { activeConversion.cancelled = true; activeConversion.child.kill(); }
});

/* ------------------------------------------------- MATROSKA CHAPTERS -- */
const MKV = { SEGMENT: 0x18538067, SEEKHEAD: 0x114D9B74, SEEK: 0x4DBB, SEEKID: 0x53AB, SEEKPOS: 0x53AC, CHAPTERS: 0x1043A770, EDITION: 0x45B9, ATOM: 0xB6, START: 0x91, DISPLAY: 0x80, STRING: 0x85, CLUSTER: 0x1F43B675 };
function ebmlNumber(buffer, offset, keepMarker) {
  if (offset >= buffer.length) return null;
  const first = buffer[offset];
  let length = 1, mask = 0x80;
  while (length <= 8 && !(first & mask)) { mask >>= 1; length++; }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  let unknown = !keepMarker && (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i++) { value = value * 256 + buffer[offset + i]; if (buffer[offset + i] !== 255) unknown = false; }
  return { value, length, unknown };
}
function ebmlChildren(buffer, start, end, visit) {
  let offset = start;
  while (offset < end) {
    const id = ebmlNumber(buffer, offset, true);
    if (!id) return;
    const size = ebmlNumber(buffer, offset + id.length, false);
    if (!size) return;
    const dataStart = offset + id.length + size.length;
    const dataEnd = size.unknown ? end : dataStart + size.value;
    if (visit(id.value, dataStart, Math.min(dataEnd, end)) === false) return;
    offset = dataEnd;
  }
}
const ebmlUint = (b, s, e) => { let v = 0; for (let i = s; i < e; i++) v = v * 256 + b[i]; return v; };
function readMatroskaChapters(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const readAt = (position, length) => { const b = Buffer.alloc(length); return b.subarray(0, fs.readSync(fd, b, 0, length, position)); };
    const parse = (b, s, e) => {
      const chapters = [];
      let usedEdition = false;
      ebmlChildren(b, s, e, (id, ds, de) => {
        if (id !== MKV.EDITION || usedEdition) return;
        usedEdition = true;
        ebmlChildren(b, ds, de, (aid, as, ae) => {
          if (aid !== MKV.ATOM) return;
          let time = 0, title = '';
          ebmlChildren(b, as, ae, (fid, fs2, fe) => {
            if (fid === MKV.START) time = ebmlUint(b, fs2, fe) / 1e9;
            if (fid === MKV.DISPLAY && !title) ebmlChildren(b, fs2, fe, (sid, ss, se) => { if (sid === MKV.STRING) title = b.toString('utf8', ss, se); });
          });
          chapters.push({ time, title: title || `Chapter ${chapters.length + 1}` });
        });
      });
      return chapters.sort((x, y) => x.time - y.time);
    };
    const head = readAt(0, 1024 * 1024);
    let found = null, position = null, segmentStart = 0;
    ebmlChildren(head, 0, head.length, (id, ds, de) => {
      if (id !== MKV.SEGMENT) return;
      segmentStart = ds;
      ebmlChildren(head, ds, de, (cid, cs, ce) => {
        if (cid === MKV.CLUSTER) return false;
        if (cid === MKV.CHAPTERS) { found = parse(head, cs, ce); return false; }
        if (cid !== MKV.SEEKHEAD) return;
        ebmlChildren(head, cs, ce, (sid, ss, se) => {
          if (sid !== MKV.SEEK) return;
          let target = 0, where = 0;
          ebmlChildren(head, ss, se, (fid, fs2, fe) => {
            if (fid === MKV.SEEKID) target = ebmlUint(head, fs2, fe);
            if (fid === MKV.SEEKPOS) where = ebmlUint(head, fs2, fe);
          });
          if (target === MKV.CHAPTERS) position = where;
        });
      });
      return false;
    });
    if (found) return found;
    if (position === null) return [];
    const block = readAt(segmentStart + position, 4 * 1024 * 1024);
    let chapters = [];
    ebmlChildren(block, 0, block.length, (id, ds, de) => { if (id === MKV.CHAPTERS) chapters = parse(block, ds, de); return false; });
    return chapters;
  } finally { fs.closeSync(fd); }
}
secureHandle('read-chapters', async (event, filePath) => {
  if (!isMediaPath(filePath) || !['.mkv', '.webm', '.mka'].includes(extensionOf(filePath))) return [];
  try { return readMatroskaChapters(filePath); } catch (e) { return []; }
});

/* ------------------------------------------------- UPDATES -- */
// Nothing is installed without asking, and the installer must match the release's published hash.
const RELEASE_BASE = 'https://github.com/demon-of-fire/accessible-media-player/releases/latest/download/';
const RELEASE_PAGE = 'https://github.com/demon-of-fire/accessible-media-player/releases/latest';
function isNewerVersion(candidate, current) {
  const a = candidate.split('.').map(n => parseInt(n, 10) || 0), b = current.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return false;
}
let updateBusy = false;
async function checkForUpdates(manual) {
  if (updateBusy) return;
  updateBusy = true;
  const tell = (message, type = 'info') => dialog.showMessageBox(mainWin, { type, title: 'Updates', message });
  try {
    const res = await net.fetch(RELEASE_BASE + 'latest.yml');
    if (!res.ok) { if (manual) await tell('Could not find update information right now.'); return; }
    const yml = await res.text();
    const field = (name) => { const m = new RegExp(`^${name}:\\s*['"]?([^'"\\r\\n]+)`, 'm').exec(yml); return m ? m[1].trim() : null; };
    const version = field('version'), installer = field('path'), sha512 = field('sha512');
    if (!version || !installer || !sha512) { if (manual) await tell('The update information could not be read.'); return; }
    if (!isNewerVersion(version, app.getVersion())) { if (manual) await tell(`You have the latest version (${app.getVersion()}).`); return; }
    if (isPortable) {
      const { response } = await dialog.showMessageBox(mainWin, { type: 'info', buttons: ['Open Download Page', 'Later'], defaultId: 0, cancelId: 1, title: 'Update available', message: `Version ${version} is available.` });
      if (response === 0) shell.openExternal(RELEASE_PAGE);
      return;
    }
    const { response } = await dialog.showMessageBox(mainWin, { type: 'question', buttons: ['Download and Install', 'Later'], defaultId: 0, cancelId: 1, title: 'Update available', message: `Version ${version} is available. You have ${app.getVersion()}.`, detail: 'The player will close to install it.' });
    if (response !== 0) return;
    const download = await net.fetch(RELEASE_BASE + encodeURIComponent(path.basename(installer)));
    if (!download.ok) { await tell('The update could not be downloaded.', 'error'); return; }
    const bytes = Buffer.from(await download.arrayBuffer());
    if (crypto.createHash('sha512').update(bytes).digest('base64') !== sha512) { await tell('The download was damaged, so it was discarded.', 'error'); return; }
    const dest = path.join(app.getPath('temp'), path.basename(installer));
    fs.writeFileSync(dest, bytes);
    const failure = await shell.openPath(dest);
    if (failure) { await tell('The installer could not be started.', 'error'); return; }
    app.quit();
  } catch (e) {
    console.error('Update check failed', e);
    if (manual) await tell('Could not check for updates. Are you online?');
  } finally { updateBusy = false; }
}
secureOn('check-updates', (event, manual) => { checkForUpdates(manual === true); });

