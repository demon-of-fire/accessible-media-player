// All system access goes through the small, checked bridge in preload.js
const ipcRenderer = {
  invoke: ampNative.invoke,
  send: ampNative.send,
  on: (channel, listener) => ampNative.on(channel, (...args) => listener(null, ...args))
};
const webUtils = { getPathForFile: ampNative.getPathForFile };

const mediaPlayer = document.getElementById('media-player');
const videoWrapper = document.getElementById('video-wrapper');
const topBar = document.getElementById('top-bar');
const controlsOverlay = document.getElementById('controls-overlay');
const liveRegion = document.getElementById('live-region');
const titleDisplay = document.getElementById('title-display');
const playlistSidebar = document.getElementById('playlist-sidebar');
const playlistItems = document.getElementById('playlist-items');
const dragOverlay = document.getElementById('drag-overlay');
const audioVisualizer = document.getElementById('audio-visualizer');

// Buttons & Inputs
const playBtn = document.getElementById('play-btn');
const rewindBtn = document.getElementById('rewind-btn');
const forwardBtn = document.getElementById('forward-btn');
const prevTrackBtn = document.getElementById('prev-track-btn');
const nextTrackBtn = document.getElementById('next-track-btn');
// Removed playlistToggleBtn, eqBtn
const openBtn = document.getElementById('open-btn');
const muteBtn = document.getElementById('mute-btn');
const speedBtn = document.getElementById('speed-btn');
const loopBtn = document.getElementById('loop-btn');
const pipBtn = document.getElementById('pip-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const playlistToggleBtn = document.getElementById('playlist-toggle-btn');
const closePlaylistBtn = document.getElementById('close-playlist-btn');
const clearPlaylistBtn = document.getElementById('clear-playlist-btn');
const savePlaylistBtn = document.getElementById('save-playlist-btn');
const loadPlaylistBtn = document.getElementById('load-playlist-btn');


const progressSlider = document.getElementById('progress-slider');
const volumeSlider = document.getElementById('volume-slider');
const timeDisplay = document.getElementById('time-display');

// Icons
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const volUpIcon = document.getElementById('vol-up-icon');
const volMuteIcon = document.getElementById('vol-mute-icon');
const fsEnterIcon = document.getElementById('fs-enter-icon');
const fsExitIcon = document.getElementById('fs-exit-icon');

// Settings Modal Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const eqResetBtn = document.getElementById('eq-reset-btn');
const boostSlider = document.getElementById('boost-slider');
const boostVal = document.getElementById('boost-val');
const eqBandsContainer = document.querySelector('.eq-bands');
const panSlider = document.getElementById('pan-slider');
const panVal = document.getElementById('pan-val');

const loadSubsBtn = document.getElementById('load-subs-btn');
const clearSubsBtn = document.getElementById('clear-subs-btn');

const highContrastToggle = document.getElementById('high-contrast-toggle');
const largeTextToggle = document.getElementById('large-text-toggle');
const verboseAnnounceToggle = document.getElementById('verbose-announce-toggle');
const autoplayToggle = document.getElementById('autoplay-toggle');
const shuffleToggle = document.getElementById('shuffle-toggle');

// New Bookmarks Sidebar Selectors
const bookmarksToggleBtn = document.getElementById('bookmarks-toggle-btn');
const closeBookmarksBtn = document.getElementById('close-bookmarks-btn');
const bookmarksSidebar = document.getElementById('bookmarks-sidebar');
const bookmarksSidebarList = document.getElementById('bookmarks-sidebar-list');
const sidebarAddBookmarkBtn = document.getElementById('sidebar-add-bookmark-btn');
const mainAddBookmarkBtn = document.getElementById('main-add-bookmark-btn');

// More Options Sidebar Selectors
const moreOptionsSidebar = document.getElementById('more-options-sidebar');
const moreOptionsToggleBtn = document.getElementById('more-options-toggle-btn');
const closeMoreOptionsBtn = document.getElementById('close-more-options-btn');

// Custom Subtitle & Video Adjusters & Audio Echo Node Selectors
const subSizeSelect = document.getElementById('sub-size-select');
const subColorSelect = document.getElementById('sub-color-select');
const subBgSelect = document.getElementById('sub-bg-select');


// A-B Looping Selectors
const setPointABtn = document.getElementById('set-point-a-btn');
const setPointBBtn = document.getElementById('set-point-b-btn');
const clearAbLoopBtn = document.getElementById('clear-ab-loop-btn');
const abStartLabel = document.getElementById('ab-start-label');
const abEndLabel = document.getElementById('ab-end-label');

// Sleep Timer Selectors
const sleepTimerSelect = document.getElementById('sleep-timer-select');
const sleepCountdown = document.getElementById('sleep-countdown');

// Subtitle Delay Selectors
const subDelayVal = document.getElementById('sub-delay-val');
const subDelayMinus = document.getElementById('sub-delay-minus');
const subDelayReset = document.getElementById('sub-delay-reset');
const subDelayPlus = document.getElementById('sub-delay-plus');

// Capture Frame Selector
const screenshotBtn = document.getElementById('screenshot-btn');

// Go to Time Selector & Dialog
const gotoTimeBtn = document.getElementById('goto-time-btn');
const gotoModal = document.getElementById('goto-modal');
const closeGotoBtn = document.getElementById('close-goto-btn');
const submitGotoBtn = document.getElementById('submit-goto-btn');
const gotoTimeInput = document.getElementById('goto-time-input');

// Super Control Center Selectors
const speedLabelVal = document.getElementById('speed-label-val');
const speedMinusBtn = document.getElementById('speed-minus-btn');
const speedResetBtn = document.getElementById('speed-reset-btn');
const speedPlusBtn = document.getElementById('speed-plus-btn');
const speedSelectPreset = document.getElementById('speed-select-preset');


const eqPresetSelect = document.getElementById('eq-preset-select');

let pannerNode = null;
let currentSubtitleTrack = null;

// State
let isSeeking = false;
let isLooping = false;
let repeatMode = 'off'; // 'off' | 'one' | 'all'
let abStart = null;
let abEnd = null;
let sleepTimer = null;
let sleepInterval = null;
let subtitleOffset = 0;
let idleTimeout;
let playlist = [];
let currentPlaylistIndex = -1;
let currentSpeedIndex = 1; // 1x
const speeds = [0.5, 1, 1.25, 1.5, 2];
const audioExts = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.weba', '.flac', '.aac', '.m4a', '.wma', '.ape', '.aiff', '.aif', '.ac3', '.dts', '.amr'];
const preparedSources = new Map(); // page links and converted files -> what actually gets played
let currentFilePath = null;
let suppressPlayAnnounce = false; // the "Now playing" message must not be cut off by "Playing"
let isWindowFullscreen = false;
let fullscreenStateKnown = false;
let sleepFading = false;
let pendingPlaylistFocus = null;
let stopAfterCurrentTrack = false;
let showRemainingTime = false;
let loadToken = 0; // identifies the newest load, so late results from older ones are ignored
const shuffleHistory = []; // so Previous retraces shuffled tracks

// --- PERSISTENCE HELPERS (localStorage) ---
function saveState(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}
function loadState(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch(e) { return fallback; }
}
function saveResumeState() {
  if (currentFilePath && mediaPlayer.currentTime > 0) {
    // Resuming at the very end would instantly skip to the next track
    const nearEnd = mediaPlayer.ended || (isFinite(mediaPlayer.duration) && mediaPlayer.duration - mediaPlayer.currentTime < 5);
    saveState('resume', { file: currentFilePath, time: nearEnd ? 0 : mediaPlayer.currentTime, savedAt: Date.now() });
  }
}

// --- Web Audio API (EQ & Volume Boost) ---
let audioCtx = null;
let sourceNode = null;
let gainNode = null;
const eqFilters = [];
const eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

let normalizationNode = null;
let fadeNode = null; // track-transition fades; independent of the user's volume
let effectInput = null, effectOutput = null; // surround / 8D effects are built between these
let duckNode = null; // briefly lowers the media under spoken announcements
let speechHighpass = null, speechPresence = null, speechClarity = null;
let silenceAnalyser = null;

function initAudio() {
  if (audioCtx && sourceNode) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!sourceNode) {
    try {
      sourceNode = audioCtx.createMediaElementSource(mediaPlayer);
    } catch (e) {
      try {
        const stream = mediaPlayer.captureStream();
        sourceNode = audioCtx.createMediaStreamSource(stream);
      } catch (e2) { console.error('Audio init failed:', e2); return; }
    }
  }
  gainNode = audioCtx.createGain();
  pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  
  let prevNode = sourceNode;
  
  eqFrequencies.forEach(freq => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.0;
    // Pick up anything the user set before audio started
    const bandSlider = document.querySelectorAll('.eq-slider')[eqFilters.length];
    filter.gain.value = bandSlider ? parseFloat(bandSlider.value) : 0;
    eqFilters.push(filter);
    
    prevNode.connect(filter);
    prevNode = filter;
  });
  
  if (pannerNode) {
    prevNode.connect(pannerNode);
    prevNode = pannerNode;
  }
  
  silenceAnalyser = audioCtx.createAnalyser();
  silenceAnalyser.fftSize = 2048;
  prevNode.connect(silenceAnalyser);

  effectInput = audioCtx.createGain();
  effectInput.channelCount = 2;
  effectInput.channelCountMode = 'explicit';
  effectOutput = audioCtx.createGain();
  prevNode.connect(effectInput);
  effectInput.connect(effectOutput);
  prevNode = effectOutput;

  // Speech boost: transparent until switched on
  speechHighpass = audioCtx.createBiquadFilter();
  speechHighpass.type = 'highpass';
  speechHighpass.frequency.value = 20;
  speechPresence = audioCtx.createBiquadFilter();
  speechPresence.type = 'peaking';
  speechPresence.frequency.value = 1000;
  speechPresence.Q.value = 0.8;
  speechClarity = audioCtx.createBiquadFilter();
  speechClarity.type = 'peaking';
  speechClarity.frequency.value = 2500;
  speechClarity.Q.value = 1;
  prevNode.connect(speechHighpass);
  speechHighpass.connect(speechPresence);
  speechPresence.connect(speechClarity);
  prevNode = speechClarity;

  // Loudness normalization (compressor) — transparent until enabled
  normalizationNode = audioCtx.createDynamicsCompressor();
  normalizationNode.threshold.value = 0;
  normalizationNode.knee.value = 30;
  normalizationNode.ratio.value = 1;
  normalizationNode.attack.value = 0.003;
  normalizationNode.release.value = 0.25;
  prevNode.connect(normalizationNode);
  normalizationNode.connect(gainNode);
  fadeNode = audioCtx.createGain();
  duckNode = audioCtx.createGain();
  gainNode.connect(fadeNode);
  fadeNode.connect(duckNode);
  duckNode.connect(audioCtx.destination);

  gainNode.gain.value = parseFloat(boostSlider.value);
  if (pannerNode) pannerNode.pan.value = parseFloat(panSlider.value);
}

function rampFade(target, seconds) {
  if (!fadeNode || !audioCtx) return;
  const g = fadeNode.gain, now = audioCtx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(target, now + seconds);
}

// Toggle loudness normalization on/off
function setNormalization(on) {
  if (!normalizationNode) return;
  if (on) {
    normalizationNode.threshold.value = -24;
    normalizationNode.knee.value = 20;
    normalizationNode.ratio.value = 4;
    normalizationNode.attack.value = 0.005;
    normalizationNode.release.value = 0.2;
  } else {
    normalizationNode.threshold.value = 0;
    normalizationNode.knee.value = 30;
    normalizationNode.ratio.value = 1;
  }
  announce('Audio normalization ' + (on ? 'enabled' : 'disabled'));
}

// Generate EQ UI
eqFrequencies.forEach((freq, index) => {
  const div = document.createElement('div');
  div.className = 'eq-band';
  
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'eq-slider';
  slider.min = -12;
  slider.max = 12;
  slider.value = 0;
  slider.setAttribute('aria-label', `${freq} Hz Equalizer`);
  slider.setAttribute('aria-orientation', 'vertical');
  
  slider.addEventListener('input', (e) => {
    if (eqFilters[index]) eqFilters[index].gain.value = e.target.value;
    slider.setAttribute('aria-valuetext', `${e.target.value} decibels`);
  });
  
  slider.addEventListener('keydown', (e) => {
    // Arrow keys for vertical slider
    if (e.key === 'ArrowUp') { e.preventDefault(); slider.value = Math.min(12, parseFloat(slider.value) + 1); slider.dispatchEvent(new Event('input')); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); slider.value = Math.max(-12, parseFloat(slider.value) - 1); slider.dispatchEvent(new Event('input')); }
    else if (e.key === 'PageUp') { e.preventDefault(); slider.value = Math.min(12, parseFloat(slider.value) + 3); slider.dispatchEvent(new Event('input')); }
    else if (e.key === 'PageDown') { e.preventDefault(); slider.value = Math.max(-12, parseFloat(slider.value) - 3); slider.dispatchEvent(new Event('input')); }
    else if (e.key === 'Home') { e.preventDefault(); slider.value = 12; slider.dispatchEvent(new Event('input')); }
    else if (e.key === 'End') { e.preventDefault(); slider.value = -12; slider.dispatchEvent(new Event('input')); }
  });
  
  const label = document.createElement('span');
  label.className = 'eq-label';
  label.textContent = freq >= 1000 ? `${freq/1000}k` : freq;
  
  div.appendChild(slider);
  div.appendChild(label);
  eqBandsContainer.appendChild(div);
});

boostSlider.addEventListener('input', (e) => {
  const pct = Math.round(e.target.value * 100);
  if (gainNode) gainNode.gain.value = e.target.value;
  boostVal.textContent = pct;
  boostSlider.setAttribute('aria-valuenow', pct);
  boostSlider.setAttribute('aria-valuetext', `${pct} percent`);
});

panSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (pannerNode) pannerNode.pan.value = val;
  const text = val === 0 ? 'Center' : (val < 0 ? `Left ${Math.round(-val*100)} percent` : `Right ${Math.round(val*100)} percent`);
  panVal.textContent = val === 0 ? 'Center' : (val < 0 ? `Left ${Math.round(-val*100)}%` : `Right ${Math.round(val*100)}%`);
  panSlider.setAttribute('aria-valuenow', Math.round((val + 1) * 50)); // Map -1..1 to 0..100
  panSlider.setAttribute('aria-valuetext', text);
});

let previousFocus = null;

function toggleSettingsModal() {
  if (settingsModal.style.display === 'none' || settingsModal.style.display === '') {
    previousFocus = document.activeElement;
    settingsModal.style.display = 'flex';
    settingsModal.setAttribute('aria-hidden', 'false');

    announce('Settings opened');
    
    // Set focus to the first interactive element
    const firstTab = settingsModal.querySelector('.tab-btn');
    if (firstTab) firstTab.focus();
    else closeSettingsBtn.focus();
  } else {
    settingsModal.style.display = 'none';
    settingsModal.setAttribute('aria-hidden', 'true');

    announce('Settings closed');
    if (previousFocus) { previousFocus.focus(); previousFocus = null; }
  }
}

// Focus Trap for Accessibility
settingsModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    toggleSettingsModal();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = Array.from(settingsModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => (el.offsetWidth > 0 || el.offsetHeight > 0) && !el.disabled);
      
    if (focusable.length === 0) return;
    
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
if (settingsBtn) settingsBtn.addEventListener('click', toggleSettingsModal);
if (openBtn) openBtn.addEventListener('click', openFilesHandler);
closeSettingsBtn.addEventListener('click', toggleSettingsModal);

// Tabs Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
    });
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.tabIndex = 0;
    document.getElementById(btn.dataset.target).style.display = 'block';
    announce(`Switched to ${btn.textContent} settings`);
  });
  // Arrow key navigation between tabs
  btn.addEventListener('keydown', (e) => {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const idx = tabs.indexOf(btn);
    if (idx === -1) return;
    let target = null;
    if (e.key === 'ArrowRight') { e.preventDefault(); target = tabs[(idx + 1) % tabs.length]; }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); target = tabs[(idx - 1 + tabs.length) % tabs.length]; }
    else if (e.key === 'Home') { e.preventDefault(); target = tabs[0]; }
    else if (e.key === 'End') { e.preventDefault(); target = tabs[tabs.length - 1]; }
    if (target) { target.click(); target.focus(); }
  });
});

// Tabs: one Tab stop for the group, arrows move inside it
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.setAttribute('aria-controls', btn.dataset.target);
  btn.tabIndex = btn.classList.contains('active') ? 0 : -1;
});

eqResetBtn.addEventListener('click', () => {
  document.querySelectorAll('.eq-slider').forEach((slider, index) => {
    slider.value = 0;
    if(eqFilters[index]) eqFilters[index].gain.value = 0;
  });
  boostSlider.value = 1;
  if(gainNode) gainNode.gain.value = 1;
  boostVal.textContent = '100';
  panSlider.value = 0;
  if (pannerNode) pannerNode.pan.value = 0;
  panVal.textContent = 'Center';
  document.querySelectorAll('.eq-slider').forEach(s => s.dispatchEvent(new Event('input')));
  boostSlider.dispatchEvent(new Event('input'));
  panSlider.dispatchEvent(new Event('input'));
  if (eqPresetSelect) eqPresetSelect.value = 'flat';
  announce('Audio settings reset to default');
});

// Subtitles Logic
function updateSubtitleStyles() {
  if (subSizeSelect) {
    document.documentElement.style.setProperty('--cue-font-size', subSizeSelect.value);
  }
  if (subColorSelect) {
    document.documentElement.style.setProperty('--cue-color', subColorSelect.value);
  }
  if (subBgSelect) {
    document.documentElement.style.setProperty('--cue-bg', subBgSelect.value);
  }
}

if (subSizeSelect) {
  subSizeSelect.addEventListener('change', () => {
    updateSubtitleStyles();
    announce(`Subtitle size set to ${subSizeSelect.options[subSizeSelect.selectedIndex].text}`);
  });
}
if (subColorSelect) {
  subColorSelect.addEventListener('change', () => {
    updateSubtitleStyles();
    announce(`Subtitle text color set to ${subColorSelect.options[subColorSelect.selectedIndex].text}`);
  });
}
if (subBgSelect) {
  subBgSelect.addEventListener('change', () => {
    updateSubtitleStyles();
    announce(`Subtitle background shading set to ${subBgSelect.options[subBgSelect.selectedIndex].text}`);
  });
}

loadSubsBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.vtt,.srt';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        loadSubtitleText(decodeText(await file.arrayBuffer()), file.name);
        announce(`Subtitles loaded: ${file.name}`);
      } catch (err) {
        console.error('Failed to read subtitle file', err);
        announce('Failed to read subtitle file');
      }
    }
  };
  input.click();
});
clearSubsBtn.addEventListener('click', () => {
  if (currentSubtitleTrack) currentSubtitleTrack.remove();
  currentSubtitleTrack = null;
  subtitleFileText = null;
  subtitleOffset = 0;
  if (subDelayVal) subDelayVal.textContent = '0.0s';
  document.dispatchEvent(new Event('subtitles-changed'));
  announce('Subtitles cleared');
});

// Toggle the visibility of the currently loaded subtitle track
function toggleSubtitles() {
  if (mediaPlayer.textTracks && mediaPlayer.textTracks.length > 0) {
    const t = mediaPlayer.textTracks[0];
    const showing = t.mode === 'showing';
    for (let i = 0; i < mediaPlayer.textTracks.length; i++) mediaPlayer.textTracks[i].mode = showing ? 'disabled' : 'showing';
    announce(showing ? 'Subtitles hidden' : 'Subtitles shown');
  } else {
    announce('No subtitles loaded');
  }
}

// --- SUBTITLE PARSING & OFFSET (robust, non-destructive) ---
let subtitleFileText = null;
let subtitleBlobUrl = null;
let currentSubtitleName = null;

function parseSubtitles(text, isSrt) {
  const cues = [];
  if (isSrt) {
    const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split('\n').filter(l => l.trim() !== '');
      if (lines.length < 2) continue;
      const idx = lines.findIndex(l => l.includes('-->'));
      if (idx === -1) continue;
      const times = lines[idx].split('-->');
      const start = parseSrtTime(times[0]);
      const end = parseSrtTime(times[1]);
      const textLines = lines.slice(idx + 1).join('\n');
      if (!isNaN(start) && !isNaN(end)) cues.push({ start, end, text: textLines });
    }
  } else {
    const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split('\n').filter(l => l.trim() !== '');
      const idx = lines.findIndex(l => l.includes('-->'));
      if (idx === -1) continue;
      const times = lines[idx].split('-->');
      const start = parseVttTime(times[0]);
      const end = parseVttTime(times[1]);
      const textLines = lines.slice(idx + 1).join('\n');
      if (!isNaN(start) && !isNaN(end)) cues.push({ start, end, text: textLines });
    }
  }
  return cues;
}

function parseVttTime(t) {
  // Only the timestamp itself: WebVTT lines can carry settings such as "line:90%"
  t = t.trim().split(/\s+/)[0].replace(',', '.');
  const parts = t.split(':');
  if (parts.length === 3) return (+parts[0]) * 3600 + (+parts[1]) * 60 + parseFloat(parts[2]);
  if (parts.length === 2) return (+parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(t);
}
function parseSrtTime(t) { return parseVttTime(t); }

function loadSubtitleText(text, label) {
  subtitleFileText = text;
  currentSubtitleName = label || 'Loaded';
  applySubtitleOffset(subtitleOffset);
}

function applySubtitleOffset(offset) {
  const wasHidden = !!(currentSubtitleTrack && currentSubtitleTrack.track && currentSubtitleTrack.track.mode === 'disabled');
  if (currentSubtitleTrack) { currentSubtitleTrack.remove(); currentSubtitleTrack = null; }
  if (subtitleBlobUrl) { URL.revokeObjectURL(subtitleBlobUrl); subtitleBlobUrl = null; }
  if (!subtitleFileText) return;

  const isSrt = /\.(srt)$/i.test(currentSubtitleName || '');
  let cues = parseSubtitles(subtitleFileText, isSrt);
  if (cues.length === 0) cues = parseSubtitles(subtitleFileText, !isSrt); // fallback try other format

  // Build a minimal VTT document with the offset applied (cues rebuilt fresh,
  // so we never mutate the original read-only TextTrackCue objects).
  let vtt = 'WEBVTT\n\n';
  cues.forEach((c, i) => {
    const s = Math.max(0, c.start + offset);
    const e = Math.max(0, c.end + offset);
    if (e <= 0) return; // shifted entirely before the start of the file
    const text = c.text.replace(/\{\\[^}]*\}/g, ''); // positioning codes left over from ASS conversions
    vtt += `${i + 1}\n${fmtVtt(s)} --> ${fmtVtt(e)}\n${text}\n\n`;
  });

  subtitleBlobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = currentSubtitleName || 'Loaded';
  track.srclang = 'en';
  track.src = subtitleBlobUrl;
  track.default = true;
  track.addEventListener('load', () => document.dispatchEvent(new Event('subtitles-changed')));
  mediaPlayer.appendChild(track);
  // "default" alone is ignored on tracks added later; re-timing must not un-hide subtitles
  if (track.track) track.track.mode = wasHidden ? 'hidden' : 'showing';
  currentSubtitleTrack = track;
}

function fmtVtt(secs) {
  const ms = Math.floor((secs % 1) * 1000);
  const s = Math.floor(secs) % 60;
  const m = Math.floor(secs / 60) % 60;
  const h = Math.floor(secs / 3600);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
}

// Accessibility Toggles
highContrastToggle.addEventListener('change', (e) => {
  document.body.classList.toggle('high-contrast', e.target.checked);
  announce(e.target.checked ? 'High contrast enabled' : 'High contrast disabled');
});
largeTextToggle.addEventListener('change', (e) => {
  document.body.classList.toggle('large-text', e.target.checked);
  announce(e.target.checked ? 'Large text enabled' : 'Large text disabled');
});


// Utility
function announce(message) {
  if (verboseAnnounceToggle && !verboseAnnounceToggle.checked) {
    const isCritical = message.includes('Playing') || message.includes('Paused') || message.includes('Loaded');
    if (!isCritical) return;
  }
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 50);
}
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
function isUrl(p) {
  return /^[a-z][a-z0-9+.-]+:\/\//i.test(p) || /^(blob|data):/i.test(p);
}
function stripUrlExtras(p) {
  return isUrl(p) ? p.split(/[?#]/)[0] : p;
}
function getFileName(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  const pageTitle = loadState('webTitles', {})[filePath];
  if (pageTitle) return pageTitle;
  const name = stripUrlExtras(filePath).split('\\').pop().split('/').pop();
  if (!isUrl(filePath)) return name;
  try { return decodeURIComponent(name) || filePath; } catch (e) { return name || filePath; }
}
function isAudioFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const clean = stripUrlExtras(filePath);
  const ext = clean.slice((clean.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  return audioExts.includes('.' + ext);
}
function toMediaSrc(filePath) {
  if (preparedSources.has(filePath)) return preparedSources.get(filePath);
  let local = filePath;
  if (/^file:/i.test(filePath)) { // entries saved by older versions
    try { local = decodeURIComponent(filePath.replace(/^file:\/+/i, '')); } catch (e) { return filePath; }
  } else if (isUrl(filePath)) return filePath;
  return 'amp-media://file/?path=' + encodeURIComponent(local);
}
// Subtitle and lyric files are often not UTF-8, especially older ones
function decodeText(data) {
  const bytes = new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatRate(rate) {
  return String(Math.round(rate * 100) / 100);
}
function setPlaybackRate(rate) {
  mediaPlayer.playbackRate = Math.round(Math.min(4, Math.max(0.1, rate)) * 100) / 100;
  mediaPlayer.defaultPlaybackRate = mediaPlayer.playbackRate; // survives the reset on the next load
  updateSpeedUI();
}
function hasMedia() {
  return !!mediaPlayer.src && !mediaPlayer.src.endsWith('index.html');
}
function seekBy(delta) {
  if (!hasMedia()) return false;
  const max = isFinite(mediaPlayer.duration) ? mediaPlayer.duration : Infinity;
  mediaPlayer.currentTime = Math.max(0, Math.min(max, mediaPlayer.currentTime + delta));
  return true;
}

// --- SHARED KEYBOARD GUARDS ---
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || el.isContentEditable) return true;
  return tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(el.type);
}
function isModalOpen() {
  return Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'flex');
}
// True when single-key player shortcuts must stay out of the way.
function globalKeysBlocked() {
  const el = document.activeElement;
  return isTypingTarget(el) || (el && el.tagName === 'SELECT') || isModalOpen();
}

// Adds to the queue in one pass, and starts playing if nothing was active.
function addFilesAndPlay(paths, playNow) {
  const valid = (paths || []).filter(p => typeof p === 'string' && p);
  if (!valid.length) return 0;
  const wasIdle = currentPlaylistIndex === -1;
  const seen = new Set(playlist.map(normalizePath));
  valid.forEach(p => {
    const key = normalizePath(p);
    if (!seen.has(key)) { seen.add(key); playlist.push(p); }
  });
  renderPlaylist();
  if (wasIdle || playNow) {
    const first = normalizePath(valid[0]);
    playPlaylistItem(playlist.findIndex(p => normalizePath(p) === first));
  } else {
    announce(`Added ${valid.length} to the queue`);
  }
  return valid.length;
}
// Plays one item now, keeping the queue position correct.
function playPath(filePath, seekTo) {
  addToPlaylist(filePath);
  const key = normalizePath(filePath);
  const idx = playlist.findIndex(p => normalizePath(p) === key);
  if (idx === -1) return;
  currentPlaylistIndex = idx;
  loadMedia(playlist[idx], seekTo);
  renderPlaylist();
}

// --- IDLE / AUTO-HIDE CONTROLS ---
function resetIdleTimer() {
  topBar.classList.add('active');
  controlsOverlay.classList.add('active');
  videoWrapper.classList.remove('hide-cursor');
  
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    // Hiding focused controls would drop keyboard and screen-reader focus to nowhere
    const active = document.activeElement;
    const keyboardInControls = active && active.matches(':focus-visible') && (controlsOverlay.contains(active) || topBar.contains(active));
    if (!mediaPlayer.paused && !keyboardInControls && !controlsOverlay.matches(':hover') && !topBar.matches(':hover')) {
      topBar.classList.remove('active');
      controlsOverlay.classList.remove('active');
      videoWrapper.classList.add('hide-cursor');
    }
  }, 2500);
}

window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);
mediaPlayer.addEventListener('pause', resetIdleTimer);
controlsOverlay.addEventListener('mouseenter', resetIdleTimer);
topBar.addEventListener('mouseenter', resetIdleTimer);

// --- PLAYBACK LOGIC ---
function loadMedia(filePath, seekTo) {
  
  // Clear any active A-B loop on media change
  abStart = null;
  abEnd = null;
  if (abStartLabel) abStartLabel.textContent = 'Start (A): --:--';
  if (abEndLabel) abEndLabel.textContent = 'End (B): --:--';

  // Reset subtitle synchronization offsets on media change
  subtitleOffset = 0;
  if (subDelayVal) subDelayVal.textContent = '0.0s';
  if (currentSubtitleTrack) { currentSubtitleTrack.remove(); currentSubtitleTrack = null; }
  if (subtitleBlobUrl) { URL.revokeObjectURL(subtitleBlobUrl); subtitleBlobUrl = null; }
  subtitleFileText = null;
  currentSubtitleName = null;
  document.dispatchEvent(new Event('subtitles-changed'));

  currentFilePath = filePath;
  mediaPlayer.src = toMediaSrc(filePath);
  titleDisplay.textContent = getFileName(filePath);
  mediaPlayer.load();
  
  document.title = `${titleDisplay.textContent} - Accessible Media Player`; // what Alt+Tab reads out
  const thisLoad = ++loadToken;

  if (seekTo && seekTo > 0) {
    mediaPlayer.addEventListener('loadedmetadata', () => {
      if (thisLoad === loadToken) mediaPlayer.currentTime = seekTo; // a failed load must not seek the next file
    }, { once: true });
  }
  
  const autoStart = loadState('autoplay', true);
  if (autoStart) {
    suppressPlayAnnounce = true;
    mediaPlayer.play().catch(() => { if (thisLoad === loadToken) suppressPlayAnnounce = false; }); // failures are reported by the 'error' listener
  }
  
  // Save resume state, update bookmarks display and history
  saveState('resume', { file: filePath, time: seekTo || 0, savedAt: Date.now() });
  renderBookmarks();
  addToHistory(filePath);
  
  updateSpeedUI();
  
  announce(`${autoStart ? 'Now Playing' : 'Loaded'}: ${titleDisplay.textContent}`);
}

function togglePlay() {
  if (!hasMedia()) {
    if (playlist.length) playPlaylistItem(Math.max(0, currentPlaylistIndex));
    else announce('No media loaded. Press Control O to open files.');
    return;
  }
  if (mediaPlayer.paused) mediaPlayer.play().catch(e => console.error('Play failed', e));
  else mediaPlayer.pause();
}

mediaPlayer.addEventListener('play', () => {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
  playBtn.setAttribute('aria-label', 'Pause');
  playBtn.setAttribute('aria-pressed', 'true');
  if (suppressPlayAnnounce) suppressPlayAnnounce = false;
  else announce('Playing');
  resetIdleTimer();
});

mediaPlayer.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  playBtn.setAttribute('aria-label', 'Play');
  playBtn.setAttribute('aria-pressed', 'false');
  if (!mediaPlayer.ended) announce('Paused');
  resetIdleTimer();
});

playBtn.addEventListener('click', togglePlay);
// Waits briefly so a double-click (fullscreen) does not also pause and resume
let videoClickTimer = null;
videoWrapper.addEventListener('click', (e) => {
  if (e.target === videoWrapper || e.target === mediaPlayer || e.target === audioVisualizer) {
    clearTimeout(videoClickTimer);
    videoClickTimer = setTimeout(togglePlay, 230);
  }
});

// Fullscreen double click
videoWrapper.addEventListener('dblclick', (e) => {
  if (e.target === videoWrapper || e.target === mediaPlayer || e.target === audioVisualizer) {
    clearTimeout(videoClickTimer);
    toggleFullscreen();
  }
});

rewindBtn.addEventListener('click', () => {
  if (seekBy(-10)) announce(`Back to ${formatTime(mediaPlayer.currentTime)}`);
});
forwardBtn.addEventListener('click', () => {
  if (seekBy(10)) announce(`Forward to ${formatTime(mediaPlayer.currentTime)}`);
});

// Break A-B loop if user explicitly seeks outside of it (VLC style polished UX!)
mediaPlayer.addEventListener('seeking', () => {
  if (abStart !== null && abEnd !== null) {
    const t = mediaPlayer.currentTime;
    if (t < abStart - 0.5 || t > abEnd + 0.5) {
      abStart = null;
      abEnd = null;
      abStartLabel.textContent = 'Start (A): --:--';
      abEndLabel.textContent = 'End (B): --:--';
      announce('A-B Loop automatically disabled');
    }
  }
});

// Progress
progressSlider.setAttribute('aria-orientation', 'horizontal');
progressSlider.setAttribute('aria-label', 'Seek progress');
mediaPlayer.addEventListener('timeupdate', () => {
  if (abStart !== null && abEnd !== null) {
    if (mediaPlayer.currentTime >= abEnd) {
      mediaPlayer.currentTime = abStart;
    }
  }
  if (!mediaPlayer.duration || isSeeking) return;
  updateProgressUI(false);
});
mediaPlayer.addEventListener('seeked', () => updateProgressUI(true));
mediaPlayer.addEventListener('loadedmetadata', () => updateProgressUI(true)); // needed when a file loads paused
mediaPlayer.addEventListener('emptied', () => {
  progressSlider.value = 0;
  progressSlider.style.background = `linear-gradient(to right, var(--focus-color) 0%, rgba(255,255,255,0.3) 0%)`;
  timeDisplay.textContent = '00:00 / 00:00';
});

function updateProgressUI(forceSpokenValue) {
  const dur = mediaPlayer.duration;
  const cur = mediaPlayer.currentTime;
  const progress = isFinite(dur) && dur > 0 ? (cur / dur) * 100 : 0;
  progressSlider.style.background = `linear-gradient(to right, var(--focus-color) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`;
  progressSlider.value = progress;
  if (!isFinite(dur)) timeDisplay.textContent = formatTime(cur);
  else if (showRemainingTime) timeDisplay.textContent = `-${formatTime(Math.max(0, dur - cur))}`;
  else timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  // A focused slider whose value text keeps changing makes screen readers talk
  // nonstop during playback, so only refresh it there after an actual seek.
  if (forceSpokenValue || document.activeElement !== progressSlider) {
    progressSlider.setAttribute('aria-valuenow', Math.round(progress));
    progressSlider.setAttribute('aria-valuetext', isFinite(dur) ? `${formatTime(cur)} of ${formatTime(dur)}` : formatTime(cur));
  }
}

progressSlider.addEventListener('mousedown', () => isSeeking = true);
// Keyboard seeking in real time steps (the native 0.1% step is inaudibly small)
progressSlider.addEventListener('keydown', (e) => {
  if (!mediaPlayer.duration) return;
  const steps = { ArrowLeft: -10, ArrowDown: -10, ArrowRight: 10, ArrowUp: 10, PageDown: -60, PageUp: 60 };
  if (e.key in steps) seekBy(steps[e.key]);
  else if (e.key === 'Home') mediaPlayer.currentTime = 0;
  else if (e.key === 'End' && isFinite(mediaPlayer.duration)) mediaPlayer.currentTime = Math.max(0, mediaPlayer.duration - 1);
  else return;
  e.preventDefault();
  announce(`Seeked to ${formatTime(mediaPlayer.currentTime)}`);
});
progressSlider.addEventListener('input', (e) => {
  if (!mediaPlayer.duration) return;
  const seekTime = (e.target.value / 100) * mediaPlayer.duration;
  progressSlider.style.background = `linear-gradient(to right, var(--focus-color) ${e.target.value}%, rgba(255,255,255,0.3) ${e.target.value}%)`;
  timeDisplay.textContent = `${formatTime(seekTime)} / ${formatTime(mediaPlayer.duration)}`;
  progressSlider.setAttribute('aria-valuenow', Math.round(e.target.value));
  progressSlider.setAttribute('aria-valuetext', `${formatTime(seekTime)} of ${formatTime(mediaPlayer.duration)}`);
});
function finishSeek(e) {
  if (!isSeeking || !mediaPlayer.duration) return;
  isSeeking = false;
  mediaPlayer.currentTime = (e.target.value / 100) * mediaPlayer.duration;
  announce(`Seeked to ${formatTime(mediaPlayer.currentTime)}`);
}
// Safety: if the mouse is released anywhere (or focus is lost) while seeking,
// still commit the seek so the progress bar is never left frozen.
function forceFinishSeek() {
  if (!isSeeking) return;
  isSeeking = false;
  if (mediaPlayer.duration) {
    mediaPlayer.currentTime = (progressSlider.value / 100) * mediaPlayer.duration;
  }
}
progressSlider.addEventListener('change', finishSeek);
progressSlider.addEventListener('mouseup', finishSeek);
progressSlider.addEventListener('keyup', finishSeek);
window.addEventListener('mouseup', forceFinishSeek);
window.addEventListener('blur', forceFinishSeek);
mediaPlayer.addEventListener('seeked', () => { isSeeking = false; });

// Volume & Mute
volumeSlider.setAttribute('aria-orientation', 'horizontal');
volumeSlider.setAttribute('aria-label', 'Volume');
volumeSlider.addEventListener('input', (e) => {
  mediaPlayer.volume = e.target.value / 100;
  mediaPlayer.muted = false;
  updateVolumeUI();
});
volumeSlider.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); volumeSlider.value = Math.min(100, parseFloat(volumeSlider.value) + 5); volumeSlider.dispatchEvent(new Event('input')); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 5); volumeSlider.dispatchEvent(new Event('input')); }
  else if (e.key === 'PageUp') { e.preventDefault(); volumeSlider.value = Math.min(100, parseFloat(volumeSlider.value) + 20); volumeSlider.dispatchEvent(new Event('input')); }
  else if (e.key === 'PageDown') { e.preventDefault(); volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 20); volumeSlider.dispatchEvent(new Event('input')); }
  else if (e.key === 'Home') { e.preventDefault(); volumeSlider.value = 100; volumeSlider.dispatchEvent(new Event('input')); }
  else if (e.key === 'End') { e.preventDefault(); volumeSlider.value = 0; volumeSlider.dispatchEvent(new Event('input')); }
});
muteBtn.addEventListener('click', () => {
  mediaPlayer.muted = !mediaPlayer.muted;
  updateVolumeUI();
  announce(mediaPlayer.muted ? 'Muted' : 'Unmuted');
});
function updateVolumeUI() {
  muteBtn.setAttribute('aria-pressed', mediaPlayer.muted);
  if (mediaPlayer.muted || mediaPlayer.volume === 0) {
    volUpIcon.style.display = 'none';
    volMuteIcon.style.display = 'block';
    volumeSlider.value = 0;
  } else {
    volUpIcon.style.display = 'block';
    volMuteIcon.style.display = 'none';
    volumeSlider.value = mediaPlayer.volume * 100;
  }
  volumeSlider.style.background = `linear-gradient(to right, var(--text-color) ${volumeSlider.value}%, rgba(255,255,255,0.3) ${volumeSlider.value}%)`;
  volumeSlider.setAttribute('aria-valuenow', Math.round(volumeSlider.value));
  volumeSlider.setAttribute('aria-valuetext', `${Math.round(volumeSlider.value)} percent`);
}

// Speed Control
speedBtn.addEventListener('click', () => {
  currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
  setPlaybackRate(speeds[currentSpeedIndex]);
  announce(`Speed ${speeds[currentSpeedIndex]}x`);
});

// Loop Control
function setRepeatMode(mode) {
  repeatMode = mode;
  isLooping = (mode === 'one');
  mediaPlayer.loop = isLooping;
  const labels = { off: 'Off', one: 'Repeat One', all: 'Repeat All' };
  loopBtn.style.color = mode === 'off' ? 'var(--text-color)' : 'var(--focus-color)';
  loopBtn.setAttribute('aria-pressed', mode !== 'off');
  loopBtn.setAttribute('aria-label', 'Repeat mode: ' + labels[mode] + ' (Control L)');
  announce('Repeat mode: ' + labels[mode]);
}
loopBtn.addEventListener('click', () => {
  setRepeatMode(repeatMode === 'off' ? 'one' : repeatMode === 'one' ? 'all' : 'off');
});

// PiP Control
pipBtn.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      pipBtn.setAttribute('aria-pressed', 'false');
      announce('PIP unpressed, picture in picture exited');
    } else if (document.pictureInPictureEnabled && mediaPlayer.readyState !== 0 && mediaPlayer.videoWidth) {
      await mediaPlayer.requestPictureInPicture();
      pipBtn.setAttribute('aria-pressed', 'true');
      announce('PIP pressed, picture in picture started');
    } else {
      announce('Picture in picture needs a video to be playing');
    }
  } catch (err) {
    console.error(err);
    announce('Picture in picture is not available');
  }
});
mediaPlayer.addEventListener('leavepictureinpicture', () => pipBtn.setAttribute('aria-pressed', 'false'));

// Fullscreen
function toggleFullscreen() {
  ipcRenderer.send('toggle-fullscreen');
}
fullscreenBtn.addEventListener('click', toggleFullscreen);
ipcRenderer.on('fullscreen-state', (event, isFs) => {
  const changed = fullscreenStateKnown && isFs !== isWindowFullscreen;
  isWindowFullscreen = isFs;
  fullscreenStateKnown = true;
  fullscreenBtn.setAttribute('aria-pressed', isFs);
  fsEnterIcon.style.display = isFs ? 'none' : 'block';
  fsExitIcon.style.display = isFs ? 'block' : 'none';
  if (changed) announce(isFs ? 'Entered fullscreen' : 'Exited fullscreen');
});

// --- FILE OPEN & PLAYLIST ---
async function openFilesHandler() {
  const filePaths = await ipcRenderer.invoke('open-file-dialog');
  if (filePaths && filePaths.length > 0) addFilesAndPlay(filePaths, true);
}

let previousPlaylistFocus = null;

// --- PATH NORMALIZATION FOR SECURE BOOKMARK SCOPING ---
function normalizePath(filePath) {
  if (!filePath) return '';
  if (isUrl(filePath)) return filePath.trim(); // URLs are case-sensitive
  return filePath.replace(/\\/g, '/').toLowerCase().trim();
}

// --- SIDEBAR TOGGLES ---
function togglePlaylistSidebar() {
  const isOpen = playlistSidebar.classList.contains('open');
  if (isOpen) {
    // Focus has to leave first: hiding a panel that still holds focus strands screen readers
    (previousPlaylistFocus && previousPlaylistFocus.isConnected ? previousPlaylistFocus : playBtn).focus();
    playlistSidebar.classList.remove('open');
    playlistSidebar.setAttribute('aria-hidden', 'true');
    announce('Playlist sidebar closed');
  } else {
    previousPlaylistFocus = document.activeElement;
    
    // Close Bookmarks and More Options Sidebars if open
    if (bookmarksSidebar.classList.contains('open')) {
      bookmarksSidebar.classList.remove('open');
      bookmarksSidebar.setAttribute('aria-hidden', 'true');
    }
    if (moreOptionsSidebar && moreOptionsSidebar.classList.contains('open')) {
      moreOptionsSidebar.classList.remove('open');
      moreOptionsSidebar.setAttribute('aria-hidden', 'true');
    }
    
    playlistSidebar.classList.add('open');
    playlistSidebar.setAttribute('aria-hidden', 'false');
    announce('Playlist sidebar opened');
    
    const firstPlaylistItem = playlistItems.querySelector('.playlist-item');
    if (firstPlaylistItem) firstPlaylistItem.focus();
    else closePlaylistBtn.focus();
  }
}

let previousBookmarksFocus = null;
function toggleBookmarksSidebar() {
  const isOpen = bookmarksSidebar.classList.contains('open');
  if (isOpen) {
    (previousBookmarksFocus && previousBookmarksFocus.isConnected ? previousBookmarksFocus : playBtn).focus();
    bookmarksSidebar.classList.remove('open');
    bookmarksSidebar.setAttribute('aria-hidden', 'true');
    announce('Bookmarks sidebar closed');
  } else {
    previousBookmarksFocus = document.activeElement;
    
    // Close Playlist and More Options Sidebars if open
    if (playlistSidebar.classList.contains('open')) {
      playlistSidebar.classList.remove('open');
      playlistSidebar.setAttribute('aria-hidden', 'true');
    }
    if (moreOptionsSidebar && moreOptionsSidebar.classList.contains('open')) {
      moreOptionsSidebar.classList.remove('open');
      moreOptionsSidebar.setAttribute('aria-hidden', 'true');
    }
    
    bookmarksSidebar.classList.add('open');
    bookmarksSidebar.setAttribute('aria-hidden', 'false');
    announce('Bookmarks sidebar opened');
    
    renderBookmarks();
    sidebarAddBookmarkBtn.focus();
  }
}

let previousMoreOptionsFocus = null;
function toggleMoreOptionsSidebar() {
  if (!moreOptionsSidebar) return;
  const isOpen = moreOptionsSidebar.classList.contains('open');
  if (isOpen) {
    (previousMoreOptionsFocus && previousMoreOptionsFocus.isConnected ? previousMoreOptionsFocus : playBtn).focus();
    moreOptionsSidebar.classList.remove('open');
    moreOptionsSidebar.setAttribute('aria-hidden', 'true');
    announce('More Options sidebar closed');
  } else {
    previousMoreOptionsFocus = document.activeElement;
    
    // Close Playlist and Bookmarks Sidebars if open
    if (playlistSidebar.classList.contains('open')) {
      playlistSidebar.classList.remove('open');
      playlistSidebar.setAttribute('aria-hidden', 'true');
    }
    if (bookmarksSidebar.classList.contains('open')) {
      bookmarksSidebar.classList.remove('open');
      bookmarksSidebar.setAttribute('aria-hidden', 'true');
    }
    
    moreOptionsSidebar.classList.add('open');
    moreOptionsSidebar.setAttribute('aria-hidden', 'false');
    announce('More Options sidebar opened');
    
    // Focus the first action button in more options
    const firstBtn = gotoTimeBtn || screenshotBtn || closeMoreOptionsBtn;
    if (firstBtn) firstBtn.focus();
  }
}

if (playlistToggleBtn) playlistToggleBtn.addEventListener('click', togglePlaylistSidebar);
if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', togglePlaylistSidebar);
if (bookmarksToggleBtn) bookmarksToggleBtn.addEventListener('click', toggleBookmarksSidebar);
if (closeBookmarksBtn) closeBookmarksBtn.addEventListener('click', toggleBookmarksSidebar);
if (moreOptionsToggleBtn) moreOptionsToggleBtn.addEventListener('click', toggleMoreOptionsSidebar);
if (closeMoreOptionsBtn) closeMoreOptionsBtn.addEventListener('click', toggleMoreOptionsSidebar);

// Focus Trap for Playlist Sidebar
playlistSidebar.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    togglePlaylistSidebar();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = Array.from(playlistSidebar.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => (el.offsetWidth > 0 || el.offsetHeight > 0) && !el.disabled);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// Focus Trap for Bookmarks Sidebar
bookmarksSidebar.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    toggleBookmarksSidebar();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = Array.from(bookmarksSidebar.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => (el.offsetWidth > 0 || el.offsetHeight > 0) && !el.disabled);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// Focus Trap for More Options Sidebar
if (moreOptionsSidebar) {
  moreOptionsSidebar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleMoreOptionsSidebar();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = Array.from(moreOptionsSidebar.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => (el.offsetWidth > 0 || el.offsetHeight > 0) && !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

// Global Menu IPC actions
ipcRenderer.on('menu-action', (event, action) => {
  switch (action) {
    case 'open-file': openFilesHandler(); break;
    case 'open-playlist': loadPlaylistBtn.click(); break;
    case 'save-playlist': savePlaylistBtn.click(); break;
    case 'play-pause': togglePlay(); break;
    case 'next-track': playNext(); break;
    case 'prev-track': playPrev(); break;
    case 'toggle-loop': loopBtn.click(); break;
    case 'vol-up': 
      volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 10);
      volumeSlider.dispatchEvent(new Event('input'));
      break;
    case 'vol-down':
      volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 10);
      volumeSlider.dispatchEvent(new Event('input'));
      break;
    case 'toggle-mute': muteBtn.click(); break;
    case 'toggle-eq': toggleSettingsModal(); break;
    case 'toggle-fullscreen': toggleFullscreen(); break;
    case 'toggle-pip': pipBtn.click(); break;
    case 'toggle-playlist-sidebar': togglePlaylistSidebar(); break;
  }
});

function addToPlaylist(filePath) {
  if (typeof filePath !== 'string' || !filePath) return;
  const norm = normalizePath(filePath);
  if (!playlist.some(p => normalizePath(p) === norm)) {
    playlist.push(filePath);
    renderPlaylist();
  }
}

function playPlaylistItem(index) {
  if (index >= 0 && index < playlist.length) {
    currentPlaylistIndex = index;
    loadMedia(playlist[index]);
    renderPlaylist();
  }
}

// Tracks not yet heard in this shuffle pass, so nothing repeats until all have played
function shuffleChoices() {
  const heard = new Set(shuffleHistory);
  return playlist.map((p, i) => i).filter(i => i !== currentPlaylistIndex && !heard.has(playlist[i]));
}

function playNext() {
  if (playlist.length > 0) {
    if (shuffleToggle && shuffleToggle.checked && playlist.length > 1) {
      let choices = shuffleChoices();
      if (!choices.length && repeatMode === 'all') {
        shuffleHistory.length = 0; // a new pass through the queue
        choices = shuffleChoices();
      }
      if (!choices.length) { shuffleHistory.length = 0; announce('End of queue'); if (window.ampCue) window.ampCue('end'); return; }
      if (playlist[currentPlaylistIndex]) shuffleHistory.push(playlist[currentPlaylistIndex]);
      playPlaylistItem(choices[Math.floor(Math.random() * choices.length)]);
    } else if (currentPlaylistIndex < playlist.length - 1 || repeatMode === 'all') {
      playPlaylistItem((currentPlaylistIndex + 1) % playlist.length);
    } else {
      announce('End of queue');
      if (window.ampCue) window.ampCue('end');
    }
  }
}

function playPrev() {
  if (hasMedia() && mediaPlayer.currentTime > 3) {
    mediaPlayer.currentTime = 0; // first press restarts, like a CD player
  } else if (shuffleToggle.checked && shuffleHistory.length) {
    const previous = playlist.indexOf(shuffleHistory.pop());
    if (previous >= 0) playPlaylistItem(previous);
  } else if (playlist.length > 0 && currentPlaylistIndex > 0) {
    playPlaylistItem(currentPlaylistIndex - 1);
  } else if (currentPlaylistIndex === 0) {
    mediaPlayer.currentTime = 0; // Just restart if it's the first track
  }
}

nextTrackBtn.addEventListener('click', playNext);
prevTrackBtn.addEventListener('click', playPrev);

function renderPlaylist() {
  // Rebuilding the list destroys the focused item, so remember which one it was
  const active = document.activeElement;
  const focusedIdx = playlistItems.contains(active) ? Array.from(playlistItems.children).indexOf(active) : -1;
  playlistItems.innerHTML = '';
  playlist.forEach((path, i) => {
    const li = document.createElement('li');
    const isCurrent = i === currentPlaylistIndex;
    li.className = `playlist-item ${isCurrent ? 'playing' : ''}`;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.textContent = getFileName(path);
    li.setAttribute('aria-label', `${getFileName(path)}, ${i + 1} of ${playlist.length}${isCurrent ? ', now playing' : ''}`);
    if (isCurrent) li.setAttribute('aria-current', 'true');
    li.onclick = () => playPlaylistItem(i);
    li.onkeydown = (e) => { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        playPlaylistItem(i); 
      } 
    };
    playlistItems.appendChild(li);
  });
  if (!playlist.length) {
    const empty = document.createElement('li');
    empty.style.cssText = 'padding: 15px; color: #888; text-align: center; font-size: 0.9rem;';
    empty.textContent = 'The queue is empty. Press Control O to add files.';
    playlistItems.appendChild(empty);
  }
  const restore = pendingPlaylistFocus !== null ? pendingPlaylistFocus : focusedIdx;
  pendingPlaylistFocus = null;
  if (restore >= 0 && playlist.length) playlistItems.children[Math.min(restore, playlist.length - 1)].focus();
}

clearPlaylistBtn.addEventListener('click', () => {
  if (!playlist.length) return announce('The queue is already empty');
  playlist = [];
  currentPlaylistIndex = -1;
  shuffleHistory.length = 0;
  renderPlaylist();
  announce('Queue cleared. Press Control Z to undo.');
});

mediaPlayer.addEventListener('ended', () => {
  if (repeatMode === 'one' || stopAfterCurrentTrack) return;
  if ((autoplayToggle && autoplayToggle.checked) || repeatMode === 'all') {
    playNext();
  }
});

// Save & Load Playlist
savePlaylistBtn.addEventListener('click', async () => {
  if (playlist.length === 0) return announce("Playlist empty.");
  const success = await ipcRenderer.invoke('save-playlist', playlist);
  if (success) announce('Playlist saved successfully');
});

loadPlaylistBtn.addEventListener('click', async () => {
  const loaded = await ipcRenderer.invoke('open-playlist');
  if (loaded && Array.isArray(loaded)) {
    playlist = loaded.filter(p => typeof p === 'string' && p);
    currentPlaylistIndex = -1;
    renderPlaylist();
    if (playlist.length > 0) playPlaylistItem(0);
    else announce('That playlist is empty');
  } else if (loaded === null) {
    announce('No playlist loaded');
  }
});

// --- KEYBOARD ---
// Every player shortcut uses Ctrl so NVDA passes it through; the full table is in features.js.
// Escape is the one plain key: panels and menus use it first and mark it as handled.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.defaultPrevented && !isModalOpen() && !isTypingTarget(document.activeElement) && isWindowFullscreen) toggleFullscreen();
});

// --- BOOKMARKS CONTROLLER ---
function getBookmarks() {
  if (!currentFilePath) return [];
  const all = loadState('bookmarks', {});
  const key = normalizePath(currentFilePath);
  return all[key] || [];
}

function saveBookmarks(bookmarks) {
  if (!currentFilePath) return;
  const all = loadState('bookmarks', {});
  const key = normalizePath(currentFilePath);
  all[key] = bookmarks;
  saveState('bookmarks', all);
  renderBookmarkMarkers();
}

function addBookmarkAtCurrentTime() {
  if (!currentFilePath || isNaN(mediaPlayer.currentTime)) {
    announce('No media loaded to bookmark');
    return;
  }
  const bookmarks = getBookmarks();
  const time = mediaPlayer.currentTime;
  const label = `Bookmark at ${formatTime(time)}`;
  bookmarks.push({ time, label });
  bookmarks.sort((a, b) => a.time - b.time);
  saveBookmarks(bookmarks);
  renderBookmarks();
  announce(`Bookmark added at ${formatTime(time)}`);
}

function renderBookmarks() {
  bookmarksSidebarList.innerHTML = '';
  const bookmarks = getBookmarks();
  if (bookmarks.length === 0) {
    bookmarksSidebarList.innerHTML = '<li style="padding: 15px; color: #888; text-align: center; font-size: 0.9rem;">No bookmarks yet. Press Ctrl+Shift+B or use the button above to add one.</li>';
    return;
  }
  bookmarks.forEach((bm, i) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    
    const row = document.createElement('div');
    row.className = 'bookmark-row';
    
    // Inline label editor (extremely premium feature!)
    const titleInput = document.createElement('input');
    titleInput.className = 'bookmark-title-input';
    titleInput.type = 'text';
    titleInput.value = bm.label;
    titleInput.setAttribute('aria-label', `Bookmark label`);
    titleInput.onchange = (e) => {
      const current = getBookmarks();
      if (current[i]) {
        current[i].label = e.target.value.trim() || `Bookmark at ${formatTime(bm.time)}`;
        saveBookmarks(current);
        renderBookmarks();
        announce('Bookmark renamed');
      }
    };
    
    const timeBadge = document.createElement('span');
    timeBadge.className = 'bookmark-time-badge';
    timeBadge.textContent = formatTime(bm.time);
    timeBadge.title = `Jump to ${formatTime(bm.time)}`;
    timeBadge.onclick = () => {
      mediaPlayer.currentTime = bm.time;
      announce(`Jumped to ${formatTime(bm.time)}`);
    };
    
    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    
    const jumpBtn = document.createElement('button');
    jumpBtn.className = 'action-btn-small';
    jumpBtn.textContent = 'Jump';
    jumpBtn.setAttribute('aria-label', `Jump to ${bm.label}`);
    jumpBtn.onclick = () => {
      mediaPlayer.currentTime = bm.time;
      announce(`Jumped to ${formatTime(bm.time)}`);
    };
    
    const delBtn = document.createElement('button');
    delBtn.className = 'builder-remove-btn';
    delBtn.textContent = 'Delete';
    delBtn.style.padding = '4px 8px';
    delBtn.setAttribute('aria-label', `Delete ${bm.label}`);
    delBtn.onclick = () => {
      const current = getBookmarks();
      current.splice(i, 1);
      saveBookmarks(current);
      renderBookmarks();
      announce(`Bookmark deleted`);
    };
    
    row.appendChild(titleInput);
    row.appendChild(timeBadge);
    
    actions.appendChild(jumpBtn);
    actions.appendChild(delBtn);
    
    li.appendChild(row);
    li.appendChild(actions);
    
    bookmarksSidebarList.appendChild(li);
  });
}

// Draw bookmark markers directly on the seek bar track (premium interface wow factor!)
function renderBookmarkMarkers() {
  const existing = document.querySelectorAll('.progress-marker');
  existing.forEach(m => m.remove());

  if (!mediaPlayer.duration || isNaN(mediaPlayer.duration)) return;

  const bookmarks = getBookmarks();
  bookmarks.forEach(bm => {
    const marker = document.createElement('div');
    marker.className = 'progress-marker';
    const percent = (bm.time / mediaPlayer.duration) * 100;
    marker.style.left = `${percent}%`;
    marker.title = bm.label;
    marker.setAttribute('role', 'button');
    marker.tabIndex = 0;
    marker.setAttribute('aria-label', `Bookmark at ${formatTime(bm.time)}: ${bm.label}. Press Enter to jump.`);
    marker.onclick = (e) => {
      e.stopPropagation(); // prevent seekbar trigger
      mediaPlayer.currentTime = bm.time;
      announce(`Jumped to bookmark: ${bm.label}`);
    };
    marker.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        mediaPlayer.currentTime = bm.time;
        announce(`Jumped to bookmark: ${bm.label}`);
      }
    });
    progressSlider.parentElement.appendChild(marker);
  });
}

mediaPlayer.addEventListener('loadedmetadata', () => {
  renderBookmarkMarkers();
});

// Wrapped so these use the thumbnail-capturing version from features.js
if (sidebarAddBookmarkBtn) sidebarAddBookmarkBtn.addEventListener('click', () => addBookmarkAtCurrentTime());
if (mainAddBookmarkBtn) mainAddBookmarkBtn.addEventListener('click', () => addBookmarkAtCurrentTime());

// --- A-B LOOP CONTROLLER ---
setPointABtn.addEventListener('click', () => {
  if (!currentFilePath) return announce('No media loaded');
  abStart = mediaPlayer.currentTime;
  abStartLabel.textContent = `Start (A): ${formatTime(abStart)}`;
  if (abEnd !== null && abEnd <= abStart) {
    abEnd = null; // an end point before the start would loop forever
    abEndLabel.textContent = 'End (B): --:--';
  }
  announce(`Point A set at ${formatTime(abStart)}`);
});

setPointBBtn.addEventListener('click', () => {
  if (!currentFilePath) return announce('No media loaded');
  if (abStart === null) {
    announce('Set Point A first');
    return;
  }
  if (mediaPlayer.currentTime <= abStart) {
    announce('Point B must be after Point A');
    return;
  }
  abEnd = mediaPlayer.currentTime;
  abEndLabel.textContent = `End (B): ${formatTime(abEnd)}`;
  announce(`Point B set at ${formatTime(abEnd)}. Loop active.`);
});

clearAbLoopBtn.addEventListener('click', () => {
  abStart = null;
  abEnd = null;
  abStartLabel.textContent = 'Start (A): --:--';
  abEndLabel.textContent = 'End (B): --:--';
  announce('A-B loop cleared');
});

// --- SLEEP TIMER CONTROLLER ---
let sleepTimerEndTime = null;
const SLEEP_FADE_MS = 30000;
sleepTimerSelect.addEventListener('change', (e) => {
  if (sleepInterval) clearInterval(sleepInterval);
  if (sleepFading) { sleepFading = false; rampFade(1, 0.2); } // cancelled during the fade
  const val = e.target.value;
  if (val === 'off') {
    sleepCountdown.style.display = 'none';
    sleepTimerEndTime = null;
    announce('Sleep timer disabled');
    return;
  }
  let timeRemaining = parseInt(val) * 60; // seconds
  sleepTimerEndTime = Date.now() + timeRemaining * 1000;
  sleepCountdown.style.display = 'inline';
  
  const updateTimer = () => {
    const remainingMs = sleepTimerEndTime ? sleepTimerEndTime - Date.now() : 0;
    if (remainingMs <= 0) {
      clearInterval(sleepInterval);
      sleepCountdown.style.display = 'none';
      sleepTimerSelect.value = 'off';
      sleepTimerEndTime = null;
      mediaPlayer.pause();
      announce('Sleep timer elapsed. Playback paused.');
      if (sleepFading) { sleepFading = false; setTimeout(() => rampFade(1, 0.05), 300); } // ready for next time
      return;
    }
    // Drift off gently over the last half minute rather than cutting out
    if (remainingMs <= SLEEP_FADE_MS && !sleepFading && !mediaPlayer.paused && fadeNode) {
      sleepFading = true;
      rampFade(0, remainingMs / 1000);
    }
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    sleepCountdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  updateTimer();
  sleepInterval = setInterval(updateTimer, 1000);
  announce(`Sleep timer set for ${val} minutes`);
});

// --- SUBTITLE DELAY CONTROL ---
function updateSubtitleDelay(seconds) {
  subtitleOffset = Math.round((subtitleOffset + seconds) * 10) / 10;
  if (subDelayVal) subDelayVal.textContent = `${subtitleOffset >= 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`;
  applySubtitleOffset(subtitleOffset);
  announce(`Subtitle delay offset shifted by ${seconds}s`);
}

subDelayMinus.addEventListener('click', () => updateSubtitleDelay(-0.5));
subDelayPlus.addEventListener('click', () => updateSubtitleDelay(0.5));
subDelayReset.addEventListener('click', () => {
  subtitleOffset = 0;
  if (subDelayVal) subDelayVal.textContent = '0.0s';
  applySubtitleOffset(0);
  announce('Subtitle delay reset to default');
});

// --- GO TO TIME CONTROLLER ---
function openGotoModal() {
  window._lastModalPrevFocus = document.activeElement;
  gotoModal.style.display = 'flex';
  gotoModal.setAttribute('aria-hidden', 'false');
  gotoTimeInput.value = '';
  gotoTimeInput.focus();
}

function closeGotoModal() {
  gotoModal.style.display = 'none';
  gotoModal.setAttribute('aria-hidden', 'true');
  if (window._lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; }
}

gotoTimeBtn.addEventListener('click', openGotoModal);
closeGotoBtn.addEventListener('click', closeGotoModal);

function submitGotoHandler() {
  const input = gotoTimeInput.value.trim();
  if (!input) return;
  if (!hasMedia()) { announce('No media loaded'); return; }
  
  let targetSeconds = null;
  const parts = input.split(':').map(Number);
  
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    targetSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    targetSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    targetSeconds = parts[0];
  }
  
  const maxTime = mediaPlayer.duration || Infinity;
  if (targetSeconds !== null && targetSeconds >= 0 && targetSeconds <= maxTime) {
    mediaPlayer.currentTime = targetSeconds;
    announce(`Jumped to ${formatTime(targetSeconds)}`);
    closeGotoModal();
  } else {
    const msg = `Invalid time. Use hh:mm:ss, mm:ss, or seconds (max: ${formatTime(maxTime)})`;
    announce(msg);
    gotoTimeInput.setAttribute('aria-invalid', 'true');
    setTimeout(() => gotoTimeInput.removeAttribute('aria-invalid'), 3000);
  }
}

submitGotoBtn.addEventListener('click', submitGotoHandler);
gotoTimeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitGotoHandler();
  }
});

// --- CAPTURE SCREENSHOT CONTROLLER ---
function triggerScreenshot() {
  if (!currentFilePath) return announce('No media loaded to capture');
  if (!mediaPlayer.videoWidth) return announce('Cannot capture a screenshot: no video picture is showing');
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = mediaPlayer.videoWidth;
    canvas.height = mediaPlayer.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mediaPlayer, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    
    // Send standard screenshot event to the main electron process to save
    ipcRenderer.invoke('save-screenshot', dataUrl).then(saved => announce(saved ? 'Screenshot saved' : 'Screenshot not saved'));
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    announce('Screenshot capture failed');
  }
}

screenshotBtn.addEventListener('click', () => triggerScreenshot());

// --- PLAYBACK SPEED CONTROL ---
function updateSpeedUI() {
  if (!speedLabelVal) return;
  const rate = mediaPlayer.playbackRate;
  speedLabelVal.textContent = `${formatRate(rate)}x`;
  // Keep the main bottom-bar speed button in sync, and snap the discrete
  // index to the nearest known preset so the cycle button stays consistent.
  if (speedBtn) {
    speedBtn.textContent = `${formatRate(rate)}x`;
    speedBtn.setAttribute('aria-label', `Playback speed ${formatRate(rate)} times`);
  }
  let nearest = 0, nearestDist = Infinity;
  speeds.forEach((s, i) => {
    const d = Math.abs(s - rate);
    if (d < nearestDist) { nearestDist = d; nearest = i; }
  });
  currentSpeedIndex = nearest;
  if (speedSelectPreset) {
    speedSelectPreset.selectedIndex = Array.from(speedSelectPreset.options).findIndex(o => Math.abs(parseFloat(o.value) - rate) < 0.005);
  }
}

if (speedMinusBtn) {
  speedMinusBtn.addEventListener('click', () => {
    setPlaybackRate(mediaPlayer.playbackRate - 0.1);
  });
}
if (speedPlusBtn) {
  speedPlusBtn.addEventListener('click', () => {
    setPlaybackRate(mediaPlayer.playbackRate + 0.1);
  });
}
if (speedResetBtn) {
  speedResetBtn.addEventListener('click', () => setPlaybackRate(1));
}
if (speedSelectPreset) {
  speedSelectPreset.addEventListener('change', (e) => {
    setPlaybackRate(parseFloat(e.target.value));
  });
}

// --- ADVANCED AUDIO EQ PRESETS ---
const eqPresets = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  classical: [5, 4, 3, 2, -1, -1, 0, 2, 4, 5],
  club: [0, 0, 2, 4, 4, 3, 2, 0, 0, 0],
  dance: [4, 6, 5, 0, 1, 3, 5, 4, 0, 0],
  "full-bass": [8, 8, 7, 5, 0, -2, -4, -6, -8, -8],
  "full-treble": [-8, -8, -6, -4, -2, 0, 3, 6, 8, 8],
  live: [-2, 0, 2, 3, 3, 3, 2, 1, 1, 1],
  pop: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
  rock: [6, 4, -2, -4, -1, 1, 4, 6, 7, 7],
  vocal: [-5, -4, -2, 2, 5, 5, 4, 2, 0, -2]
};

if (eqPresetSelect) {
  eqPresetSelect.addEventListener('change', (e) => {
    const preset = eqPresets[e.target.value];
    if (preset) {
      initAudio();
      preset.forEach((gain, idx) => {
        if (eqFilters[idx]) eqFilters[idx].gain.value = gain;
        const sliders = eqBandsContainer ? eqBandsContainer.querySelectorAll('.eq-slider') : [];
        if (sliders[idx]) { sliders[idx].value = gain; sliders[idx].dispatchEvent(new Event('input')); }
      });
      announce(`Equalizer preset set to ${e.target.value}`);
    }
  });
}

function addToHistory(filePath) {
  if (!filePath) return;
  let history = loadState('history', []);
  const normPath = normalizePath(filePath);
  history = history.filter(h => normalizePath(h) !== normPath);
  history.unshift(filePath);
  history = history.slice(0, 12);
  saveState('history', history);
}

// Save resume position periodically
setInterval(saveResumeState, 3000);
window.addEventListener('beforeunload', saveResumeState);

// Initial Setup
volumeSlider.style.background = `linear-gradient(to right, var(--text-color) 100%, rgba(255,255,255,0.3) 100%)`;
progressSlider.style.background = `linear-gradient(to right, var(--focus-color) 0%, rgba(255,255,255,0.3) 0%)`;

// --- RESUME ON LAUNCH ---
(function resumeOnLaunch() {
  const startInHome = loadState('startInHome', false);
  if (startInHome) return; // Home/recent screen shows instead; nothing auto-plays

  // Resume only if the app was closed less than 30 minutes ago; otherwise
  // forget the previous clip and show the home/blank screen.
  const RESUME_TTL = 30 * 60 * 1000;
  const resume = loadState('resume', null);
  if (resume && resume.file && loadState('resumeEnabled', true)) {
    const age = resume.savedAt ? Date.now() - resume.savedAt : Infinity;
    const stillThere = isUrl(resume.file) || ampNative.fileExists(resume.file);
    if (age <= RESUME_TTL && stillThere) {
      addToPlaylist(resume.file);
      currentPlaylistIndex = 0;
      // Load once, directly to the resume position. Do NOT call playPlaylistItem
      // again — that reloads the media without a seek and loses the resume time.
      loadMedia(resume.file, resume.time || 0);
      renderPlaylist();
      return;
    } else {
      saveState('resume', null); // expired: drop the previous clip
    }
  }
  // No valid resume -> the home/blank screen is shown by features.js
})();
