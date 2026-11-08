// The only bridge between the sandboxed page and the rest of the system.
// The page cannot reach Node or Electron; it can only use the channels listed here.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const INVOKE = new Set(['open-file-dialog', 'open-directory-dialog', 'open-playlist', 'save-playlist', 'save-m3u', 'save-subs',
  'save-screenshot', 'read-playlist-file', 'read-sidecars', 'file-mtimes', 'expand-dropped',
  'resolve-web-media', 'convert-media', 'read-chapters']);
const SEND = new Set(['toggle-fullscreen', 'set-always-on-top', 'set-startup', 'show-notification', 'open-default-apps', 'reveal-file', 'cancel-convert', 'check-updates']);
const RECEIVE = new Set(['menu-action', 'media-key', 'open-external', 'tool-progress', 'request-home', 'request-url',
  'request-palette', 'request-help', 'fullscreen-state']);

const assertAllowed = (list, channel) => {
  if (!list.has(channel)) throw new Error(`Blocked channel: ${channel}`);
};

contextBridge.exposeInMainWorld('ampNative', {
  invoke: (channel, ...args) => { assertAllowed(INVOKE, channel); return ipcRenderer.invoke(channel, ...args); },
  send: (channel, ...args) => { assertAllowed(SEND, channel); ipcRenderer.send(channel, ...args); },
  on: (channel, listener) => { assertAllowed(RECEIVE, channel); ipcRenderer.on(channel, (_event, ...args) => listener(...args)); },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  fileExists: (filePath) => ipcRenderer.sendSync('file-exists', filePath) === true
});
