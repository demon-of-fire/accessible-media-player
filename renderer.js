const { ipcRenderer } = require('electron');

const mediaPlayer = document.getElementById('media-player');
const videoWrapper = document.getElementById('video-wrapper');
const topBar = document.getElementById('top-bar');
const controlsOverlay = document.getElementById('controls-overlay');
const liveRegion = document.getElementById('live-region');
const centerIconOverlay = document.getElementById('center-icon-overlay');
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
const createPlaylistBtn = document.getElementById('create-playlist-btn');

// Builder Modal Elements
const createPlaylistModal = document.getElementById('create-playlist-modal');
const closeBuilderBtn = document.getElementById('close-builder-btn');
const builderAddFilesBtn = document.getElementById('builder-add-files-btn');
const builderSaveBtn = document.getElementById('builder-save-btn');
const builderFileList = document.getElementById('builder-file-list');
let builderFiles = [];

const progressSlider = document.getElementById('progress-slider');
const volumeSlider = document.getElementById('volume-slider');
const timeDisplay = document.getElementById('time-display');

// Icons
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const centerPlayIcon = document.getElementById('center-play-icon');
const centerPauseIcon = document.getElementById('center-pause-icon');
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
const videoFilters = document.querySelectorAll('.video-filter');
const brightnessSlider = document.getElementById('brightness-slider');
const contrastSlider = document.getElementById('contrast-slider');
const saturationSlider = document.getElementById('saturation-slider');
const videoResetBtn = document.getElementById('video-reset-btn');

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
const hueSlider = document.getElementById('hue-slider');
const hueVal = document.getElementById('hue-val');
const blurSlider = document.getElementById('blur-slider');
const blurVal = document.getElementById('blur-val');
const echoEffectToggle = document.getElementById('echo-effect-toggle');

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

const aspectRatioSelect = document.getElementById('aspect-ratio-select');
const zoomSelect = document.getElementById('zoom-select');
const frameBackBtn = document.getElementById('frame-back-btn');
const frameForwardBtn = document.getElementById('frame-forward-btn');

const eqPresetSelect = document.getElementById('eq-preset-select');
const visualizerThemeSelect = document.getElementById('visualizer-theme-select');
const visualizerCanvas = document.getElementById('visualizer-canvas');

const toggleInfoBtn = document.getElementById('toggle-info-btn');
const mediaInfoPanel = document.getElementById('media-info-panel');
const infoResolution = document.getElementById('info-resolution');
const infoAspect = document.getElementById('info-aspect');
const infoFormat = document.getElementById('info-format');
const infoPreamp = document.getElementById('info-preamp');
const infoBalance = document.getElementById('info-balance');

const historySidebarList = document.getElementById('history-sidebar-list');

let pannerNode = null;
let currentSubtitleTrack = null;
let analyserNode = null; // Web Audio Analyser
let visualizerCtx = null;
let visualizerAnimationId = null;

// Starfield nebula particles state
let stars = [];

// State
let isSeeking = false;
let isLooping = false;
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
const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
let currentFilePath = null;

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
    saveState('resume', { file: currentFilePath, time: mediaPlayer.currentTime });
  }
}

// --- Web Audio API (EQ & Volume Boost) ---
let audioCtx = null;
let sourceNode = null;
let gainNode = null;
const eqFilters = [];
const eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

let echoDelayNode = null;
let echoFeedbackGain = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create nodes
  sourceNode = audioCtx.createMediaElementSource(mediaPlayer);
  gainNode = audioCtx.createGain();
  pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  
  let prevNode = sourceNode;
  
  eqFrequencies.forEach(freq => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.0;
    filter.gain.value = 0; // default 0 dB
    eqFilters.push(filter);
    
    prevNode.connect(filter);
    prevNode = filter;
  });
  
  if (pannerNode) {
    prevNode.connect(pannerNode);
    prevNode = pannerNode;
  }
  
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 256;
  prevNode.connect(analyserNode);
  prevNode = analyserNode;
  
  // Concert Reverb Echo Delay feedback loop setup
  echoDelayNode = audioCtx.createDelay(2.0);
  echoDelayNode.delayTime.value = 0.35; // 350ms concert hall delay time
  
  echoFeedbackGain = audioCtx.createGain();
  echoFeedbackGain.gain.value = 0; // muted by default
  
  // Connect Echo path in parallel with the direct signal
  analyserNode.connect(echoDelayNode);
  echoDelayNode.connect(echoFeedbackGain);
  echoFeedbackGain.connect(echoDelayNode); // feedback to delay node
  echoFeedbackGain.connect(gainNode); // feed into output gain node
  
  prevNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  // Start the high fidelity visualizer loop!
  startVisualizerLoop();
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
  
  slider.addEventListener('input', (e) => {
    if (eqFilters[index]) eqFilters[index].gain.value = e.target.value;
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

if (echoEffectToggle) {
  echoEffectToggle.addEventListener('change', (e) => {
    initAudio(); // Activate AudioContext if needed
    if (audioCtx && echoFeedbackGain) {
      if (e.target.checked) {
        // Concert-hall style reverb setup
        echoFeedbackGain.gain.setTargetAtTime(0.45, audioCtx.currentTime, 0.05);
        announce('Concert Room Reverb Echo Effect enabled');
      } else {
        // Disabled setup
        echoFeedbackGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.05);
        announce('Concert Room Reverb Echo Effect disabled');
      }
    }
  });
}

let previousFocus = null;

function toggleSettingsModal() {
  if (settingsModal.style.display === 'none' || settingsModal.style.display === '') {
    previousFocus = document.activeElement;
    settingsModal.style.display = 'flex';
    settingsModal.setAttribute('aria-hidden', 'false');
    announce('Settings opened');
    
    // Set focus to the first interactive element so screen readers jump right into it
    const firstTab = settingsModal.querySelector('.tab-btn');
    if (firstTab) firstTab.focus();
    else closeSettingsBtn.focus();
  } else {
    settingsModal.style.display = 'none';
    settingsModal.setAttribute('aria-hidden', 'true');
    announce('Settings closed');
    if (previousFocus) previousFocus.focus();
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
    });
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.dataset.target).style.display = 'block';
    announce(`Switched to ${btn.textContent} settings`);
  });
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
  announce('Audio settings reset to default');
});

// Video Filters Logic
function updateVideoFilters() {
  const b = brightnessSlider.value;
  const c = contrastSlider.value;
  const s = saturationSlider.value;
  const h = hueSlider ? hueSlider.value : 0;
  const blurValNum = blurSlider ? blurSlider.value : 0;
  
  mediaPlayer.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${blurValNum}px)`;
  
  const bValSpan = document.getElementById('brightness-val');
  const cValSpan = document.getElementById('contrast-val');
  const sValSpan = document.getElementById('saturation-val');
  
  if (bValSpan) bValSpan.textContent = b;
  if (cValSpan) cValSpan.textContent = c;
  if (sValSpan) sValSpan.textContent = s;
  if (hueVal) hueVal.textContent = h;
  if (blurVal) blurVal.textContent = blurValNum;
}

videoFilters.forEach(slider => slider.addEventListener('input', updateVideoFilters));

if (hueSlider) hueSlider.addEventListener('input', updateVideoFilters);
if (blurSlider) blurSlider.addEventListener('input', updateVideoFilters);

videoResetBtn.addEventListener('click', () => {
  brightnessSlider.value = 100;
  contrastSlider.value = 100;
  saturationSlider.value = 100;
  if (hueSlider) hueSlider.value = 0;
  if (blurSlider) blurSlider.value = 0;
  updateVideoFilters();
  announce('Video filters reset');
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
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (currentSubtitleTrack) currentSubtitleTrack.remove();
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = file.name;
      track.srclang = 'en';
      track.src = URL.createObjectURL(file);
      track.default = true;
      mediaPlayer.appendChild(track);
      currentSubtitleTrack = track;
      announce(`Subtitles loaded: ${file.name}`);
    }
  };
  input.click();
});
clearSubsBtn.addEventListener('click', () => {
  if (currentSubtitleTrack) currentSubtitleTrack.remove();
  currentSubtitleTrack = null;
  announce('Subtitles cleared');
});

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
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
function getFileName(filePath) {
  return filePath.split('\\').pop().split('/').pop();
}
function isAudioFile(filePath) {
  const ext = filePath.slice((filePath.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  return audioExts.includes('.' + ext);
}

// --- IDLE / AUTO-HIDE CONTROLS ---
function resetIdleTimer() {
  topBar.classList.add('active');
  controlsOverlay.classList.add('active');
  videoWrapper.classList.remove('hide-cursor');
  
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    if (!mediaPlayer.paused && !controlsOverlay.matches(':hover') && !topBar.matches(':hover')) {
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

// Center Animation
function showCenterAnimation(action) {
  centerIconOverlay.classList.remove('animate');
  void centerIconOverlay.offsetWidth;
  centerPlayIcon.style.display = action === 'play' ? 'block' : 'none';
  centerPauseIcon.style.display = action === 'pause' ? 'block' : 'none';
  centerIconOverlay.classList.add('animate');
}

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

  currentFilePath = filePath;
  mediaPlayer.src = `file://${filePath}`;
  titleDisplay.textContent = getFileName(filePath);
  mediaPlayer.load();
  
  if (seekTo && seekTo > 0) {
    mediaPlayer.addEventListener('loadedmetadata', function onMeta() {
      mediaPlayer.currentTime = seekTo;
      mediaPlayer.removeEventListener('loadedmetadata', onMeta);
    });
  }
  
  mediaPlayer.play();
  
  // Show visualizer if audio file
  if (isAudioFile(filePath)) {
    audioVisualizer.style.display = 'flex';
    audioVisualizer.setAttribute('aria-hidden', 'false');
  } else {
    audioVisualizer.style.display = 'none';
    audioVisualizer.setAttribute('aria-hidden', 'true');
  }
  
  // Save resume state, update bookmarks display, history and media info
  saveState('resume', { file: filePath, time: 0 });
  renderBookmarks();
  addToHistory(filePath);
  
  mediaPlayer.playbackRate = 1.0;
  updateSpeedUI();
  updateMediaInfo();
  
  mediaPlayer.addEventListener('loadedmetadata', function onMetadataInfo() {
    updateMediaInfo();
    mediaPlayer.removeEventListener('loadedmetadata', onMetadataInfo);
  });
  
  announce(`Loaded and playing: ${titleDisplay.textContent}`);
}

function togglePlay() {
  if (!mediaPlayer.src || mediaPlayer.src.endsWith('index.html')) return;
  if (mediaPlayer.paused) mediaPlayer.play();
  else mediaPlayer.pause();
}

mediaPlayer.addEventListener('play', () => {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
  playBtn.setAttribute('aria-label', 'Pause');
  playBtn.setAttribute('aria-pressed', 'true');
  showCenterAnimation('play');
  announce('Play pressed, Playing');
  resetIdleTimer();
});

mediaPlayer.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  playBtn.setAttribute('aria-label', 'Play');
  playBtn.setAttribute('aria-pressed', 'false');
  showCenterAnimation('pause');
  announce('Pause pressed, Paused');
  resetIdleTimer();
});

playBtn.addEventListener('click', togglePlay);
videoWrapper.addEventListener('click', (e) => {
  if (e.target === videoWrapper || e.target === mediaPlayer || e.target === audioVisualizer) {
    togglePlay();
  }
});

// Fullscreen double click
videoWrapper.addEventListener('dblclick', (e) => {
  if (e.target === videoWrapper || e.target === mediaPlayer || e.target === audioVisualizer) {
    toggleFullscreen();
  }
});

rewindBtn.addEventListener('click', () => {
  mediaPlayer.currentTime = Math.max(0, mediaPlayer.currentTime - 10);
  announce(`Rewound 10s`);
});
forwardBtn.addEventListener('click', () => {
  mediaPlayer.currentTime = Math.min(mediaPlayer.duration, mediaPlayer.currentTime + 10);
  announce(`Forwarded 10s`);
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
mediaPlayer.addEventListener('timeupdate', () => {
  if (abStart !== null && abEnd !== null) {
    if (mediaPlayer.currentTime >= abEnd) {
      mediaPlayer.currentTime = abStart;
    }
  }
  if (!mediaPlayer.duration || isSeeking) return;
  const progress = (mediaPlayer.currentTime / mediaPlayer.duration) * 100;
  progressSlider.style.background = `linear-gradient(to right, var(--focus-color) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`;
  progressSlider.value = progress;
  progressSlider.setAttribute('aria-valuenow', Math.round(progress));
  progressSlider.setAttribute('aria-valuetext', `${formatTime(mediaPlayer.currentTime)} of ${formatTime(mediaPlayer.duration)}`);
  timeDisplay.textContent = `${formatTime(mediaPlayer.currentTime)} / ${formatTime(mediaPlayer.duration)}`;
});

progressSlider.addEventListener('mousedown', () => isSeeking = true);
progressSlider.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
    isSeeking = true;
  }
});
progressSlider.addEventListener('input', (e) => {
  if (!mediaPlayer.duration) return;
  isSeeking = true; // Safe fallback for keyboard triggers
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
progressSlider.addEventListener('change', finishSeek);
progressSlider.addEventListener('mouseup', finishSeek);
progressSlider.addEventListener('keyup', finishSeek);

// Volume & Mute
volumeSlider.addEventListener('input', (e) => {
  mediaPlayer.volume = e.target.value / 100;
  mediaPlayer.muted = false;
  updateVolumeUI();
});
muteBtn.addEventListener('click', () => {
  mediaPlayer.muted = !mediaPlayer.muted;
  updateVolumeUI();
  muteBtn.setAttribute('aria-pressed', mediaPlayer.muted);
  announce(mediaPlayer.muted ? 'Mute pressed, muted' : 'Mute unpressed, unmuted');
});
function updateVolumeUI() {
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
  mediaPlayer.playbackRate = speeds[currentSpeedIndex];
  speedBtn.textContent = `${speeds[currentSpeedIndex]}x`;
  announce(`Speed ${speeds[currentSpeedIndex]}x`);
});

// Loop Control
loopBtn.addEventListener('click', () => {
  isLooping = !isLooping;
  mediaPlayer.loop = isLooping;
  loopBtn.style.color = isLooping ? 'var(--focus-color)' : 'var(--text-color)';
  loopBtn.setAttribute('aria-pressed', isLooping);
  announce(isLooping ? 'Loop pressed, repeating on' : 'Loop unpressed, repeating off');
});

// PiP Control
pipBtn.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      pipBtn.setAttribute('aria-pressed', 'false');
      announce('PIP unpressed, picture in picture exited');
    } else if (document.pictureInPictureEnabled && mediaPlayer.readyState !== 0) {
      await mediaPlayer.requestPictureInPicture();
      pipBtn.setAttribute('aria-pressed', 'true');
      announce('PIP pressed, picture in picture started');
    }
  } catch (err) {
    console.error(err);
  }
});

// Fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}
fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  fullscreenBtn.setAttribute('aria-pressed', isFs);
  if (isFs) {
    fsEnterIcon.style.display = 'none';
    fsExitIcon.style.display = 'block';
    announce('Fullscreen pressed, entered fullscreen');
  } else {
    fsEnterIcon.style.display = 'block';
    fsExitIcon.style.display = 'none';
    announce('Fullscreen unpressed, exited fullscreen');
  }
});

// --- FILE OPEN & PLAYLIST ---
async function openFilesHandler() {
  const filePaths = await ipcRenderer.invoke('open-file-dialog');
  if (filePaths && filePaths.length > 0) {
    filePaths.forEach(p => addToPlaylist(p));
    if (currentPlaylistIndex === -1 || playlist.length === filePaths.length) {
      playPlaylistItem(playlist.length - filePaths.length);
    }
  }
}

let previousPlaylistFocus = null;

// --- PATH NORMALIZATION FOR SECURE BOOKMARK SCOPING ---
function normalizePath(filePath) {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/').toLowerCase().trim();
}

// --- SIDEBAR TOGGLES ---
function togglePlaylistSidebar() {
  const isOpen = playlistSidebar.classList.contains('open');
  if (isOpen) {
    playlistSidebar.classList.remove('open');
    playlistSidebar.setAttribute('aria-hidden', 'true');
    announce('Playlist sidebar closed');
    if (previousPlaylistFocus) previousPlaylistFocus.focus();
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
    bookmarksSidebar.classList.remove('open');
    bookmarksSidebar.setAttribute('aria-hidden', 'true');
    announce('Bookmarks sidebar closed');
    if (previousBookmarksFocus) previousBookmarksFocus.focus();
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
    moreOptionsSidebar.classList.remove('open');
    moreOptionsSidebar.setAttribute('aria-hidden', 'true');
    announce('More Options sidebar closed');
    if (previousMoreOptionsFocus) previousMoreOptionsFocus.focus();
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
  if (!playlist.includes(filePath)) {
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

function playNext() {
  if (playlist.length > 0) {
    if (shuffleToggle && shuffleToggle.checked && playlist.length > 1) {
      let nextIndex = Math.floor(Math.random() * playlist.length);
      if (nextIndex === currentPlaylistIndex) {
        nextIndex = (nextIndex + 1) % playlist.length;
      }
      playPlaylistItem(nextIndex);
    } else if (currentPlaylistIndex < playlist.length - 1) {
      playPlaylistItem(currentPlaylistIndex + 1);
    }
  }
}

function playPrev() {
  if (playlist.length > 0 && currentPlaylistIndex > 0) {
    playPlaylistItem(currentPlaylistIndex - 1);
  } else if (currentPlaylistIndex === 0) {
    mediaPlayer.currentTime = 0; // Just restart if it's the first track
  }
}

nextTrackBtn.addEventListener('click', playNext);
prevTrackBtn.addEventListener('click', playPrev);

function renderPlaylist() {
  playlistItems.innerHTML = '';
  playlist.forEach((path, i) => {
    const li = document.createElement('li');
    li.className = `playlist-item ${i === currentPlaylistIndex ? 'playing' : ''}`;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.textContent = getFileName(path);
    li.setAttribute('aria-label', `Play ${getFileName(path)}`);
    li.onclick = () => playPlaylistItem(i);
    li.onkeydown = (e) => { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        playPlaylistItem(i); 
      } 
    };
    playlistItems.appendChild(li);
  });
}

clearPlaylistBtn.addEventListener('click', () => {
  playlist = [];
  currentPlaylistIndex = -1;
  renderPlaylist();
});

mediaPlayer.addEventListener('ended', () => {
  if (isLooping) return;
  if (autoplayToggle && autoplayToggle.checked) {
    playNext();
  }
});

// Save & Load Playlist
savePlaylistBtn.addEventListener('click', async () => {
  if (playlist.length === 0) return announce("Playlist empty.");
  const success = await ipcRenderer.invoke('save-playlist', playlist);
  if (success) announce('Playlist saved successfully');
});

// Create Playlist Builder Modal Logic
let previousBuilderFocus = null;
function toggleBuilderModal() {
  if (createPlaylistModal.style.display === 'none' || createPlaylistModal.style.display === '') {
    previousBuilderFocus = document.activeElement;
    createPlaylistModal.style.display = 'flex';
    createPlaylistModal.setAttribute('aria-hidden', 'false');
    announce('Playlist builder opened');
    if (builderAddFilesBtn) builderAddFilesBtn.focus();
  } else {
    createPlaylistModal.style.display = 'none';
    createPlaylistModal.setAttribute('aria-hidden', 'true');
    announce('Playlist builder closed');
    if (previousBuilderFocus) previousBuilderFocus.focus();
  }
}
closeBuilderBtn.addEventListener('click', toggleBuilderModal);

createPlaylistModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    toggleBuilderModal();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = Array.from(createPlaylistModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
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

function renderBuilderList() {
  builderFileList.innerHTML = '';
  if (builderFiles.length === 0) {
    builderFileList.innerHTML = '<li style="padding: 15px; color: #888; text-align: center;">No files added yet.</li>';
    return;
  }
  builderFiles.forEach((path, i) => {
    const li = document.createElement('li');
    li.className = 'builder-item';
    
    const span = document.createElement('span');
    span.textContent = getFileName(path);
    span.title = path;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'builder-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.setAttribute('aria-label', `Remove ${getFileName(path)}`);
    removeBtn.onclick = () => {
      builderFiles.splice(i, 1);
      renderBuilderList();
      announce(`Removed ${getFileName(path)}`);
      if (builderAddFilesBtn) builderAddFilesBtn.focus();
    };
    
    li.appendChild(span);
    li.appendChild(removeBtn);
    builderFileList.appendChild(li);
  });
}

createPlaylistBtn.addEventListener('click', () => {
  builderFiles = [];
  renderBuilderList();
  toggleBuilderModal();
});

builderAddFilesBtn.addEventListener('click', async () => {
  const filePaths = await ipcRenderer.invoke('open-file-dialog');
  if (filePaths && filePaths.length > 0) {
    builderFiles = builderFiles.concat(filePaths);
    renderBuilderList();
    announce(`Added ${filePaths.length} files to builder`);
  }
});

builderSaveBtn.addEventListener('click', async () => {
  if (builderFiles.length === 0) {
    announce('No files to save. Please add files first.');
    return;
  }
  const success = await ipcRenderer.invoke('save-playlist', builderFiles);
  if (success) {
    announce('New playlist created and saved successfully');
    toggleBuilderModal();
  } else {
    announce('Playlist creation cancelled');
  }
});

loadPlaylistBtn.addEventListener('click', async () => {
  const loaded = await ipcRenderer.invoke('open-playlist');
  if (loaded && Array.isArray(loaded)) {
    playlist = loaded;
    currentPlaylistIndex = -1;
    renderPlaylist();
    if (playlist.length > 0) playPlaylistItem(0);
  }
});

// --- DRAG AND DROP ---
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dragOverlay.classList.add('drag-active');
});
document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragOverlay.classList.remove('drag-active');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragOverlay.classList.remove('drag-active');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    for(let f of files) addToPlaylist(f.path);
    if (currentPlaylistIndex === -1) {
      playPlaylistItem(playlist.length - files.length); 
    }
  }
});

// --- KEYBOARD SHORTCUTS ---
window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  if (!activeEl) return;
  const activeTag = activeEl.tagName.toLowerCase();
  
  const isTextInput = activeTag === 'input' && (activeEl.type === 'text' || activeEl.type === 'number');
  const isSlider = activeTag === 'input' && activeEl.type === 'range';
  const isSelect = activeTag === 'select';
  const isButton = activeTag === 'button';
  const isListItem = activeTag === 'li' || activeEl.classList.contains('playlist-item') || activeEl.classList.contains('bookmark-item');
  
  // 1. Text input takes total precedence
  if (isTextInput) {
    if (e.key === 'Escape') {
      return; // Allow Escape to close modals
    }
    return; // Let text input handle all keystrokes
  }
  
  // 2. Prevent global shortcut interference for focused interactive elements
  if (isButton && (e.key === ' ' || e.key === 'Enter')) {
    return;
  }
  if (isSlider && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow'))) {
    return;
  }
  if (isSelect && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow'))) {
    return;
  }
  if (isListItem && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow'))) {
    return;
  }

  // Ctrl+O to open files
  if (e.ctrlKey && e.key.toLowerCase() === 'o') { 
    e.preventDefault(); 
    openFilesHandler(); 
    return; 
  }
  
  // Ctrl+G to go to time
  if (e.ctrlKey && e.key.toLowerCase() === 'g') { 
    e.preventDefault(); 
    openGotoModal(); 
    return; 
  }

  // Shift+ArrowUp / Shift+ArrowDown for speed adjustments (Speed Shift+Arrows)
  if (e.shiftKey && e.key === 'ArrowUp') {
    e.preventDefault();
    mediaPlayer.playbackRate = Math.min(4.0, mediaPlayer.playbackRate + 0.1);
    updateSpeedUI();
    announce(`Playback speed set to ${mediaPlayer.playbackRate.toFixed(1)}x`);
    return;
  }
  if (e.shiftKey && e.key === 'ArrowDown') {
    e.preventDefault();
    mediaPlayer.playbackRate = Math.max(0.1, mediaPlayer.playbackRate - 0.1);
    updateSpeedUI();
    announce(`Playback speed set to ${mediaPlayer.playbackRate.toFixed(1)}x`);
    return;
  }

  // Shift+B to add bookmark
  if (e.key.toLowerCase() === 'b' && e.shiftKey) {
    e.preventDefault();
    addBookmarkAtCurrentTime();
    return;
  }

  // Block general shortcuts if Ctrl or Alt modifier is held to prevent conflicts (e.g. Ctrl+S)
  if (e.ctrlKey || e.altKey) {
    return;
  }
  
  // B to toggle bookmarks sidebar (plain B key only, no modifiers)
  if (e.key.toLowerCase() === 'b' && !e.shiftKey) {
    e.preventDefault();
    toggleBookmarksSidebar();
    return;
  }

  switch(e.key.toLowerCase()) {
    case ' ': 
      e.preventDefault(); 
      togglePlay(); 
      break;
    case 'f': 
      e.preventDefault(); 
      toggleFullscreen(); 
      break;
    case 'm': 
      e.preventDefault(); 
      muteBtn.click(); 
      break;
    case 'l': 
      e.preventDefault(); 
      loopBtn.click(); 
      break;
    case 'p': 
      e.preventDefault(); 
      pipBtn.click(); 
      break;
    case 'q': 
      e.preventDefault(); 
      togglePlaylistSidebar(); 
      break;
    case 'o':
      e.preventDefault();
      toggleMoreOptionsSidebar();
      break;
    case 'e': 
      e.preventDefault(); 
      toggleSettingsModal(); 
      break;
    case 's': 
      e.preventDefault(); 
      triggerScreenshot(); 
      break;
    case 'arrowleft': 
      e.preventDefault(); 
      rewindBtn.click(); 
      break;
    case 'arrowright': 
      e.preventDefault(); 
      forwardBtn.click(); 
      break;
    case 'arrowup': 
      e.preventDefault(); 
      volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 10);
      volumeSlider.dispatchEvent(new Event('input'));
      break;
    case 'arrowdown':
      e.preventDefault();
      volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 10);
      volumeSlider.dispatchEvent(new Event('input'));
      break;
  }
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
    bookmarksSidebarList.innerHTML = '<li style="padding: 15px; color: #888; text-align: center; font-size: 0.9rem;">No bookmarks yet. Press Shift+B or use the button above to add one.</li>';
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
    marker.onclick = (e) => {
      e.stopPropagation(); // prevent seekbar trigger
      mediaPlayer.currentTime = bm.time;
      announce(`Jumped to bookmark: ${bm.label}`);
    };
    progressSlider.parentElement.appendChild(marker);
  });
}

mediaPlayer.addEventListener('loadedmetadata', () => {
  renderBookmarkMarkers();
});

if (sidebarAddBookmarkBtn) sidebarAddBookmarkBtn.addEventListener('click', addBookmarkAtCurrentTime);
if (mainAddBookmarkBtn) mainAddBookmarkBtn.addEventListener('click', addBookmarkAtCurrentTime);

// --- A-B LOOP CONTROLLER ---
setPointABtn.addEventListener('click', () => {
  if (!currentFilePath) return announce('No media loaded');
  abStart = mediaPlayer.currentTime;
  abStartLabel.textContent = `Start (A): ${formatTime(abStart)}`;
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
sleepTimerSelect.addEventListener('change', (e) => {
  if (sleepInterval) clearInterval(sleepInterval);
  const val = e.target.value;
  if (val === 'off') {
    sleepCountdown.style.display = 'none';
    announce('Sleep timer disabled');
    return;
  }
  let timeRemaining = parseInt(val) * 60; // seconds
  sleepCountdown.style.display = 'inline';
  
  const updateTimer = () => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    sleepCountdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timeRemaining <= 0) {
      clearInterval(sleepInterval);
      mediaPlayer.pause();
      sleepCountdown.style.display = 'none';
      sleepTimerSelect.value = 'off';
      announce('Sleep timer elapsed. Playback paused.');
    }
    timeRemaining--;
  };
  
  updateTimer();
  sleepInterval = setInterval(updateTimer, 1000);
  announce(`Sleep timer set for ${val} minutes`);
});

// --- SUBTITLE DELAY CONTROL ---
function updateSubtitleDelay(seconds) {
  subtitleOffset += seconds;
  subDelayVal.textContent = `${subtitleOffset >= 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`;
  
  if (mediaPlayer.textTracks && mediaPlayer.textTracks.length > 0) {
    for (let i = 0; i < mediaPlayer.textTracks.length; i++) {
      const track = mediaPlayer.textTracks[i];
      if (track.cues) {
        for (let j = 0; j < track.cues.length; j++) {
          const cue = track.cues[j];
          cue.startTime += seconds;
          cue.endTime += seconds;
        }
      }
    }
  }
  announce(`Subtitle delay offset shifted by ${seconds}s`);
}

subDelayMinus.addEventListener('click', () => updateSubtitleDelay(-0.5));
subDelayPlus.addEventListener('click', () => updateSubtitleDelay(0.5));
subDelayReset.addEventListener('click', () => {
  const diff = -subtitleOffset;
  updateSubtitleDelay(diff);
  subtitleOffset = 0;
  subDelayVal.textContent = '0.0s';
  announce('Subtitle delay reset to default');
});

// --- GO TO TIME CONTROLLER ---
function openGotoModal() {
  gotoModal.style.display = 'flex';
  gotoModal.setAttribute('aria-hidden', 'false');
  gotoTimeInput.value = '';
  gotoTimeInput.focus();
}

function closeGotoModal() {
  gotoModal.style.display = 'none';
  gotoModal.setAttribute('aria-hidden', 'true');
}

gotoTimeBtn.addEventListener('click', openGotoModal);
closeGotoBtn.addEventListener('click', closeGotoModal);

function submitGotoHandler() {
  const input = gotoTimeInput.value.trim();
  if (!input) return;
  
  let targetSeconds = null;
  const parts = input.split(':').map(Number);
  
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    targetSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    targetSeconds = parts[0];
  }
  
  if (targetSeconds !== null && targetSeconds >= 0 && targetSeconds <= (mediaPlayer.duration || Infinity)) {
    mediaPlayer.currentTime = targetSeconds;
    announce(`Jumped to time ${input}`);
    closeGotoModal();
  } else {
    announce('Invalid time format');
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
  if (isAudioFile(currentFilePath)) return announce('Cannot capture screenshots of audio files');
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = mediaPlayer.videoWidth;
    canvas.height = mediaPlayer.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mediaPlayer, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    
    // Send standard screenshot event to the main electron process to save
    ipcRenderer.send('save-screenshot', dataUrl);
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    announce('Screenshot capture failed');
  }
}

screenshotBtn.addEventListener('click', triggerScreenshot);

// --- PLAYBACK SPEED CONTROL ---
function updateSpeedUI() {
  if (!speedLabelVal) return;
  const rate = mediaPlayer.playbackRate;
  speedLabelVal.textContent = `${rate.toFixed(1)}x`;
  if (speedSelectPreset) {
    speedSelectPreset.value = ['0.25', '0.5', '0.75', '1.0', '1.25', '1.5', '1.75', '2.0', '3.0'].includes(rate.toFixed(1)) ? rate.toFixed(1) : rate.toString();
  }
}

if (speedMinusBtn) {
  speedMinusBtn.addEventListener('click', () => {
    mediaPlayer.playbackRate = Math.max(0.1, mediaPlayer.playbackRate - 0.1);
    updateSpeedUI();
  });
}
if (speedPlusBtn) {
  speedPlusBtn.addEventListener('click', () => {
    mediaPlayer.playbackRate = Math.min(4.0, mediaPlayer.playbackRate + 0.1);
    updateSpeedUI();
  });
}
if (speedResetBtn) {
  speedResetBtn.addEventListener('click', () => {
    mediaPlayer.playbackRate = 1.0;
    updateSpeedUI();
  });
}
if (speedSelectPreset) {
  speedSelectPreset.addEventListener('change', (e) => {
    mediaPlayer.playbackRate = parseFloat(e.target.value);
    updateSpeedUI();
  });
}

// --- ASPECT RATIO & ZOOM TRANSFORMS ---
if (aspectRatioSelect) {
  aspectRatioSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    mediaPlayer.style.objectFit = val === 'stretch' ? 'fill' : 'contain';
    if (val === 'default') {
      mediaPlayer.style.aspectRatio = '';
      mediaPlayer.style.width = '100%';
      mediaPlayer.style.height = '100%';
    } else {
      mediaPlayer.style.aspectRatio = val.replace(':', '/');
    }
    announce(`Aspect Ratio set to ${val}`);
    updateMediaInfo();
  });
}

if (zoomSelect) {
  zoomSelect.addEventListener('change', (e) => {
    const scale = parseFloat(e.target.value);
    mediaPlayer.style.transform = `scale(${scale})`;
    announce(`Zoom level set to ${scale * 100}%`);
  });
}

// --- PRECISION FRAME STEPPING ---
function stepFrame(dir) {
  mediaPlayer.pause();
  // Standard video frame time approx 29.97 fps (0.033 seconds)
  const frameTime = 1 / 29.97;
  mediaPlayer.currentTime = Math.max(0, Math.min(mediaPlayer.duration || Infinity, mediaPlayer.currentTime + dir * frameTime));
  announce(`Stepped ${dir > 0 ? 'forward' : 'backward'} one frame`);
}

if (frameBackBtn) frameBackBtn.addEventListener('click', () => stepFrame(-1));
if (frameForwardBtn) frameForwardBtn.addEventListener('click', () => stepFrame(1));

// Frame Stepping Key Bindings (comma and period)
window.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  if (e.key === '.') {
    e.preventDefault();
    stepFrame(1);
  } else if (e.key === ',') {
    e.preventDefault();
    stepFrame(-1);
  }
});

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
        if (sliders[idx]) sliders[idx].value = gain;
      });
      announce(`Equalizer preset set to ${e.target.value}`);
      updateMediaInfo();
    }
  });
}

// --- HIGH FIDELITY AUDIO VISUALIZER DRAW LOOP ---
function startVisualizerLoop() {
  if (!visualizerCanvas) return;
  visualizerCtx = visualizerCanvas.getContext('2d');
  
  function resizeCanvas() {
    visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth || 800;
    visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight || 450;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 128;
  const dataArray = new Uint8Array(bufferLength);

  // Nebula cosmic particles
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() - 0.5,
      y: Math.random() - 0.5,
      z: Math.random(),
      color: `hsl(${Math.random() * 360}, 85%, 65%)`
    });
  }

  function draw() {
    visualizerAnimationId = requestAnimationFrame(draw);
    if (!analyserNode || audioVisualizer.style.display === 'none') return;

    analyserNode.getByteFrequencyData(dataArray);
    
    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;
    const theme = visualizerThemeSelect ? visualizerThemeSelect.value : 'spectrum';

    // Dark trails
    visualizerCtx.fillStyle = 'rgba(10, 10, 10, 0.18)';
    visualizerCtx.fillRect(0, 0, w, h);

    if (theme === 'spectrum') {
      const barWidth = (w / bufferLength) * 2.2;
      let barHeight;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * h * 0.75;
        const hue = (i / bufferLength) * 360;
        visualizerCtx.fillStyle = `hsl(${hue}, 90%, 55%)`;
        visualizerCtx.fillRect(x, h - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    } else if (theme === 'circle') {
      const centerX = w / 2;
      const centerY = h / 2;
      let baseRadius = Math.min(w, h) * 0.22;
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      baseRadius += (sum / bufferLength / 255) * 60;

      visualizerCtx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const offset = (dataArray[i] / 255) * 70;
        const r = baseRadius + offset;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) visualizerCtx.moveTo(x, y);
        else visualizerCtx.lineTo(x, y);
      }
      visualizerCtx.closePath();
      
      const grad = visualizerCtx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius * 1.6);
      grad.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
      grad.addColorStop(0.7, 'rgba(79, 172, 254, 0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      visualizerCtx.strokeStyle = '#4facfe';
      visualizerCtx.lineWidth = 3.5;
      visualizerCtx.stroke();
      visualizerCtx.fillStyle = grad;
      visualizerCtx.fill();
    } else if (theme === 'oscilloscope') {
      const timeData = new Uint8Array(bufferLength);
      analyserNode.getByteTimeDomainData(timeData);
      
      visualizerCtx.beginPath();
      visualizerCtx.lineWidth = 4;
      visualizerCtx.strokeStyle = '#00ffcc';
      visualizerCtx.shadowBlur = 12;
      visualizerCtx.shadowColor = '#00ffcc';

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) visualizerCtx.moveTo(x, y);
        else visualizerCtx.lineTo(x, y);
        x += sliceWidth;
      }
      visualizerCtx.lineTo(w, h / 2);
      visualizerCtx.stroke();
      visualizerCtx.shadowBlur = 0;
    } else if (theme === 'nebula') {
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avg = sum / bufferLength;
      const speed = 0.003 + (avg / 255) * 0.035;
      const sizeMult = 1.0 + (avg / 255) * 5.0;

      stars.forEach(star => {
        star.z -= speed;
        if (star.z <= 0) {
          star.z = 1.0;
          star.x = Math.random() - 0.5;
          star.y = Math.random() - 0.5;
        }
        const k = 400.0 / star.z;
        const px = star.x * k + w / 2;
        const py = star.y * k + h / 2;

        if (px >= 0 && px < w && py >= 0 && py < h) {
          const size = (1.0 - star.z) * 6.5 * sizeMult;
          visualizerCtx.beginPath();
          visualizerCtx.arc(px, py, Math.max(0.6, size), 0, Math.PI * 2);
          visualizerCtx.fillStyle = star.color;
          visualizerCtx.fill();
        }
      });
    }
  }
  draw();
}

// --- PLAYBACK QUEUE HISTORY IMPLEMENTATION ---
function addToHistory(filePath) {
  if (!filePath) return;
  let history = loadState('history', []);
  const normPath = normalizePath(filePath);
  history = history.filter(h => normalizePath(h) !== normPath);
  history.unshift(filePath);
  if (history.length > 5) history.pop();
  saveState('history', history);
  renderHistory();
}

function renderHistory() {
  if (!historySidebarList) return;
  const history = loadState('history', []);
  historySidebarList.innerHTML = '';
  
  if (history.length === 0) {
    historySidebarList.innerHTML = `<li style="font-size:0.8rem; color:#666; padding: 4px;">No recently played tracks</li>`;
    return;
  }

  history.forEach(filePath => {
    const li = document.createElement('li');
    li.style.cssText = `background: #1e1e1e; border: 1px solid #333; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer; color: #ddd; transition: background 0.2s;`;
    const parts = filePath.split(/[\\/]/);
    const filename = parts[parts.length - 1];

    li.innerHTML = `
      <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${filePath}">${filename}</span>
      <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:#888; margin-left: 5px;"><path d="M8 5v14l11-7z"/></svg>
    `;

    li.addEventListener('click', () => {
      addToPlaylist(filePath);
      loadMedia(filePath);
      const idx = playlist.findIndex(p => normalizePath(p) === normalizePath(filePath));
      if (idx !== -1) playPlaylistItem(idx);
    });

    li.addEventListener('mouseenter', () => { li.style.background = '#282828'; });
    li.addEventListener('mouseleave', () => { li.style.background = '#1e1e1e'; });
    historySidebarList.appendChild(li);
  });
}

// --- DETAILS / CODEC INFORMATION ---
function updateMediaInfo() {
  if (!mediaInfoPanel) return;
  
  if (currentFilePath) {
    const parts = currentFilePath.split('.');
    const ext = parts[parts.length - 1].toUpperCase();
    infoFormat.textContent = ext || 'Unknown';
  } else {
    infoFormat.textContent = 'N/A';
  }

  if (isAudioFile(currentFilePath)) {
    infoResolution.textContent = 'Audio Only';
    infoAspect.textContent = 'N/A';
  } else {
    const w = mediaPlayer.videoWidth;
    const h = mediaPlayer.videoHeight;
    if (w && h) {
      infoResolution.textContent = `${w} x ${h}`;
      const gcd = (a, b) => b ? gcd(b, a % b) : a;
      const div = gcd(w, h);
      infoAspect.textContent = `${w/div}:${h/div} (${aspectRatioSelect.value})`;
    } else {
      infoResolution.textContent = 'Detecting...';
      infoAspect.textContent = 'Detecting...';
    }
  }

  infoPreamp.textContent = boostSlider ? `${Math.round(parseFloat(boostSlider.value) * 100)}%` : '100%';

  if (panSlider) {
    const val = parseFloat(panSlider.value);
    infoBalance.textContent = val === 0 ? 'Center' : (val < 0 ? `Left ${Math.round(-val*100)}%` : `Right ${Math.round(val*100)}%`);
  }
}

if (toggleInfoBtn) {
  toggleInfoBtn.addEventListener('click', () => {
    if (mediaInfoPanel.style.display === 'none') {
      mediaInfoPanel.style.display = 'flex';
      toggleInfoBtn.textContent = 'Hide Details';
    } else {
      mediaInfoPanel.style.display = 'none';
      toggleInfoBtn.textContent = 'Show Details';
    }
  });
}

// Save resume position periodically
setInterval(saveResumeState, 3000);
window.addEventListener('beforeunload', saveResumeState);

// Initial Setup
volumeSlider.style.background = `linear-gradient(to right, var(--text-color) 100%, rgba(255,255,255,0.3) 100%)`;
progressSlider.style.background = `linear-gradient(to right, var(--focus-color) 0%, rgba(255,255,255,0.3) 0%)`;

// --- RESUME ON LAUNCH ---
(function resumeOnLaunch() {
  renderHistory();
  const resume = loadState('resume', null);
  if (resume && resume.file) {
    addToPlaylist(resume.file);
    currentFilePath = resume.file;
    loadMedia(resume.file, resume.time || 0);
    playPlaylistItem(0);
  }
})();
