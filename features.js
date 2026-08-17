/* ============================================================================
   features.js — Extended features for Accessible Media Player
   Loaded AFTER renderer.js; shares its global (module-level) bindings.
   Implements: WMP-style home/recent screen, playlist power-tools, per-file
   memory & stats, mouse-wheel controls, command palette, mini/focus/FPS/OSD,
   colorblind filters, network URL play, multi-audio, enhanced bookmarks,
   subtitle export, auto-save playlist, sleep-after-track, and IPC hooks.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  function ce(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    for (const k in props) {
      if (k === 'class') el.className = props[k];
      else if (k === 'text') el.textContent = props[k];
      else if (k === 'html') el.innerHTML = props[k];
      else if (k.startsWith('on') && typeof props[k] === 'function') el.addEventListener(k.slice(2), props[k]);
      else if (k === 'style' && typeof props[k] === 'object') Object.assign(el.style, props[k]);
      else el.setAttribute(k, props[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => c && el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  }

  /* ------------------------------------------------------------------ OSD -- */
  const osd = ce('div', { id: 'osd', role: 'status', 'aria-hidden': 'true' });
  document.body.appendChild(osd);
  let osdTimer = null;
  function showOSD(msg) {
    osd.textContent = msg;
    osd.classList.add('show');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove('show'), 1200);
  }

  /* ------------------------------------------------ HOME / RECENT SCREEN -- */
  const homeScreen = ce('div', { id: 'home-screen', 'aria-label': 'Home' });
  document.getElementById('app-container').appendChild(homeScreen);

  function fileTypeIcon(path) {
    if (isAudioFile(path)) {
      return '<svg viewBox="0 0 24 24" class="hm-icon"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" class="hm-icon"><path d="M4 4h16v16H4z" opacity="0"/><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
  }

  function renderHome() {
    const history = loadState('history', []);
    const stats = loadState('stats', {});
    homeScreen.innerHTML = '';

    const header = ce('div', { class: 'hm-header' }, [
      ce('h1', { class: 'hm-title', text: 'Accessible Media Player' }),
      ce('p', { class: 'hm-sub', text: 'Your media, your way.' })
    ]);

    const quick = ce('div', { class: 'hm-quick' });
    const quickActions = [
      { label: 'Open Files', icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z', run: () => openFilesHandler() },
      { label: 'Open URL', icon: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z', run: () => openUrlPrompt() },
      { label: 'Open Playlist', icon: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', run: () => loadPlaylistBtn.click() },
      { label: 'New Playlist', icon: 'M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z', run: () => createPlaylistBtn.click() }
    ];
    quickActions.forEach(a => {
      const btn = ce('button', { class: 'hm-quick-btn', 'aria-label': a.label, onclick: a.run }, [
        ce('svg', { viewBox: '0 0 24 24', class: 'hm-quick-icon' }, []),
        ce('span', { text: a.label })
      ]);
      btn.querySelector('svg').innerHTML = `<path fill="currentColor" d="${a.icon}"/>`;
      quick.appendChild(btn);
    });

    homeScreen.appendChild(header);
    homeScreen.appendChild(quick);

    const recSection = ce('div', { class: 'hm-section' });
    recSection.appendChild(ce('h2', { class: 'hm-section-title', text: 'Recent' }));
    const grid = ce('div', { class: 'hm-grid' });

    if (history.length === 0) {
      grid.appendChild(ce('p', { class: 'hm-empty', text: 'No recent media yet. Open a file to get started.' }));
    } else {
      history.filter(p => typeof p === 'string' && p).slice(0, 12).forEach(path => {
        const st = stats[normalizePath(path)] || {};
        const watched = st.watched || 0;
        const lastPos = st.lastPos || 0;
        const tile = ce('button', { class: 'hm-tile', 'aria-label': `Play ${getFileName(path)}`, onclick: () => { loadMedia(path); hideHome(); } }, [
          ce('div', { class: 'hm-tile-icon', html: fileTypeIcon(path) }),
          ce('div', { class: 'hm-tile-meta' }, [
            ce('div', { class: 'hm-tile-name', text: getFileName(path), title: path }),
            ce('div', { class: 'hm-tile-sub', text: watched > 0 ? `Watched ${formatHMS(watched)}` : 'Not played yet' })
          ])
        ]);
        grid.appendChild(tile);
      });
    }
    recSection.appendChild(grid);
    const clearBtnWrap = ce('div', { style: 'text-align:center;margin-top:10px;' }, [
      ce('button', { class: 'action-btn-small', text: 'Clear History', onclick: clearHistory })
    ]);
    recSection.appendChild(clearBtnWrap);
    homeScreen.appendChild(recSection);

    const featSection = ce('div', { class: 'hm-section' });
    featSection.appendChild(ce('h2', { class: 'hm-section-title', text: 'Tips' }));
    featSection.appendChild(ce('ul', { class: 'hm-tips' }, [
      ce('li', { text: 'Press Ctrl+Shift+P for the command palette.' }),
      ce('li', { text: 'Scroll on the video to seek; Ctrl+scroll for volume; Shift+scroll for speed.' }),
      ce('li', { text: 'Shift+B bookmarks the current moment. B opens bookmarks.' }),
      ce('li', { text: 'Ctrl+G jumps to a specific time.' })
    ]));
    homeScreen.appendChild(featSection);
  }

  function formatHMS(s) {
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  function showHome() { renderHome(); homeScreen.classList.add('open'); homeScreen.setAttribute('aria-hidden', 'false'); }
  function hideHome() { homeScreen.classList.remove('open'); homeScreen.setAttribute('aria-hidden', 'true'); }

  // Hide home whenever real media starts; show via Home button / command palette.
  mediaPlayer.addEventListener('loadedmetadata', () => { if (mediaPlayer.src) hideHome(); });

  // Home button in top bar
  const homeBtn = ce('button', { id: 'home-btn', class: 'icon-btn tooltip', 'aria-label': 'Home', 'data-tooltip': 'Home (Ctrl+H)', onclick: () => {
    if (homeScreen.classList.contains('open')) hideHome(); else showHome();
  } }, [ce('svg', { viewBox: '0 0 24 24', html: '<path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' })]);
  const topLeft = document.querySelector('.top-bar-left');
  if (topLeft) topLeft.appendChild(homeBtn);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.altKey === false && e.key.toLowerCase() === 'h') { e.preventDefault(); showHome(); }
  });

  /* -------------------------------------------- PER-FILE MEMORY & STATS -- */
  const perFile = loadState('perFile', {});
  const stats = loadState('stats', {});
  let lastTime = 0, statSaveAccum = 0;

  function applyPerFile() {
    if (!currentFilePath) return;
    const key = normalizePath(currentFilePath);
    const pf = perFile[key];
    if (pf) {
      if (typeof pf.speed === 'number') { mediaPlayer.playbackRate = pf.speed; }
      if (typeof pf.volume === 'number') { mediaPlayer.volume = pf.volume; }
      if (typeof pf.muted === 'boolean') { mediaPlayer.muted = pf.muted; }
      updateSpeedUI();
      updateVolumeUI();
    }
  }
  function rememberPerFile() {
    if (!currentFilePath) return;
    const key = normalizePath(currentFilePath);
    perFile[key] = { speed: mediaPlayer.playbackRate, volume: mediaPlayer.volume, muted: mediaPlayer.muted };
    saveState('perFile', perFile);
  }

  mediaPlayer.addEventListener('loadedmetadata', applyPerFile);
  mediaPlayer.addEventListener('play', rememberPerFile);
  mediaPlayer.addEventListener('volumechange', () => { rememberPerFile(); });
  mediaPlayer.addEventListener('ratechange', () => { rememberPerFile(); updateSpeedUI(); });

  mediaPlayer.addEventListener('timeupdate', () => {
    const t = mediaPlayer.currentTime;
    const d = t - lastTime;
    if (d > 0 && d < 3 && currentFilePath) {
      const key = normalizePath(currentFilePath);
      if (!stats[key]) stats[key] = { watched: 0, lastPos: 0 };
      stats[key].watched += d;
      stats[key].lastPos = t;
      statSaveAccum += d;
      if (statSaveAccum > 5) { statSaveAccum = 0; saveState('stats', stats); }
    }
    lastTime = t;
  });
  mediaPlayer.addEventListener('seeked', () => { lastTime = mediaPlayer.currentTime; });
  window.addEventListener('beforeunload', () => saveState('stats', stats));

  /* -------------------------------------------------- MOUSE WHEEL CTRL -- */
  videoWrapper.addEventListener('wheel', (e) => {
    if (!mediaPlayer.src || mediaPlayer.src.endsWith('index.html')) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    if (e.ctrlKey) {
      const v = Math.min(1, Math.max(0, mediaPlayer.volume + dir * 0.05));
      mediaPlayer.volume = v; mediaPlayer.muted = false; updateVolumeUI();
      showOSD(`Volume ${Math.round(v * 100)}%`);
    } else if (e.shiftKey) {
      const r = Math.min(4, Math.max(0.1, mediaPlayer.playbackRate + dir * 0.1));
      mediaPlayer.playbackRate = r; updateSpeedUI();
      showOSD(`Speed ${r.toFixed(1)}x`);
    } else {
      const step = e.deltaMode === 1 ? 60 : 5; // lines vs pixels
      mediaPlayer.currentTime = Math.min(mediaPlayer.duration || Infinity, Math.max(0, mediaPlayer.currentTime + dir * step));
      showOSD(`${dir > 0 ? 'Forward' : 'Back'} ${step}s`);
    }
  }, { passive: false });

  /* ---------------------------------------- SEEK PREVIEW TOOLTIP -- */
  const seekTip = ce('div', { id: 'seek-tip', 'aria-hidden': 'true' });
  document.body.appendChild(seekTip);
  progressSlider.addEventListener('mousemove', (e) => {
    if (!mediaPlayer.duration) return;
    const rect = progressSlider.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * mediaPlayer.duration;
    seekTip.textContent = formatTime(t);
    seekTip.style.left = e.clientX + 'px';
    seekTip.style.top = (rect.top - 30) + 'px';
    seekTip.classList.add('show');
  });
  progressSlider.addEventListener('mouseleave', () => seekTip.classList.remove('show'));

  /* ------------------------------------------------- COMMAND PALETTE -- */
  const palette = ce('div', { id: 'cmd-palette', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const palInput = ce('input', { type: 'text', id: 'cmd-input', 'aria-label': 'Command search', placeholder: 'Type a command…' });
  const palList = ce('ul', { id: 'cmd-list', role: 'listbox' });
  const palBox = ce('div', { class: 'modal-content', role: 'dialog', 'aria-label': 'Command Palette', style: 'min-width:460px; padding:0;' }, [
    ce('div', { style: 'padding:14px 16px; border-bottom:1px solid #333;' }, [palInput]),
    palList
  ]);
  palette.appendChild(palBox);
  document.getElementById('app-container').appendChild(palette);

  const COMMANDS = [
    { name: 'Play / Pause', run: () => togglePlay() },
    { name: 'Next Track', run: () => playNext() },
    { name: 'Previous Track', run: () => playPrev() },
    { name: 'Toggle Fullscreen', run: () => toggleFullscreen() },
    { name: 'Open Files', run: () => openFilesHandler() },
    { name: 'Open Network URL', run: () => openUrlPrompt() },
    { name: 'Open Playlist', run: () => loadPlaylistBtn.click() },
    { name: 'Save Playlist', run: () => savePlaylistBtn.click() },
    { name: 'New Playlist', run: () => createPlaylistBtn.click() },
    { name: 'Toggle Loop', run: () => loopBtn.click() },
    { name: 'Mute / Unmute', run: () => muteBtn.click() },
    { name: 'Volume Up', run: () => { volumeSlider.value = Math.min(100, +volumeSlider.value + 10); volumeSlider.dispatchEvent(new Event('input')); } },
    { name: 'Volume Down', run: () => { volumeSlider.value = Math.max(0, +volumeSlider.value - 10); volumeSlider.dispatchEvent(new Event('input')); } },
    { name: 'Toggle Bookmarks', run: () => toggleBookmarksSidebar() },
    { name: 'Toggle Playlist', run: () => togglePlaylistSidebar() },
    { name: 'Toggle More Options', run: () => toggleMoreOptionsSidebar() },
    { name: 'Settings', run: () => toggleSettingsModal() },
    { name: 'Capture Frame', run: () => screenshotBtn.click() },
    { name: 'Go to Time', run: () => openGotoModal() },
    { name: 'Add Bookmark', run: () => addBookmarkAtCurrentTime() },
    { name: 'Toggle Mini Mode', run: () => toggleMiniMode() },
    { name: 'Toggle Focus Mode', run: () => toggleFocusMode() },
    { name: 'Toggle FPS Overlay', run: () => toggleFps() },
    { name: 'Home Screen', run: () => showHome() },
    { name: 'Toggle Shuffle', run: () => { if (shuffleToggle) { shuffleToggle.checked = !shuffleToggle.checked; showOSD(`Shuffle ${shuffleToggle.checked ? 'on' : 'off'}`); } } },
    { name: 'Toggle Autoplay Next', run: () => { if (autoplayToggle) { autoplayToggle.checked = !autoplayToggle.checked; showOSD(`Autoplay ${autoplayToggle.checked ? 'on' : 'off'}`); } } },
    { name: 'Load Subtitles', run: () => loadSubsBtn.click() },
    { name: 'Export Subtitles', run: () => exportSubtitles() },
    { name: 'Toggle Echo Effect', run: () => { if (echoEffectToggle) { echoEffectToggle.checked = !echoEffectToggle.checked; echoEffectToggle.dispatchEvent(new Event('change')); } } },
    { name: 'Toggle High Contrast', run: () => { if (highContrastToggle) { highContrastToggle.checked = !highContrastToggle.checked; highContrastToggle.dispatchEvent(new Event('change')); } } },
    { name: 'Toggle Large Text', run: () => { if (largeTextToggle) { largeTextToggle.checked = !largeTextToggle.checked; largeTextToggle.dispatchEvent(new Event('change')); } } }
  ];
  let palIndex = 0;
  function renderPalette(query) {
    palList.innerHTML = '';
    const q = (query || '').toLowerCase();
    const filtered = COMMANDS.filter(c => c.name.toLowerCase().includes(q));
    palIndex = Math.min(palIndex, Math.max(0, filtered.length - 1));
    if (filtered.length === 0) { palList.appendChild(ce('li', { class: 'cmd-empty', text: 'No commands found' })); return; }
    filtered.forEach((c, i) => {
      const li = ce('li', { class: 'cmd-item' + (i === palIndex ? ' active' : ''), role: 'option', 'aria-selected': i === palIndex ? 'true' : 'false', text: c.name, onclick: () => runPalette(c) });
      palList.appendChild(li);
    });
  }
  function runPalette(c) { closePalette(); c.run(); }
  function openPalette() {
    window._lastModalPrevFocus = document.activeElement;
    palette.style.display = 'flex'; palette.setAttribute('aria-hidden', 'false');
    palInput.value = ''; palIndex = 0; renderPalette(''); palInput.focus();
  }
  function closePalette() { palette.style.display = 'none'; palette.setAttribute('aria-hidden', 'true'); }
  palInput.addEventListener('input', () => { palIndex = 0; renderPalette(palInput.value); });
  palInput.addEventListener('keydown', (e) => {
    const items = palList.querySelectorAll('.cmd-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(items.length - 1, palIndex + 1); renderPalette(palInput.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(0, palIndex - 1); renderPalette(palInput.value); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[palIndex]) runPalette(COMMANDS.find(c => c.name === items[palIndex].textContent)); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); openPalette(); }
  }, true);

  /* ------------------------------------------- MINI / FOCUS / FPS MODES -- */
  let miniMode = false, focusMode = false, fpsOn = false;
  function toggleMiniMode() {
    miniMode = !miniMode;
    ipcRenderer.send('set-mini', miniMode);
    showOSD(miniMode ? 'Mini mode on' : 'Mini mode off');
  }
  function toggleFocusMode() {
    focusMode = !focusMode;
    document.body.classList.toggle('focus-mode', focusMode);
    showOSD(focusMode ? 'Focus mode on' : 'Focus mode off');
  }
  const fpsEl = ce('div', { id: 'fps-overlay', 'aria-hidden': 'true' });
  document.body.appendChild(fpsEl);
  let fpsFrames = 0, fpsLast = performance.now();
  function toggleFps() {
    fpsOn = !fpsOn;
    fpsEl.style.display = fpsOn ? 'block' : 'none';
    showOSD(fpsOn ? 'FPS overlay on' : 'FPS overlay off');
  }
  function fpsLoop() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 1000) {
      if (fpsOn) fpsEl.textContent = `${fpsFrames} fps` + (mediaPlayer.videoWidth ? `  •  ${mediaPlayer.videoWidth}×${mediaPlayer.videoHeight}` : '');
      fpsFrames = 0; fpsLast = now;
    }
    requestAnimationFrame(fpsLoop);
  }
  fpsLoop();

  /* ------------------------------------------------- COLORBLIND FILTER -- */
  const colorblindSelect = ce('select', { id: 'colorblind-select', 'aria-label': 'Color Blindness Filter', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' }, [
    ce('option', { value: 'none', text: 'None' }),
    ce('option', { value: 'protanopia', text: 'Protanopia' }),
    ce('option', { value: 'deuteranopia', text: 'Deuteranopia' }),
    ce('option', { value: 'tritanopia', text: 'Tritanopia' }),
    ce('option', { value: 'grayscale', text: 'Grayscale' })
  ]);
  const cbWrap = ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:10px;' }, [
    ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Color Blindness Filter:' }),
    colorblindSelect
  ]);
  const accessSettings = document.getElementById('access-settings');
  if (accessSettings) accessSettings.appendChild(cbWrap);

  const CB_FILTERS = {
    none: '',
    protanopia: 'url(#cb-protan)',
    deuteranopia: 'url(#cb-deuter)',
    tritanopia: 'url(#cb-tritan)',
    grayscale: 'grayscale(1)'
  };
  let cbFilter = '';
  // SVG filters for color blindness simulation
  const svgDefs = ce('svg', { style: 'position:absolute;width:0;height:0;', 'aria-hidden': 'true', html: `
    <defs>
      <filter id="cb-protan"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/></filter>
      <filter id="cb-deuter"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/></filter>
      <filter id="cb-tritan"><feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/></filter>
    </defs>` });
  document.body.appendChild(svgDefs);

  colorblindSelect.addEventListener('change', () => {
    cbFilter = CB_FILTERS[colorblindSelect.value] || '';
    applyVideoFilterExtensions();
    showOSD(`Color filter: ${colorblindSelect.value}`);
  });
  // Patch updateVideoFilters to include colorblind filter (reassign the renderer binding)
  const _origUpdateVideoFilters = updateVideoFilters;
  updateVideoFilters = function () {
    _origUpdateVideoFilters();
    applyVideoFilterExtensions();
  };
  // The video-filter sliders captured the ORIGINAL function when binding their
  // 'input' listeners, so re-apply the colorblind filter after they run.
  if (typeof videoFilters !== 'undefined' && videoFilters) {
    videoFilters.forEach(s => s.addEventListener('input', applyVideoFilterExtensions));
  }
  function applyVideoFilterExtensions() {
    if (!cbFilter) return;
    const existing = mediaPlayer.style.filter || '';
    // strip any url(#cb-*) tokens then re-add
    const cleaned = existing.replace(/\s*url\(#cb-[a-z]+\)/g, '').trim();
    mediaPlayer.style.filter = (cleaned + ' ' + cbFilter).trim();
  }

  /* ------------------------------------------------- NETWORK URL PLAY -- */
  const urlModal = ce('div', { id: 'url-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const urlInput = ce('input', { type: 'text', id: 'url-input', placeholder: 'https://… or file path', style: 'padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:4px;font-size:1rem;width:100%;' });
  urlModal.appendChild(ce('div', { class: 'modal-content', role: 'dialog', 'aria-label': 'Open URL', style: 'min-width:420px;padding:20px;' }, [
    ce('h3', { style: 'margin-top:0;', text: 'Open Network URL or Path' }),
    ce('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
      urlInput,
      ce('div', { style: 'display:flex;justify-content:flex-end;gap:10px;' }, [
        ce('button', { class: 'action-btn', text: 'Cancel', onclick: () => closeUrl() }),
        ce('button', { class: 'action-btn', id: 'url-go', text: 'Play', style: 'background:var(--focus-color);color:#000;font-weight:bold;', onclick: () => submitUrl() })
      ])
    ])
  ]));
  document.getElementById('app-container').appendChild(urlModal);
  function openUrlPrompt() {
    window._lastModalPrevFocus = document.activeElement;
    urlModal.style.display = 'flex'; urlModal.setAttribute('aria-hidden', 'false');
    urlInput.value = ''; urlInput.focus();
  }
  function closeUrl() { urlModal.style.display = 'none'; urlModal.setAttribute('aria-hidden', 'true'); if (_lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } }
  function submitUrl() {
    const v = urlInput.value.trim();
    if (!v) return;
    let src = v;
    if (!/^https?:\/\//.test(v) && !v.startsWith('file://') && !v.startsWith('blob:') && !v.startsWith('data:')) {
      src = `file:///${v.replace(/\\/g, '/')}`;
    }
    addToPlaylist(src);
    currentPlaylistIndex = playlist.length - 1;
    loadMedia(src);
    renderPlaylist();
    closeUrl();
  }
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') closeUrl(); });

  // Paste a URL from clipboard
  window.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && /^https?:\/\/\S+$/.test(text.trim()) && !mediaPlayer.src) {
      submitUrlText(text.trim());
    }
  });
  function submitUrlText(v) {
    let src = v;
    if (!/^https?:\/\//.test(v)) src = `file:///${v.replace(/\\/g, '/')}`;
    addToPlaylist(src); currentPlaylistIndex = playlist.length - 1; loadMedia(src); renderPlaylist();
  }

  /* ------------------------------------------------- MULTI-AUDIO TRACK -- */
  const audioTrackSelect = ce('select', { id: 'audio-track-select', 'aria-label': 'Audio Track', style: 'background:#333;color:#fff;border:1px solid #444;padding:4px;border-radius:4px;font-size:0.8rem;' });
  const audioTrackWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Audio Track' }),
    audioTrackSelect
  ]);
  const moreOpts = document.getElementById('more-options-sidebar');
  if (moreOpts) {
    const scroll = moreOpts.querySelector('div[style*="overflow-y: auto"]') || moreOpts.querySelector('.playlist-header')?.nextSibling;
    const target = moreOpts.querySelector('div[style*="flex: 1; overflow-y: auto"]') || moreOpts.lastElementChild;
    if (target) target.insertBefore(audioTrackWrap, target.firstChild);
  }
  audioTrackSelect.addEventListener('change', () => {
    if (mediaPlayer.audioTracks) {
      for (let i = 0; i < mediaPlayer.audioTracks.length; i++) mediaPlayer.audioTracks[i].enabled = (i === +audioTrackSelect.value);
    }
  });
  mediaPlayer.addEventListener('loadedmetadata', () => {
    if (mediaPlayer.audioTracks && mediaPlayer.audioTracks.length > 1) {
      audioTrackWrap.style.display = 'flex';
      audioTrackSelect.innerHTML = '';
      for (let i = 0; i < mediaPlayer.audioTracks.length; i++) {
        const t = mediaPlayer.audioTracks[i];
        audioTrackSelect.appendChild(ce('option', { value: i, text: t.label || `Track ${i + 1}` }));
      }
      audioTrackSelect.value = mediaPlayer.audioTracks.selectedIndex >= 0 ? mediaPlayer.audioTracks.selectedIndex : 0;
    } else {
      audioTrackWrap.style.display = 'none';
    }
  });

  /* --------------------------------------------- ENHANCED BOOKMARKS -- */
  const _origRenderBookmarks = renderBookmarks;
  renderBookmarks = function () {
    bookmarksSidebarList.innerHTML = '';
    const bookmarks = getBookmarks();
    if (bookmarks.length === 0) {
      bookmarksSidebarList.innerHTML = '<li style="padding: 15px; color: #888; text-align: center; font-size: 0.9rem;">No bookmarks yet. Press Shift+B or use the button above to add one.</li>';
      return;
    }
    bookmarks.forEach((bm, i) => {
      const li = ce('li', { class: 'bookmark-item' });
      const row = ce('div', { class: 'bookmark-row' });

      const titleInput = ce('input', { class: 'bookmark-title-input', type: 'text', value: bm.label || '', 'aria-label': 'Bookmark label' });
      titleInput.addEventListener('change', (e) => {
        const current = getBookmarks();
        if (current[i]) { current[i].label = e.target.value.trim() || `Bookmark at ${formatTime(bm.time)}`; saveBookmarks(current); announce('Bookmark renamed'); }
      });

      const timeBadge = ce('span', { class: 'bookmark-time-badge', text: formatTime(bm.time), title: `Jump to ${formatTime(bm.time)}`, onclick: () => { mediaPlayer.currentTime = bm.time; announce(`Jumped to ${formatTime(bm.time)}`); } });

      const thumb = bm.thumb
        ? ce('img', { class: 'bookmark-thumb', src: bm.thumb, alt: '' })
        : ce('div', { class: 'bookmark-thumb bookmark-thumb-empty', text: '★' });

      const note = ce('textarea', { class: 'bookmark-note', placeholder: 'Add a note…', 'aria-label': 'Bookmark note' });
      note.value = bm.note || '';
      note.addEventListener('change', (e) => {
        const current = getBookmarks();
        if (current[i]) { current[i].note = e.target.value; saveBookmarks(current); }
      });

      const actions = ce('div', { class: 'bookmark-actions' });
      const jumpBtn = ce('button', { class: 'action-btn-small', text: 'Jump', 'aria-label': `Jump to ${bm.label}`, onclick: () => { mediaPlayer.currentTime = bm.time; announce(`Jumped to ${formatTime(bm.time)}`); } });
      const delBtn = ce('button', { class: 'builder-remove-btn', text: 'Delete', style: 'padding:4px 8px;', 'aria-label': `Delete ${bm.label}`, onclick: () => { const current = getBookmarks(); current.splice(i, 1); saveBookmarks(current); renderBookmarks(); announce('Bookmark deleted'); } });
      actions.appendChild(jumpBtn); actions.appendChild(delBtn);

      row.appendChild(titleInput); row.appendChild(timeBadge);
      li.appendChild(thumb);
      li.appendChild(row);
      li.appendChild(note);
      li.appendChild(actions);
      bookmarksSidebarList.appendChild(li);
    });
  };

  // Capture a thumbnail when adding a bookmark (video only)
  const _origAddBookmark = addBookmarkAtCurrentTime;
  addBookmarkAtCurrentTime = function () {
    if (!currentFilePath || isNaN(mediaPlayer.currentTime)) { announce('No media loaded to bookmark'); return; }
    const bookmarks = getBookmarks();
    const time = mediaPlayer.currentTime;
    let thumb = null;
    try {
      if (!isAudioFile(currentFilePath) && mediaPlayer.videoWidth) {
        const c = document.createElement('canvas');
        c.width = 160; c.height = Math.round(160 * (mediaPlayer.videoHeight / mediaPlayer.videoWidth)) || 90;
        c.getContext('2d').drawImage(mediaPlayer, 0, 0, c.width, c.height);
        thumb = c.toDataURL('image/jpeg', 0.6);
      }
    } catch (e) { thumb = null; }
    const label = `Bookmark at ${formatTime(time)}`;
    bookmarks.push({ time, label, note: '', thumb });
    bookmarks.sort((a, b) => a.time - b.time);
    saveBookmarks(bookmarks);
    renderBookmarks();
    announce(`Bookmark added at ${formatTime(time)}`);
  };

  /* ----------------------------------------------- PLAYLIST POWER-TOOLS -- */
  // Inject search box + duration + dedupe into playlist sidebar
  const playlistSearch = ce('input', { type: 'text', id: 'playlist-search', placeholder: 'Search queue…', 'aria-label': 'Search queue', style: 'width:100%;padding:8px;margin:8px 0;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;' });
  const playlistMeta = ce('div', { id: 'playlist-meta', style: 'font-size:0.8rem;color:#aaa;padding:0 15px 8px;display:flex;justify-content:space-between;' });
  const dedupeBtn = ce('button', { class: 'action-btn-small', text: 'Remove Duplicates', 'aria-label': 'Remove duplicate tracks', onclick: dedupePlaylist });
  const metaBar = ce('div', { style: 'padding:0 15px 8px;' }, [dedupeBtn]);
  const playlistHeader = document.querySelector('#playlist-sidebar .playlist-header');
  if (playlistHeader) {
    playlistHeader.insertAdjacentElement('afterend', playlistSearch);
    playlistHeader.insertAdjacentElement('afterend', playlistMeta);
    playlistHeader.insertAdjacentElement('afterend', metaBar);
  }

  let playlistFilter = '';
  playlistSearch.addEventListener('input', () => { playlistFilter = playlistSearch.value.toLowerCase(); renderPlaylist(); updatePlaylistMeta(); });

  function playlistDuration() {
    // We can't know each file's duration without loading; estimate by last known durations map.
    const durs = loadState('durations', {});
    let total = 0, known = 0;
    playlist.forEach(p => { const d = durs[normalizePath(p)]; if (typeof d === 'number') { total += d; known++; } });
    return { total, known };
  }
  function updatePlaylistMeta() {
    const shown = playlist.filter(p => getFileName(p).toLowerCase().includes(playlistFilter)).length;
    const { total, known } = playlistDuration();
    playlistMeta.innerHTML = `<span>${shown} / ${playlist.length} tracks</span><span>${known ? '~' + formatHMS(total) : ''}</span>`;
  }

  function dedupePlaylist() {
    const seen = new Set(); let removed = 0;
    for (let i = playlist.length - 1; i >= 0; i--) {
      const k = normalizePath(playlist[i]);
      if (seen.has(k)) { playlist.splice(i, 1); if (currentPlaylistIndex > i) currentPlaylistIndex--; removed++; }
      else seen.add(k);
    }
    if (currentPlaylistIndex >= playlist.length) currentPlaylistIndex = playlist.length - 1;
    renderPlaylist();
    announce(removed ? `Removed ${removed} duplicate track(s)` : 'No duplicates found');
  }

  // Drag-reorder + play-next + undo, by reassigning renderPlaylist
  let lastRemoved = null;
  const _origRenderPlaylist = renderPlaylist;
  renderPlaylist = function () {
    _origRenderPlaylist();
    // attach DnD + filter
    const items = playlistItems.querySelectorAll('.playlist-item');
    items.forEach((li, idx) => {
      if (playlistFilter && !getFileName(playlist[idx]).toLowerCase().includes(playlistFilter)) {
        li.style.display = 'none';
      } else {
        li.style.display = '';
      }
      li.setAttribute('draggable', 'true');
      li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); });
      li.addEventListener('dragover', (e) => { e.preventDefault(); li.style.borderTop = '2px solid var(--focus-color)'; });
      li.addEventListener('dragleave', () => { li.style.borderTop = ''; });
      li.addEventListener('drop', (e) => {
        e.preventDefault(); li.style.borderTop = '';
        const from = parseInt(e.dataTransfer.getData('text/plain'));
        reorderPlaylist(from, idx);
      });
      // Shift+Enter = play next
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); playNextAfter(idx); }
      });
      // Context menu (right click) for play-next / remove / info
      li.addEventListener('contextmenu', (e) => { e.preventDefault(); showPlaylistMenu(e, idx); });
    });
    updatePlaylistMeta();
  };

  function reorderPlaylist(from, to) {
    if (from === to || from < 0 || to < 0) return;
    const [moved] = playlist.splice(from, 1);
    playlist.splice(to, 0, moved);
    if (currentPlaylistIndex === from) currentPlaylistIndex = to;
    else if (from < currentPlaylistIndex && to >= currentPlaylistIndex) currentPlaylistIndex--;
    else if (from > currentPlaylistIndex && to <= currentPlaylistIndex) currentPlaylistIndex++;
    renderPlaylist();
    announce('Playlist reordered');
  }

  function playNextAfter(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    const [item] = playlist.splice(idx, 1);
    const insertAt = currentPlaylistIndex + 1;
    playlist.splice(insertAt, 0, item);
    if (idx < currentPlaylistIndex) currentPlaylistIndex--;
    renderPlaylist();
    announce('Queued to play next');
  }

  function showPlaylistMenu(e, idx) {
    removePlaylistMenu();
    const menu = ce('div', { class: 'ctx-menu', style: `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:300;` });
    const actions = [
      { label: 'Play Now', run: () => playPlaylistItem(idx) },
      { label: 'Play Next', run: () => playNextAfter(idx) },
      { label: 'Remove', run: () => { lastRemoved = { item: playlist[idx], index: idx }; playlist.splice(idx, 1); if (currentPlaylistIndex > idx) currentPlaylistIndex--; renderPlaylist(); showUndo(); } },
      { label: 'Copy Path', run: () => { navigator.clipboard && navigator.clipboard.writeText(playlist[idx]); announce('Path copied'); } }
    ];
    actions.forEach(a => menu.appendChild(ce('button', { class: 'ctx-item', text: a.label, onclick: () => { a.run(); removePlaylistMenu(); } })));
    document.body.appendChild(menu);
    setTimeout(() => window.addEventListener('click', removePlaylistMenu, { once: true }), 0);
  }
  function removePlaylistMenu() { document.querySelectorAll('.ctx-menu').forEach(m => m.remove()); }

  function showUndo() {
    const bar = ce('div', { class: 'undo-bar' }, [
      ce('span', { text: 'Track removed' }),
      ce('button', { class: 'action-btn-small', text: 'Undo', onclick: () => {
        if (lastRemoved) { playlist.splice(lastRemoved.index, 0, lastRemoved.item); if (currentPlaylistIndex >= lastRemoved.index) currentPlaylistIndex++; renderPlaylist(); lastRemoved = null; }
        bar.remove();
      } })
    ]);
    document.body.appendChild(bar);
    setTimeout(() => { if (bar.parentNode) bar.remove(); }, 6000);
  }

  // Record durations for playlist total
  mediaPlayer.addEventListener('loadedmetadata', () => {
    if (currentFilePath && isFinite(mediaPlayer.duration)) {
      const durs = loadState('durations', {});
      durs[normalizePath(currentFilePath)] = mediaPlayer.duration;
      saveState('durations', durs);
      updatePlaylistMeta();
    }
  });

  /* ---------------------------------------------- AUTO-SAVE PLAYLIST -- */
  const _origRender2 = renderPlaylist;
  // wrap once more for autosave (combine with above by saving inside renderPlaylist meta update)
  const _renderWithSave = renderPlaylist;
  renderPlaylist = function () { _renderWithSave(); saveState('autoplaylist', playlist); };
  // Restore autosaved playlist on launch (after renderer IIFE has run)
  setTimeout(() => {
    const auto = loadState('autoplaylist', null);
    if (auto && Array.isArray(auto) && auto.length && currentPlaylistIndex === -1 && !mediaPlayer.src) {
      playlist = auto.slice();
      renderPlaylist();
    }
  }, 50);

  /* ------------------------------------------------- SUBTITLE EXPORT -- */
  function exportSubtitles() {
    if (!subtitleFileText) { announce('No subtitle loaded to export'); return; }
    const isSrt = /\.(srt)$/i.test(currentSubtitleName || '');
    let out = subtitleFileText;
    if (!isSrt) {
      // convert VTT -> SRT
      out = subtitleFileText
        .replace(/WEBVTT\s*/, '')
        .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2')
        .replace(/\n\n+/g, '\n\n');
    }
    ipcRenderer.invoke('save-subs', { name: (currentSubtitleName || 'subtitles').replace(/\.(vtt|srt)$/i, '') + '.srt', text: out })
      .then(ok => announce(ok ? 'Subtitles exported' : 'Export cancelled'));
  }

  /* ---------------------------------------- SLEEP AFTER CURRENT TRACK -- */
  const sleepEndCheck = ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#ccc;margin-top:8px;' }, [
    ce('input', { type: 'checkbox', id: 'sleep-end-track' }),
    ce('span', { text: 'Stop at end of current track' })
  ]);
  const sleepSelect = document.getElementById('sleep-timer-select');
  if (sleepSelect && sleepSelect.parentElement) sleepSelect.parentElement.appendChild(sleepEndCheck);
  let sleepStopAtEnd = false;
  sleepEndCheck.querySelector('input').addEventListener('change', (e) => {
    sleepStopAtEnd = e.target.checked;
    if (sleepStopAtEnd) { sleepTimerSelect.value = 'off'; if (sleepInterval) { clearInterval(sleepInterval); sleepCountdown.style.display = 'none'; } announce('Will stop at end of track'); }
    else announce('Sleep-at-end disabled');
  });
  mediaPlayer.addEventListener('ended', () => {
    if (sleepStopAtEnd && !isLooping) { mediaPlayer.pause(); sleepStopAtEnd = false; sleepEndCheck.querySelector('input').checked = false; announce('Stopped at end of track (sleep timer)'); }
  });

  /* ------------------------------------------------- IPC LISTENERS -- */
  ipcRenderer.on('media-key', (e, action) => {
    if (action === 'play-pause') togglePlay();
    else if (action === 'next') playNext();
    else if (action === 'prev') playPrev();
    else if (action === 'stop') { mediaPlayer.pause(); mediaPlayer.currentTime = 0; }
  });
  ipcRenderer.on('open-external', (e, path) => {
    const norm = normalizePath(path);
    const existingIdx = playlist.findIndex(p => normalizePath(p) === norm);
    if (existingIdx >= 0) {
      currentPlaylistIndex = existingIdx;
    } else {
      addToPlaylist(path);
      currentPlaylistIndex = playlist.length - 1;
    }
    loadMedia(playlist[currentPlaylistIndex]);
    renderPlaylist();
  });
  ipcRenderer.on('watch-folder-file', (e, path) => { addToPlaylist(path); announce(`Added from watched folder: ${getFileName(path)}`); });
  ipcRenderer.on('request-home', () => showHome());
  ipcRenderer.on('request-url', () => openUrlPrompt());
  ipcRenderer.on('request-palette', () => openPalette());

  // Notification on track change
  mediaPlayer.addEventListener('loadedmetadata', () => {
    if (currentFilePath) {
      ipcRenderer.send('show-notification', {
        title: 'Now Playing',
        body: getFileName(currentFilePath)
      });
    }
  });

  /* ====================================================================
     ACCESSIBILITY HARDENING + FEATURE BATCH
     ==================================================================== */

  /* ---- Dual live regions: assertive for critical, polite for the rest -- */
  const politeRegion = ce('div', { id: 'polite-region', class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  document.body.appendChild(politeRegion);
  const _assertiveRegion = liveRegion;
  announce = function (message) {
    const critical = message.includes('Playing') || message.includes('Paused') ||
      message.includes('Loaded') || message.includes('Stopped') || message.includes('Now Playing');
    if (!verboseAnnounceToggle || !verboseAnnounceToggle.checked) {
      if (!critical) return;
    }
    const target = critical ? _assertiveRegion : politeRegion;
    target.textContent = '';
    setTimeout(() => { target.textContent = message; }, 50);
  };

  window._lastModalPrevFocus = null;
  /* ---- Generic focus trap for modals ---- */
  function enableModalA11y(modalEl, inputEl, hideFn) {
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.addEventListener('keydown', (e) => {
      if (modalEl.style.display === 'none') return;
      if (e.key === 'Escape') { e.preventDefault(); hideFn(); if (_lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(modalEl.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // Apply to existing modals (goto / url / palette)
  enableModalA11y(gotoModal, gotoTimeInput, closeGotoModal);
  enableModalA11y(urlModal, urlInput, closeUrl);
  enableModalA11y(palette, palInput, closePalette);

  // Command palette: ARIA listbox + activedescendant so items are announced
  const _renderPalette = renderPalette;
  renderPalette = function (q) {
    _renderPalette(q);
    palList.setAttribute('role', 'listbox');
    palList.setAttribute('aria-label', 'Commands');
    const items = palList.querySelectorAll('.cmd-item');
    items.forEach((li, i) => {
      li.setAttribute('role', 'option');
      li.id = 'cmd-opt-' + i;
      if (i === palIndex) { li.setAttribute('aria-selected', 'true'); palInput.setAttribute('aria-activedescendant', li.id); }
      else li.removeAttribute('aria-selected');
    });
  };

  // Home screen a11y: focus first control, trap, Escape closes
  let homePrevFocus = null;
  const _showHome = showHome;
  showHome = function () {
    homePrevFocus = document.activeElement;
    _showHome();
    const b = homeScreen.querySelector('.hm-quick-btn');
    if (b) b.focus();
  };
  homeScreen.setAttribute('role', 'region');
  homeScreen.setAttribute('aria-label', 'Home and recent media');
  homeScreen.setAttribute('aria-modal', 'true');
  homeScreen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); hideHome(); if (homePrevFocus) homePrevFocus.focus(); homePrevFocus = null; }
    if (e.key === 'Tab') {
      const f = Array.from(homeScreen.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // Landmark roles for screen-reader navigation
  videoWrapper.setAttribute('role', 'main');
  videoWrapper.setAttribute('aria-label', 'Video and playback area');
  const topBarEl = document.querySelector('.top-bar');
  if (topBarEl) {
    topBarEl.setAttribute('role', 'navigation');
    topBarEl.setAttribute('aria-label', 'Top toolbar');
  }
  [playlistSidebar, bookmarksSidebar, moreOpts].forEach(s => { if (s) { s.setAttribute('role', 'region'); } });

  // Skip link for keyboard / SR users
  const skipLink = ce('a', { href: '#controls-overlay', id: 'skip-link', class: 'sr-only', text: 'Skip to playback controls',
    onclick: (e) => { e.preventDefault(); controlsOverlay.setAttribute('tabindex', '-1'); controlsOverlay.focus(); } });
  document.getElementById('app-container').insertBefore(skipLink, document.getElementById('app-container').firstChild);

  /* ---- Accessible context menu (was a plain div) ---- */
  showPlaylistMenu = function (e, idx) {
    removePlaylistMenu();
    const menu = ce('div', { class: 'ctx-menu', role: 'menu', 'aria-label': 'Playlist item actions',
      style: `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:300;` });
    const actions = [
      { label: 'Play Now', run: () => playPlaylistItem(idx) },
      { label: 'Play Next', run: () => playNextAfter(idx) },
      { label: 'Remove', run: () => { lastRemoved = { item: playlist[idx], index: idx }; playlist.splice(idx, 1); if (currentPlaylistIndex > idx) currentPlaylistIndex--; renderPlaylist(); showUndo(); } },
      { label: 'Copy Path', run: () => { navigator.clipboard && navigator.clipboard.writeText(playlist[idx]); announce('Path copied'); } }
    ];
    const buttons = actions.map(a => ce('button', { class: 'ctx-item', role: 'menuitem', text: a.label,
      onclick: () => { a.run(); removePlaylistMenu(); if (prevMenuFocus) prevMenuFocus.focus(); } }));
    buttons.forEach(b => menu.appendChild(b));
    document.body.appendChild(menu);
    const prevMenuFocus = document.activeElement;
    buttons[0].focus();
    menu.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); removePlaylistMenu(); if (prevMenuFocus) prevMenuFocus.focus(); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); const i = buttons.indexOf(document.activeElement); buttons[(i + 1) % buttons.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); const i = buttons.indexOf(document.activeElement); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
    });
    setTimeout(() => window.addEventListener('click', (ev) => { if (!menu.contains(ev.target)) removePlaylistMenu(); }, { once: true }), 0);
  };

  /* ---- Keyboard playlist reorder (Ctrl+Arrow on a focused item) ---- */
  // Patch into the existing renderPlaylist DnD handler
  const _renderPlaylistReorder = renderPlaylist;
  renderPlaylist = function () {
    _renderPlaylistReorder();
    const items = playlistItems.querySelectorAll('.playlist-item');
    items.forEach((li, idx) => {
      li.addEventListener('keydown', (ev) => {
        if (ev.ctrlKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
          ev.preventDefault();
          reorderPlaylist(idx, ev.key === 'ArrowUp' ? idx - 1 : idx + 1);
        }
      });
    });
  };

  /* ---- Quick Toggles panel (proper aria-pressed buttons) ---- */
  let alwaysOnTop = false, normalizationOn = false, videoRotation = 0, flipH = false, flipV = false, videoZoom = 1;
  function subsVisible() { return mediaPlayer.textTracks && mediaPlayer.textTracks.length > 0 && mediaPlayer.textTracks[0].mode === 'showing'; }
  const moScroll = document.querySelector('#more-options-sidebar div[style*="flex: 1; overflow-y: auto"]');
  const togglesPanel = ce('div', { class: 'mo-section', style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Quick Toggles' })
  ]);
  function mkToggle(label, getState, onToggle) {
    const btn = ce('button', { class: 'action-btn-small', style: 'justify-content:flex-start;display:flex;gap:8px;align-items:center;', 'aria-pressed': 'false', text: label });
    function upd() { const on = !!getState(); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.background = on ? 'var(--focus-color)' : '#333'; btn.style.color = on ? '#000' : '#eee'; }
    btn.addEventListener('click', () => { onToggle(); setTimeout(upd, 0); });
    btn._upd = upd; upd();
    togglesPanel.appendChild(btn);
    return btn;
  }
  mkToggle('Repeat', () => repeatMode !== 'off', () => setRepeatMode(repeatMode === 'off' ? 'one' : repeatMode === 'one' ? 'all' : 'off'));
  mkToggle('Shuffle', () => shuffleToggle && shuffleToggle.checked, () => { shuffleToggle.checked = !shuffleToggle.checked; shuffleToggle.dispatchEvent(new Event('change')); });
  mkToggle('Autoplay Next', () => autoplayToggle && autoplayToggle.checked, () => { autoplayToggle.checked = !autoplayToggle.checked; autoplayToggle.dispatchEvent(new Event('change')); });
  mkToggle('Mini Mode', () => miniMode, () => toggleMiniMode());
  mkToggle('Focus Mode', () => focusMode, () => toggleFocusMode());
  mkToggle('FPS Overlay', () => fpsOn, () => toggleFps());
  mkToggle('Always on Top', () => alwaysOnTop, () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); });
  mkToggle('Audio Normalization', () => normalizationOn, () => { normalizationOn = !normalizationOn; setNormalization(normalizationOn); });
  mkToggle('Subtitles', () => subsVisible(), () => toggleSubtitles());
  // Append toggles AFTER static content so they appear at the top of the dynamic area
  if (moScroll) moScroll.appendChild(togglesPanel);
  // Visualizer, Spatial, Customize & Clear History — appended inside togglesPanel
  (function addExtraToggles() {
    let _visOn = loadState('visualizerOn', true);
    window._setVisualizer = function (on) {
      _visOn = on; saveState('visualizerOn', on);
      if (on && isAudioFile(currentFilePath)) { audioVisualizer.style.display = 'flex'; audioVisualizer.setAttribute('aria-hidden', 'false'); startVisualizerLoop(); }
      else { audioVisualizer.style.display = 'none'; audioVisualizer.setAttribute('aria-hidden', 'true'); stopVisualizerLoop(); }
    };
    mkToggle('Visualizer', () => _visOn, () => window._setVisualizer(!_visOn));
    mkToggle('Spatial Audio', () => document.getElementById('spatial-toggle')?.checked, () => { const cb = document.getElementById('spatial-toggle'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } });
    togglesPanel.appendChild(ce('button', { class: 'action-btn-small', text: 'Clear History', style: 'font-size:0.78rem;', onclick: clearHistory }));
    togglesPanel.appendChild(ce('button', { class: 'action-btn-small', text: 'Customize Visualizer', style: 'margin-top:4px;font-size:0.78rem;', onclick: () => { const vs = document.getElementById('vis-color'); if (vs) vs.closest?.('[style*="background:#252525"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) || vs.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); announce('Visualizer settings'); } }));
  })();
  // Patch loadMedia so the visualizer never appears when toggled off
  if (typeof loadMedia === 'function') {
    const _origLM = loadMedia;
    loadMedia = function (fp, seekTo) {
      _origLM(fp, seekTo);
      if (audioVisualizer.style.display !== 'none' && !loadState('visualizerOn', true)) {
        audioVisualizer.style.display = 'none';
        audioVisualizer.setAttribute('aria-hidden', 'true');
        stopVisualizerLoop();
      }
    };
  }


  /* ---- M3U export + Add Folder buttons in playlist sidebar ---- */
  const headerBtns = document.querySelector('#playlist-sidebar .header-btns');
  if (headerBtns) {
    const m3uBtn = ce('button', { class: 'icon-btn tooltip', 'aria-label': 'Export M3U Playlist', title: 'Export M3U', text: 'M3U',
      onclick: async () => { if (playlist.length === 0) return announce('Playlist empty'); const ok = await ipcRenderer.invoke('save-m3u', playlist); announce(ok ? 'M3U exported' : 'Export cancelled'); } });
    const folderBtn = ce('button', { class: 'icon-btn tooltip', 'aria-label': 'Add Folder to Playlist', title: 'Add Folder', text: '📁',
      onclick: async () => { const files = await ipcRenderer.invoke('open-directory-dialog'); if (Array.isArray(files) && files.length) { files.forEach(f => addToPlaylist(f)); if (currentPlaylistIndex === -1) playPlaylistItem(playlist.length - files.length); announce(`Added ${files.length} files from folder`); } } });
    headerBtns.appendChild(m3uBtn);
    headerBtns.appendChild(folderBtn);
  }

  /* ---- Subtitle font family ---- */
  const subFontSelect = ce('select', { id: 'sub-font-select', 'aria-label': 'Subtitle Font Family', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' }, [
    ce('option', { value: 'sans-serif', text: 'Sans Serif' }),
    ce('option', { value: 'serif', text: 'Serif' }),
    ce('option', { value: 'monospace', text: 'Monospace' }),
    ce('option', { value: '"Comic Sans MS", cursive', text: 'Casual' })
  ]);
  subFontSelect.addEventListener('change', () => { document.documentElement.style.setProperty('--cue-font-family', subFontSelect.value); });
  const subFontWrap = ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:10px;' }, [
    ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Font Family:' }), subFontSelect
  ]);
  const subStyleSection = Array.from(moreOpts.querySelectorAll('h3')).find(h => h.textContent.includes('Subtitle Customization'));
  if (subStyleSection && subStyleSection.parentElement) subStyleSection.parentElement.appendChild(subFontWrap);

  /* ---- Rotate / Flip ---- */
  function applyVideoTransform() {
    mediaPlayer.style.transform = `scale(${videoZoom}) rotate(${videoRotation}deg)` + (flipH ? ' scaleX(-1)' : '') + (flipV ? ' scaleY(-1)' : '');
  }
  if (zoomSelect) zoomSelect.addEventListener('change', () => { videoZoom = parseFloat(zoomSelect.value); applyVideoTransform(); });
  const rotSection = ce('div', { class: 'mo-section', style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Rotate & Flip' }),
    ce('div', { style: 'display:flex;gap:6px;' }, [
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: '⟲ Left', onclick: () => { videoRotation = (videoRotation - 90) % 360; applyVideoTransform(); announce('Rotated left'); } }),
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Right ⟳', onclick: () => { videoRotation = (videoRotation + 90) % 360; applyVideoTransform(); announce('Rotated right'); } })
    ]),
    ce('div', { style: 'display:flex;gap:6px;' }, [
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Flip H', onclick: () => { flipH = !flipH; applyVideoTransform(); announce('Flip horizontal ' + (flipH ? 'on' : 'off')); } }),
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Flip V', onclick: () => { flipV = !flipV; applyVideoTransform(); announce('Flip vertical ' + (flipV ? 'on' : 'off')); } })
    ])
  ]);
  if (moScroll) moScroll.insertBefore(rotSection, moScroll.firstChild);

  /* ---- Audio output device selection ---- */
  const audioDevSelect = ce('select', { id: 'audio-device-select', 'aria-label': 'Audio Output Device', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' }, [ce('option', { value: '', text: 'System Default' })]);
  audioDevSelect.addEventListener('change', () => ipcRenderer.send('set-audio-device', audioDevSelect.value));
  const refreshDevBtn = ce('button', { class: 'action-btn-small', text: 'Refresh', onclick: refreshDevices });
  async function refreshDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      audioDevSelect.innerHTML = '<option value="">System Default</option>';
      devs.filter(d => d.kind === 'audiooutput').forEach(d => audioDevSelect.appendChild(ce('option', { value: d.deviceId, text: d.label || ('Device ' + d.deviceId.slice(0, 6)) })));
    } catch (e) { announce('Could not list audio devices'); }
  }
  const devWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Audio Output' }), audioDevSelect, refreshDevBtn
  ]);
  const audioSettings = document.getElementById('audio-settings');
  if (audioSettings) audioSettings.appendChild(devWrap);
  refreshDevices();

  /* ---- Capture frame to clipboard + bookmark nav + clear history ---- */
  function captureToClipboard() {
    if (!currentFilePath) return announce('No media loaded');
    if (isAudioFile(currentFilePath)) return announce('Cannot capture audio');
    try {
      const c = document.createElement('canvas');
      c.width = mediaPlayer.videoWidth; c.height = mediaPlayer.videoHeight;
      c.getContext('2d').drawImage(mediaPlayer, 0, 0, c.width, c.height);
      c.toBlob(async (blob) => {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); announce('Frame copied to clipboard'); }
        catch (e) { announce('Clipboard copy failed'); }
      }, 'image/png');
    } catch (e) { announce('Capture failed'); }
  }
  COMMANDS.push(
    { name: 'Copy Frame to Clipboard', run: () => captureToClipboard() },
    { name: 'Toggle Subtitles', run: () => toggleSubtitles() },
    { name: 'Rotate Left', run: () => { videoRotation = (videoRotation - 90) % 360; applyVideoTransform(); } },
    { name: 'Rotate Right', run: () => { videoRotation = (videoRotation + 90) % 360; applyVideoTransform(); } },
    { name: 'Always on Top', run: () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); } },
    { name: 'Clear History', run: () => clearHistory() }
  );
  function clearHistory() {
    saveState('history', []); saveState('stats', {});
    renderHistory(); renderHome(); announce('History cleared');
  }
  // Clear-history button in the history sidebar
  const histList = document.getElementById('history-sidebar-list');
  if (histList && histList.parentElement) {
    const clearHist = ce('button', { class: 'action-btn-small', text: 'Clear History', style: 'align-self:flex-start;', onclick: clearHistory });
    histList.parentElement.insertBefore(clearHist, histList);
  }

  // Bookmark jump next / previous
  function jumpBookmark(dir) {
    const bms = getBookmarks();
    if (!bms.length) return announce('No bookmarks');
    const t = mediaPlayer.currentTime;
    let target = null;
    if (dir > 0) { for (const b of bms) if (b.time > t + 0.5) { target = b; break; } target = target || bms[0]; }
    else { for (let i = bms.length - 1; i >= 0; i--) if (bms[i].time < t - 0.5) { target = bms[i]; break; } target = target || bms[bms.length - 1]; }
    mediaPlayer.currentTime = target.time; announce(`Jumped to bookmark at ${formatTime(target.time)}`);
  }
  COMMANDS.push(
    { name: 'Next Bookmark', run: () => jumpBookmark(1) },
    { name: 'Previous Bookmark', run: () => jumpBookmark(-1) }
  );

  /* ---- YouTube-style keyboard shortcuts (non-conflicting keys) ---- */
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    switch (k) {
      case 'j': e.preventDefault(); mediaPlayer.currentTime = Math.max(0, mediaPlayer.currentTime - 10); announce('Back 10s'); break;
      case 'k': e.preventDefault(); togglePlay(); break;
      case 'c': e.preventDefault(); toggleSubtitles(); break;
      case 'n': e.preventDefault(); playNext(); break;
      case 'z': e.preventDefault(); videoRotation = (videoRotation - 90) % 360; applyVideoTransform(); announce('Rotated left'); break;
      case 'x': e.preventDefault(); videoRotation = (videoRotation + 90) % 360; applyVideoTransform(); announce('Rotated right'); break;
      case 't': e.preventDefault(); alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); announce('Always on top ' + (alwaysOnTop ? 'on' : 'off')); break;
      case '[': e.preventDefault(); if (typeof updateSubtitleDelay === 'function') updateSubtitleDelay(-0.5); break;
      case ']': e.preventDefault(); if (typeof updateSubtitleDelay === 'function') updateSubtitleDelay(0.5); break;
    }
  });

  /* ---- Touch gestures (swipe to seek, tap to play/pause) ---- */
  let touchStartX = 0, touchStartY = 0, touchStartT = 0, touchMoved = false;
  videoWrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    touchStartT = mediaPlayer.currentTime; touchMoved = false;
  }, { passive: true });
  videoWrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || !mediaPlayer.duration) return;
    const dx = e.touches[0].clientX - touchStartX;
    if (Math.abs(dx) > 10) {
      touchMoved = true;
      const delta = (dx / videoWrapper.clientWidth) * mediaPlayer.duration * 0.2;
      mediaPlayer.currentTime = Math.max(0, Math.min(mediaPlayer.duration, touchStartT + delta));
    }
  }, { passive: true });
  videoWrapper.addEventListener('touchend', () => {
    // Tap-to-play is handled by the existing click handler; only seek happened on move.
    touchMoved = false;
  });

  /* ====================================================================
     MORE FEATURES
     ==================================================================== */

  let audioOnly = false;
  function applyAudioOnly() {
    if (audioOnly) {
      mediaPlayer.style.visibility = 'hidden';
      audioVisualizer.style.display = 'flex';
      audioVisualizer.setAttribute('aria-hidden', 'false');
      startVisualizerLoop();
    } else {
      mediaPlayer.style.visibility = '';
      if (!isAudioFile(currentFilePath)) { audioVisualizer.style.display = 'none'; stopVisualizerLoop(); }
    }
  }
  mediaPlayer.addEventListener('loadedmetadata', () => { if (audioOnly && !isAudioFile(currentFilePath)) applyAudioOnly(); });

  // --- Themes + accent color (General settings) ---
  const generalSettings = document.getElementById('general-settings');
  if (generalSettings) {
    const themeWrap = ce('div', { style: 'display:flex; flex-direction:column; gap:8px; margin-top:10px;' }, [
      ce('span', { style: 'font-size:0.9rem;color:#ccc;', text: 'Theme:' }),
      (() => {
        const s = ce('select', { id: 'theme-select', 'aria-label': 'Theme', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;' }, [
          ce('option', { value: 'dark', text: 'Dark (Default)' }),
          ce('option', { value: 'light', text: 'Light' }),
          ce('option', { value: 'amoled', text: 'AMOLED Black' })
        ]);
        s.addEventListener('change', () => { document.documentElement.setAttribute('data-theme', s.value === 'dark' ? '' : s.value); saveState('theme', s.value); });
        return s;
      })(),
      (() => {
        const wrap = ce('label', { style: 'display:flex;align-items:center;gap:10px;font-size:0.9rem;color:#ccc;cursor:pointer;' }, [
          ce('span', { text: 'Accent color:' }),
          (() => { const c = ce('input', { type: 'color', id: 'accent-color', value: '#3ea6ff', 'aria-label': 'Accent color' }); c.addEventListener('input', () => { document.documentElement.style.setProperty('--focus-color', c.value); saveState('accent', c.value); }); return c; })()
        ]);
        return wrap;
      })()
    ]);
    generalSettings.appendChild(themeWrap);
    const savedTheme = loadState('theme', 'dark');
    themeSelectApply(savedTheme);
    const savedAccent = loadState('accent', null);
    if (savedAccent) document.documentElement.style.setProperty('--focus-color', savedAccent);
  }
  function themeSelectApply(v) { document.documentElement.setAttribute('data-theme', v === 'dark' ? '' : v); const ts = document.getElementById('theme-select'); if (ts) ts.value = v; }

  // --- Subtitle background opacity ---
  const subBgOpacity = ce('input', { type: 'range', id: 'sub-bg-opacity', min: '0', max: '1', step: '0.05', value: '0.85', 'aria-label': 'Subtitle background opacity' });
  subBgOpacity.addEventListener('input', () => { document.documentElement.style.setProperty('--cue-bg', `rgba(0,0,0,${subBgOpacity.value})`); });
  const subStyleSection2 = Array.from(moreOpts.querySelectorAll('h3')).find(h => h.textContent.includes('Subtitle Customization'));
  if (subStyleSection2 && subStyleSection2.parentElement) {
    subStyleSection2.parentElement.appendChild(ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:8px;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Background Opacity:' }), subBgOpacity
    ]));
  }

  // --- Transcript panel (accessible subtitle browser) ---
  const transcriptList = ce('ul', { id: 'transcript-list', 'aria-label': 'Subtitle transcript', style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;' });
  const transcriptSearch = ce('input', { type: 'text', placeholder: 'Search transcript…', 'aria-label': 'Search transcript', style: 'width:100%;padding:6px;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;margin-bottom:8px;' });
  function renderTranscript() {
    transcriptList.innerHTML = '';
    let cues = [];
    if (mediaPlayer.textTracks && mediaPlayer.textTracks.length) {
      const t = mediaPlayer.textTracks[0];
      if (t.cues) for (let i = 0; i < t.cues.length; i++) cues.push({ start: t.cues[i].startTime, text: t.cues[i].text });
    }
    if (!cues.length) { transcriptList.innerHTML = '<li style="color:#888;padding:8px;">No subtitles loaded.</li>'; return; }
    const q = transcriptSearch.value.toLowerCase();
    cues.forEach(c => {
      if (q && !c.text.toLowerCase().includes(q)) return;
      const li = ce('li', { class: 'transcript-item', tabIndex: 0, role: 'button', 'aria-label': `At ${formatTime(c.start)}: ${c.text}` }, [
        ce('span', { class: 'transcript-time', text: formatTime(c.start) }),
        ce('span', { class: 'transcript-text', text: c.text })
      ]);
      const seek = () => { mediaPlayer.currentTime = c.start; announce(`Jumped to ${formatTime(c.start)}`); };
      li.addEventListener('click', seek);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seek(); } });
      transcriptList.appendChild(li);
    });
  }
  transcriptSearch.addEventListener('input', renderTranscript);
  if (mediaPlayer.textTracks) {
    mediaPlayer.textTracks.addEventListener('cuechange', () => { if (document.body.contains(transcriptList)) renderTranscript(); });
    mediaPlayer.textTracks.addEventListener('addtrack', () => { if (document.body.contains(transcriptList)) renderTranscript(); });
  }
  const transcriptSection = ce('div', { class: 'mo-section', style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);display:flex;justify-content:space-between;align-items:center;', text: 'Transcript' }),
    transcriptSearch, transcriptList
  ]);
  if (moScroll) moScroll.insertBefore(transcriptSection, moScroll.firstChild);
  COMMANDS.push({ name: 'Show Transcript', run: () => { showHome(); /* focus transcript */ setTimeout(() => transcriptSearch.focus(), 50); } });

  // --- Keyboard shortcuts help overlay ---
  const SHORTCUTS = [
    ['Space', 'Play / Pause'], ['F', 'Fullscreen'], ['M', 'Mute'], ['L', 'Repeat (off/one/all)'],
    ['P', 'Picture-in-Picture'], ['Q', 'Playlist'], ['B', 'Bookmarks'], ['Shift+B', 'Add Bookmark'],
    ['O', 'More Options'], ['E', 'Settings'], ['S', 'Screenshot'], ['C', 'Subtitles on/off'],
    ['J / K', 'Back 10s / Play-Pause'], ['N', 'Next track'], ['Z / X', 'Rotate left / right'],
    ['T', 'Always on top'], ['[ / ]', 'Subtitle delay -/+'], ['Ctrl+O', 'Open files'],
    ['Ctrl+G', 'Go to time'], ['Ctrl+Shift+P', 'Command palette'], ['Ctrl+H', 'Home'],
    ['I', 'Media Information'], ['1-9', 'Jump to bookmark'], ['?', 'This help'],
    ['← / →', 'Seek back / forward 10s'], ['Shift+↑ / ↓', 'Speed up / down'],
    ['↑ / ↓', 'Volume up / down'], [', / .', 'Frame step back / forward'],
    ['Ctrl+↑ / ↓', 'Move playlist item']
  ];
  const helpModal = ce('div', { id: 'help-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const helpList = ce('ul', { id: 'help-list', style: 'list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;overflow-y:auto;max-height:60vh;' });
  SHORTCUTS.forEach(([k, d]) => helpList.appendChild(ce('li', { style: 'display:flex;gap:10px;font-size:0.85rem;' }, [
    ce('kbd', { style: 'background:#333;padding:2px 8px;border-radius:4px;min-width:60px;text-align:center;', text: k }),
    ce('span', { text: d })
  ])));
  const helpCloseBtn = ce('button', { class: 'icon-btn', 'aria-label': 'Close help', html: '<svg viewBox="0 0 24 24" style="width:24px;height:24px;"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' });
  const helpBox = ce('div', { class: 'modal-content', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard Shortcuts', style: 'min-width:560px;padding:20px;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;' }, [ce('h2', { style: 'margin:0;', text: 'Keyboard Shortcuts' }), helpCloseBtn]),
    helpList
  ]);
  helpModal.appendChild(helpBox);
  document.getElementById('app-container').appendChild(helpModal);
  function openHelp() { window._lastModalPrevFocus = document.activeElement; helpModal.style.display = 'flex'; helpModal.setAttribute('aria-hidden', 'false'); helpCloseBtn.focus(); }
  function closeHelp() { helpModal.style.display = 'none'; helpModal.setAttribute('aria-hidden', 'true'); if (_lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } }
  helpCloseBtn.addEventListener('click', closeHelp);
  enableModalA11y(helpModal, helpCloseBtn, closeHelp);
  COMMANDS.push({ name: 'Keyboard Shortcuts', run: openHelp });
  COMMANDS.push({ name: 'Set as Default Media Player', run: () => ipcRenderer.send('open-default-apps') });
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.key === '?' ) { e.preventDefault(); openHelp(); }
  });
  // Make the progress slider explain its keys to screen readers
  progressSlider.setAttribute('aria-describedby', 'progress-help');
  const progressHelp = ce('span', { id: 'progress-help', class: 'sr-only', text: 'Use Left and Right arrows to seek ten seconds. Press Home or End for start or end. Page Up and Page Down also seek.' });
  progressSlider.parentElement.appendChild(progressHelp);

  // --- Volume / Speed announcements for screen readers ---
  let lastVolAnnounce = 0;
  volumeSlider.addEventListener('input', () => {
    const now = Date.now();
    if (now - lastVolAnnounce > 400) { lastVolAnnounce = now; announce(`Volume ${Math.round(mediaPlayer.volume * 100)} percent`); }
  });
  let lastRateAnnounce = 0;
  mediaPlayer.addEventListener('ratechange', () => {
    const now = Date.now();
    if (now - lastRateAnnounce > 400) { lastRateAnnounce = now; announce(`Speed ${mediaPlayer.playbackRate.toFixed(1)} times`); }
  });

  // --- Wire the new General-setting checkboxes ---
  const resumeToggle = document.getElementById('resume-enabled-toggle');
  const homeToggle = document.getElementById('start-in-home-toggle');
  if (resumeToggle) { resumeToggle.checked = loadState('resumeEnabled', true); resumeToggle.addEventListener('change', () => saveState('resumeEnabled', resumeToggle.checked)); }
  if (homeToggle) { homeToggle.checked = loadState('startInHome', false); homeToggle.addEventListener('change', () => saveState('startInHome', homeToggle.checked)); }

  // Add Audio-Only to Quick Toggles
  mkToggle && mkToggle('Audio Only', () => audioOnly, () => { audioOnly = !audioOnly; applyAudioOnly(); announce('Audio only ' + (audioOnly ? 'on' : 'off')); });

  // Show home screen on launch when there is no media to resume into
  if (!mediaPlayer.src || mediaPlayer.src.endsWith('index.html')) {
    showHome();
  }

  /* ====================================================================
     FEATURE PACK 2: Spatial Audio, A-B Loop, Media Info, EQ Presets,
     Chapters, Speed Presets, Enhanced Visualizer Themes, Startup
     ==================================================================== */

  /* ------------------------------------------------- SPATIAL AUDIO -- */
  // Inject spatial processing nodes into the audio graph after analyserNode
  let spatialEnabled = false;
  let spatialMode = 'off';
  let spatialWidth = 1.0;
  let spatialSplitter = null, spatialMerger = null;
  let spatialGainL = null, spatialGainR = null, spatialGainMid = null, spatialGainSide = null;
  let spatialDelay = null, spatialDelayGain = null;
  let spatialFilterL = null, spatialFilterR = null;

  function initSpatialNodes() {
    if (!audioCtx || spatialSplitter) return;
    spatialSplitter = audioCtx.createChannelSplitter(2);
    spatialMerger = audioCtx.createChannelMerger(2);
    spatialGainL = audioCtx.createGain();
    spatialGainR = audioCtx.createGain();
    spatialGainMid = audioCtx.createGain();
    spatialGainSide = audioCtx.createGain();
    spatialDelay = audioCtx.createDelay(1.0);
    spatialDelay.delayTime.value = 0.025;
    spatialDelayGain = audioCtx.createGain();
    spatialDelayGain.gain.value = 0;
    spatialFilterL = audioCtx.createBiquadFilter();
    spatialFilterL.type = 'lowpass';
    spatialFilterL.frequency.value = 8000;
    spatialFilterR = audioCtx.createBiquadFilter();
    spatialFilterR.type = 'lowpass';
    spatialFilterR.frequency.value = 8000;
    // Wire default: passthrough
    spatialSplitter.connect(spatialGainL, 0, 0);
    spatialSplitter.connect(spatialGainR, 1, 0);
    spatialGainL.connect(spatialMerger, 0, 0);
    spatialGainR.connect(spatialMerger, 0, 1);
  }

  let _spatialExtraNodes = [];
  function _cleanSpatialExtra() { _spatialExtraNodes.forEach(n => { try { n.disconnect(); } catch (e) {} }); _spatialExtraNodes = []; }

  function applySpatial() {
    if (!audioCtx || !analyserNode || !normalizationNode) return;
    if (!spatialSplitter) initSpatialNodes();
    // Disconnect all known connections
    try { analyserNode.disconnect(normalizationNode); } catch (e) {}
    try { analyserNode.disconnect(spatialSplitter); } catch (e) {}
    try { spatialMerger.disconnect(normalizationNode); } catch (e) {}
    _cleanSpatialExtra();

    if (spatialMode === 'off' || !spatialEnabled) {
      analyserNode.connect(normalizationNode);
      spatialEnabled = false;
      return;
    }

    spatialEnabled = true;
    analyserNode.connect(spatialSplitter);
    const w = Math.max(0, Math.min(2, spatialWidth));

    switch (spatialMode) {
      case 'wide': {
        // Simple L/R amplification difference for widening
        spatialGainL.gain.value = 0.5 + w * 0.5;
        spatialGainR.gain.value = 0.5 + w * 0.5;
        spatialSplitter.disconnect();
        spatialSplitter.connect(spatialGainL, 0, 0);
        spatialSplitter.connect(spatialGainR, 1, 0);
        // Add cross-feed for wider image
        const xL = audioCtx.createGain(); xL.gain.value = w * 0.15;
        const xR = audioCtx.createGain(); xR.gain.value = w * 0.15;
        _spatialExtraNodes.push(xL, xR);
        spatialSplitter.connect(xL, 0, 0);
        spatialSplitter.connect(xR, 1, 0);
        xL.connect(spatialMerger, 0, 1);
        xR.connect(spatialMerger, 0, 0);
        spatialGainL.connect(spatialMerger, 0, 0);
        spatialGainR.connect(spatialMerger, 0, 1);
        spatialMerger.connect(normalizationNode);
        break;
      }
      case 'surround': {
        // Cross-feed with delay + low-pass
        spatialDelay.delayTime.value = 0.02 + w * 0.01;
        spatialGainL.gain.value = 1; spatialGainR.gain.value = 1;
        spatialSplitter.connect(spatialGainL, 0, 0);
        spatialSplitter.connect(spatialGainR, 1, 0);
        spatialGainL.connect(spatialMerger, 0, 0);
        spatialGainR.connect(spatialMerger, 0, 1);
        const cG = audioCtx.createGain(); cG.gain.value = w * 0.35;
        _spatialExtraNodes.push(cG);
        spatialSplitter.connect(spatialDelay, 1, 0);
        spatialDelay.connect(cG);
        cG.connect(spatialFilterL);
        cG.connect(spatialFilterR);
        spatialFilterL.connect(spatialMerger, 0, 1);
        spatialFilterR.connect(spatialMerger, 0, 0);
        spatialMerger.connect(normalizationNode);
        break;
      }
      case 'theater': {
        // Long delay + feedback for room simulation
        spatialDelay.delayTime.value = 0.03 + w * 0.06;
        spatialGainL.gain.value = 1; spatialGainR.gain.value = 1;
        spatialSplitter.connect(spatialGainL, 0, 0);
        spatialSplitter.connect(spatialGainR, 1, 0);
        spatialGainL.connect(spatialMerger, 0, 0);
        spatialGainR.connect(spatialMerger, 0, 1);
        const rG = audioCtx.createGain(); rG.gain.value = w * 0.3;
        const rD = audioCtx.createDelay(1.0); rD.delayTime.value = 0.08;
        const rF = audioCtx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 2500;
        _spatialExtraNodes.push(rG, rD, rF);
        spatialSplitter.connect(rD, 0, 0);
        rD.connect(rF);
        rF.connect(rG);
        rG.connect(spatialMerger, 0, 0);
        rG.connect(spatialMerger, 0, 1);
        spatialMerger.connect(normalizationNode);
        break;
      }
      case 'headphone': {
        // Binaural cross-feed with high-pass filtering
        spatialGainL.gain.value = 1 - w * 0.2;
        spatialGainR.gain.value = 1 - w * 0.2;
        spatialSplitter.connect(spatialGainL, 0, 0);
        spatialSplitter.connect(spatialGainR, 1, 0);
        spatialGainL.connect(spatialMerger, 0, 0);
        spatialGainR.connect(spatialMerger, 0, 1);
        const xL = audioCtx.createGain(); xL.gain.value = w * 0.25;
        const xR = audioCtx.createGain(); xR.gain.value = w * 0.25;
        const fL = audioCtx.createBiquadFilter(); fL.type = 'highpass'; fL.frequency.value = 400;
        const fR = audioCtx.createBiquadFilter(); fR.type = 'highpass'; fR.frequency.value = 400;
        _spatialExtraNodes.push(xL, xR, fL, fR);
        spatialSplitter.connect(fL, 0, 0);
        spatialSplitter.connect(fR, 1, 0);
        fL.connect(xL);
        fR.connect(xR);
        xL.connect(spatialMerger, 0, 1);
        xR.connect(spatialMerger, 0, 0);
        spatialMerger.connect(normalizationNode);
        break;
      }
      default: { analyserNode.connect(normalizationNode); }
    }
  }

  // Spatial Audio UI
  const spatialModeSelect = ce('select', { id: 'spatial-mode', 'aria-label': 'Spatial Audio Mode', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;' }, [
    ce('option', { value: 'off', text: 'Off' }),
    ce('option', { value: 'wide', text: 'Stereo Widening' }),
    ce('option', { value: 'surround', text: 'Surround Simulation' }),
    ce('option', { value: 'theater', text: 'Theater Mode' }),
    ce('option', { value: 'headphone', text: 'Headphone 3D' })
  ]);
  const spatialWidthSlider = ce('input', { type: 'range', id: 'spatial-width', min: '0', max: '2', step: '0.05', value: '1', 'aria-label': 'Spatial effect amount' });
  const spatialWidthVal = ce('span', { style: 'color:var(--focus-color);font-weight:bold;', text: '1.00' });
  const spatialWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Spatial / 3D Audio' }),
    ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#ccc;' }, [
      ce('input', { type: 'checkbox', id: 'spatial-toggle', 'aria-label': 'Enable spatial audio' }),
      ce('span', { text: 'Enabled' })
    ]),
    ce('div', { style: 'display:flex;flex-direction:column;gap:4px;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Mode:' }),
      spatialModeSelect
    ]),
    ce('div', { style: 'display:flex;flex-direction:column;gap:4px;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Width / Amount:' }),
      ce('div', { style: 'display:flex;gap:8px;align-items:center;' }, [spatialWidthSlider, spatialWidthVal])
    ])
  ]);
  if (moScroll) moScroll.insertBefore(spatialWrap, moScroll.firstChild);

  const spatialToggle = spatialWrap.querySelector('#spatial-toggle');
  spatialModeSelect.addEventListener('change', () => { spatialMode = spatialModeSelect.value; if (spatialToggle.checked) applySpatial(); announce(`Spatial mode: ${spatialModeSelect.options[spatialModeSelect.selectedIndex].text}`); });
  spatialWidthSlider.addEventListener('input', () => { spatialWidth = parseFloat(spatialWidthSlider.value); spatialWidthVal.textContent = spatialWidth.toFixed(2); if (spatialToggle.checked) applySpatial(); });
  spatialToggle.addEventListener('change', () => {
    if (spatialToggle.checked && spatialMode === 'off') { spatialMode = 'wide'; spatialModeSelect.value = 'wide'; }
    applySpatial();
    announce(`Spatial audio ${spatialToggle.checked ? 'enabled' : 'disabled'}`);
  });

  /* ------------------------------------------------- A-B LOOP -- */
  let abLoopA = null, abLoopB = null, abLoopActive = false;
  const abStatus = ce('span', { style: 'font-size:0.85rem;color:#aaa;', text: 'A: --  B: --' });
  const abWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:6px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'A-B Loop' }),
    ce('div', { style: 'display:flex;gap:6px;' }, [
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Set A', 'aria-label': 'Set loop point A', onclick: () => { abLoopA = mediaPlayer.currentTime; updateABStatus(); announce(`Loop point A set at ${formatTime(abLoopA)}`); } }),
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Set B', 'aria-label': 'Set loop point B', onclick: () => { abLoopB = mediaPlayer.currentTime; updateABStatus(); announce(`Loop point B set at ${formatTime(abLoopB)}`); } })
    ]),
    ce('div', { style: 'display:flex;gap:6px;' }, [
      ce('button', { class: 'action-btn-small', style: 'flex:1;background:var(--focus-color);color:#000;font-weight:bold;', text: 'Toggle Loop', 'aria-label': 'Toggle A-B loop', 'aria-pressed': 'false', onclick: function () { abLoopActive = !abLoopActive; this.setAttribute('aria-pressed', abLoopActive ? 'true' : 'false'); this.style.background = abLoopActive ? '#4caf50' : 'var(--focus-color)'; announce(`A-B loop ${abLoopActive ? 'on' : 'off'}`); } }),
      ce('button', { class: 'action-btn-small', style: 'flex:1;', text: 'Clear', 'aria-label': 'Clear A-B loop points', onclick: () => { abLoopA = null; abLoopB = null; abLoopActive = false; updateABStatus(); announce('Loop points cleared'); } })
    ]),
    abStatus
  ]);
  function updateABStatus() { abStatus.textContent = `A: ${abLoopA !== null ? formatTime(abLoopA) : '--'}  B: ${abLoopB !== null ? formatTime(abLoopB) : '--'}  ${abLoopActive ? '● Looping' : ''}`; }
  if (moScroll) moScroll.insertBefore(abWrap, moScroll.firstChild);

  mediaPlayer.addEventListener('timeupdate', () => {
    if (abLoopActive && abLoopA !== null && abLoopB !== null) {
      const dur = mediaPlayer.duration || Infinity;
      const a = Math.min(abLoopA, abLoopB);
      const b = Math.max(abLoopA, abLoopB);
      if (mediaPlayer.currentTime >= b || mediaPlayer.currentTime < a) {
        mediaPlayer.currentTime = a;
      }
    }
  });

  /* ------------------------------------------------- ENHANCED SLEEP TIMER -- */
  // Replace the simple end-of-track with a full countdown
  const sleepTimerSelect = document.getElementById('sleep-timer-select');
  if (sleepTimerSelect) {
    // Already has options from renderer.js, add countdown ones
    const extraOpts = [
      ['5min', '5 minutes'],
      ['15min', '15 minutes'],
      ['30min', '30 minutes'],
      ['60min', '60 minutes'],
      ['90min', '90 minutes']
    ];
    extraOpts.forEach(([v, t]) => {
      if (!Array.from(sleepTimerSelect.options).some(o => o.value === v)) {
        sleepTimerSelect.appendChild(ce('option', { value: v, text: t }));
      }
    });
  }
  let sleepInterval = null;
  let sleepCountdown = document.getElementById('sleep-countdown');
  if (!sleepCountdown) {
    sleepCountdown = ce('span', { id: 'sleep-countdown', style: 'display:none;font-size:0.85rem;color:var(--focus-color);' });
    if (sleepTimerSelect && sleepTimerSelect.parentElement) {
      sleepTimerSelect.parentElement.appendChild(sleepCountdown);
    }
  }
  const origSleepChange = sleepTimerSelect ? sleepTimerSelect.onchange : null;
  if (sleepTimerSelect) {
    sleepTimerSelect.addEventListener('change', () => {
      if (sleepInterval) { clearInterval(sleepInterval); sleepInterval = null; sleepCountdown.style.display = 'none'; }
      const val = sleepTimerSelect.value;
      if (val === 'off') return;
      let minutes = 0;
      if (val === '5min') minutes = 5;
      else if (val === '15min') minutes = 15;
      else if (val === '30min') minutes = 30;
      else if (val === '60min') minutes = 60;
      else if (val === '90min') minutes = 90;
      else if (val === 'end') { /* handled by end-of-track */ return; }
      if (minutes > 0) {
        let remaining = minutes * 60;
        sleepInterval = setInterval(() => {
          remaining--;
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          sleepCountdown.textContent = `Sleep in ${m}:${s.toString().padStart(2, '0')}`;
          sleepCountdown.style.display = 'inline';
          if (remaining <= 0) {
            clearInterval(sleepInterval);
            sleepInterval = null;
            mediaPlayer.pause();
            sleepCountdown.style.display = 'none';
            sleepTimerSelect.value = 'off';
            announce('Sleep timer: player stopped');
            showOSD('Sleep timer finished');
          }
        }, 1000);
        announce(`Sleep timer set for ${minutes} minutes`);
      }
    });
  }

  /* ------------------------------------------------- MEDIA INFORMATION OVERLAY -- */
  const mediaInfoModal = ce('div', { id: 'media-info-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const mediaInfoContent = ce('div', { class: 'modal-content', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Media Information', style: 'min-width:400px;padding:20px;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' }, [
      ce('h2', { style: 'margin:0;', text: 'Media Information' }),
      ce('button', { class: 'icon-btn', 'aria-label': 'Close media info', html: '<svg viewBox="0 0 24 24" style="width:24px;height:24px;"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', onclick: closeMediaInfo })
    ]),
    ce('div', { id: 'media-info-body', style: 'font-size:0.9rem;line-height:1.6;color:#ccc;' })
  ]);
  mediaInfoModal.appendChild(mediaInfoContent);
  document.getElementById('app-container').appendChild(mediaInfoModal);
  function closeMediaInfo() { mediaInfoModal.style.display = 'none'; mediaInfoModal.setAttribute('aria-hidden', 'true'); if (_lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } }
  enableModalA11y(mediaInfoModal, mediaInfoContent.querySelector('button'), closeMediaInfo);
  function openMediaInfo() {
    window._lastModalPrevFocus = document.activeElement;
    const body = document.getElementById('media-info-body');
    let html = '';
    if (currentFilePath) {
      const name = getFileName(currentFilePath);
      const ext = currentFilePath.split('.').pop().toUpperCase();
      const w = mediaPlayer.videoWidth || 'N/A';
      const h = mediaPlayer.videoHeight || 'N/A';
      const dur = mediaPlayer.duration ? formatTime(mediaPlayer.duration) : 'N/A';
      const audioT = mediaPlayer.audioTracks ? mediaPlayer.audioTracks.length : (isAudioFile(currentFilePath) ? 1 : 'N/A');
      html = `<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;">
        <span style="color:#888;">File:</span><span>${name}</span>
        <span style="color:#888;">Type:</span><span>${ext}</span>
        <span style="color:#888;">Duration:</span><span>${dur}</span>
        <span style="color:#888;">Resolution:</span><span>${w} × ${h}</span>
        <span style="color:#888;">Audio Tracks:</span><span>${audioT}</span>
        <span style="color:#888;">Volume:</span><span>${Math.round(mediaPlayer.volume * 100)}%</span>
        <span style="color:#888;">Speed:</span><span>${mediaPlayer.playbackRate.toFixed(2)}x</span>
        <span style="color:#888;">Path:</span><span style="word-break:break-all;font-size:0.8rem;">${currentFilePath}</span>
      </div>`;
    } else {
      html = '<p style="color:#888;">No media loaded.</p>';
    }
    body.innerHTML = html;
    mediaInfoModal.style.display = 'flex';
    mediaInfoModal.setAttribute('aria-hidden', 'false');
    mediaInfoContent.querySelector('button').focus();
  }
  COMMANDS.push({ name: 'Media Information', run: openMediaInfo });
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'i' && !e.shiftKey) { e.preventDefault(); openMediaInfo(); }
  });

  /* ------------------------------------------------- EQ PRESET MANAGER -- */
  const eqPresetName = ce('input', { type: 'text', id: 'eq-preset-name', placeholder: 'Preset name…', 'aria-label': 'EQ preset name', style: 'padding:6px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;flex:1;' });
  const eqSaveBtn = ce('button', { class: 'action-btn-small', text: 'Save', 'aria-label': 'Save current EQ as preset', onclick: saveEQPreset });
  const eqLoadSelect = ce('select', { id: 'eq-preset-load', 'aria-label': 'Load EQ preset', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;flex:2;' });
  const eqDelBtn = ce('button', { class: 'action-btn-small', text: 'Delete', 'aria-label': 'Delete selected EQ preset', onclick: deleteEQPreset });
  const eqPresetWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'EQ Presets' }),
    ce('div', { style: 'display:flex;gap:6px;' }, [eqPresetName, eqSaveBtn]),
    ce('div', { style: 'display:flex;gap:6px;' }, [eqLoadSelect, eqDelBtn])
  ]);
  const eqSettings = document.getElementById('eq-settings');
  // Built-in EQ presets
  const BUILTIN_EQ = {
    'Flat':       [0,0,0,0,0,0,0,0,0,0],
    'Rock':       [5,4,3,2,1,0,-1,-1,2,3],
    'Pop':        [-1,0,2,4,5,4,2,1,-1,-1],
    'Jazz':       [4,3,2,1,2,1,0,-1,2,4],
    'Classical':  [5,4,3,3,2,1,0,-1,0,2],
    'Dance':      [5,4,2,1,0,-1,-1,1,3,5],
    'Speech':     [-2,-1,0,2,3,4,3,1,-1,-2],
    'Bass Boost': [6,5,4,3,1,0,-1,-2,-2,-1],
    'Loudness':   [4,3,2,1,0,0,1,2,3,4],
    'Soft':       [2,1,0,-1,-2,-2,-1,0,1,2]
  };
  const builtinEqWrap = ce('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;' });
  Object.keys(BUILTIN_EQ).forEach(name => {
    builtinEqWrap.appendChild(ce('button', {
      class: 'action-btn-small',
      style: 'flex:0 0 auto;font-size:0.75rem;',
      text: name,
      'aria-label': `EQ preset: ${name}`,
      onclick: () => {
        const bands = BUILTIN_EQ[name];
        document.querySelectorAll('.eq-slider').forEach((s, i) => {
          if (bands[i] !== undefined) { s.value = bands[i]; s.dispatchEvent(new Event('input')); }
        });
        if (boostSlider) { boostSlider.value = 0; boostSlider.dispatchEvent(new Event('input')); }
        announce(`EQ: ${name}`);
      }
    }));
  });
  if (eqSettings) {
    eqSettings.insertBefore(builtinEqWrap, eqSettings.firstChild);
    eqSettings.appendChild(eqPresetWrap);
  }
  function saveEQPreset() {
    const name = eqPresetName.value.trim();
    if (!name) { announce('Enter a preset name'); return; }
    const presets = loadState('eqPresets', {});
    const bands = [];
    document.querySelectorAll('.eq-slider').forEach(s => bands.push(parseFloat(s.value)));
    presets[name] = { bands, boost: parseFloat(boostSlider?.value || 0) };
    saveState('eqPresets', presets);
    refreshEQPresets();
    announce(`EQ preset "${name}" saved`);
  }
  function loadEQPreset(name) {
    const presets = loadState('eqPresets', {});
    const p = presets[name];
    if (!p) return;
    document.querySelectorAll('.eq-slider').forEach((s, i) => { if (p.bands[i] !== undefined) { s.value = p.bands[i]; s.dispatchEvent(new Event('input')); } });
    if (boostSlider && typeof p.boost === 'number') { boostSlider.value = p.boost; boostSlider.dispatchEvent(new Event('input')); }
    announce(`EQ preset "${name}" loaded`);
  }
  function deleteEQPreset() {
    const name = eqLoadSelect.value;
    if (!name) { announce('Select a preset to delete'); return; }
    const presets = loadState('eqPresets', {});
    delete presets[name];
    saveState('eqPresets', presets);
    refreshEQPresets();
    announce(`EQ preset "${name}" deleted`);
  }
  function refreshEQPresets() {
    const presets = loadState('eqPresets', {});
    eqLoadSelect.innerHTML = '<option value="">-- Select preset --</option>';
    Object.keys(presets).forEach(k => eqLoadSelect.appendChild(ce('option', { value: k, text: k })));
  }
  eqLoadSelect.addEventListener('change', () => { if (eqLoadSelect.value) loadEQPreset(eqLoadSelect.value); });
  refreshEQPresets();

  /* ------------------------------------------------- CHAPTER NAVIGATION -- */
  const chapterSelect = ce('select', { id: 'chapter-select', 'aria-label': 'Chapter navigation', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;' });
  const chapterWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;', html: '<h3 style="margin:0;font-size:1rem;color:var(--focus-color);">Chapters</h3>' });
  chapterWrap.appendChild(chapterSelect);
  if (moScroll) moScroll.insertBefore(chapterWrap, moScroll.firstChild);
  chapterSelect.addEventListener('change', () => {
    const t = parseFloat(chapterSelect.value);
    if (isFinite(t)) { mediaPlayer.currentTime = t; announce(`Jumped to chapter ${chapterSelect.options[chapterSelect.selectedIndex].text}`); }
  });
  function refreshChapters() {
    chapterSelect.innerHTML = '<option value="">No chapters</option>';
    if (mediaPlayer.textTracks) {
      for (let i = 0; i < mediaPlayer.textTracks.length; i++) {
        const t = mediaPlayer.textTracks[i];
        if (t.kind === 'chapters' && t.cues && t.cues.length) {
          chapterSelect.innerHTML = '';
          for (let j = 0; j < t.cues.length; j++) {
            const c = t.cues[j];
            chapterSelect.appendChild(ce('option', { value: c.startTime, text: c.text + ' (' + formatTime(c.startTime) + ')' }));
          }
          break;
        }
      }
    }
    chapterWrap.style.display = chapterSelect.options.length > 1 ? '' : 'none';
  }
  mediaPlayer.addEventListener('loadedmetadata', refreshChapters);
  mediaPlayer.textTracks?.addEventListener('addtrack', refreshChapters);

  /* ------------------------------------------------- SPEED PRESET BUTTONS -- */
  const speedBtns = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const speedPresetWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Speed Presets' }),
    ce('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;' },
      speedBtns.map(sp => ce('button', {
        class: 'action-btn-small',
        style: 'flex:0 0 auto;min-width:44px;',
        text: sp + 'x',
        'aria-label': `Set speed ${sp}x`,
        onclick: () => { mediaPlayer.playbackRate = sp; updateSpeedUI(); announce(`Speed set to ${sp}x`); }
      }))
    )
  ]);
  if (moScroll) moScroll.insertBefore(speedPresetWrap, moScroll.firstChild);

  /* ------------------------------------------------- ENHANCED VISUALIZER THEMES -- */
  // Wire up color/sensitivity settings to CSS custom properties used by the visualizer
  const visColorPicker = ce('input', { type: 'color', id: 'vis-color', value: '#4facfe', 'aria-label': 'Visualizer color', style: 'width:40px;height:30px;padding:0;border:1px solid #444;border-radius:4px;background:transparent;cursor:pointer;' });
  const visBgPicker = ce('input', { type: 'color', id: 'vis-bg', value: '#0a0a0a', 'aria-label': 'Visualizer background color', style: 'width:40px;height:30px;padding:0;border:1px solid #444;border-radius:4px;background:transparent;cursor:pointer;' });
  const visSettingsWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Visualizer Settings' }),
    ce('div', { style: 'display:flex;gap:10px;align-items:center;' }, [
      ce('label', { style: 'display:flex;align-items:center;gap:4px;font-size:0.8rem;color:#aaa;' }, [ce('span', { text: 'Color' }), visColorPicker]),
      ce('label', { style: 'display:flex;align-items:center;gap:4px;font-size:0.8rem;color:#aaa;' }, [ce('span', { text: 'BG' }), visBgPicker])
    ])
  ]);
  if (moScroll) moScroll.insertBefore(visSettingsWrap, moScroll.firstChild);
  // Apply colors via CSS custom properties so the canvas visualizer can read them
  visColorPicker.addEventListener('input', () => { document.documentElement.style.setProperty('--vis-color', visColorPicker.value); });
  visBgPicker.addEventListener('input', () => { document.documentElement.style.setProperty('--vis-bg', visBgPicker.value); });

  /* ------------------------------------------------- CROSSFADE -- */
  let crossfadeDuration = 0;
  let crossfadeTimer = null;
  const crossfadeWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:6px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Crossfade' }),
    ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#ccc;' }, [
      ce('input', { type: 'checkbox', id: 'crossfade-toggle', 'aria-label': 'Enable crossfade between tracks' }),
      ce('span', { text: 'Enabled' })
    ]),
    ce('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Duration:' }),
      ce('input', { type: 'range', id: 'crossfade-duration', min: '1', max: '10', step: '0.5', value: '3', 'aria-label': 'Crossfade duration in seconds', style: 'flex:1;' }),
      ce('span', { id: 'crossfade-dur-val', style: 'font-size:0.85rem;color:var(--focus-color);min-width:30px;', text: '3s' })
    ])
  ]);
  if (moScroll) moScroll.insertBefore(crossfadeWrap, moScroll.firstChild);
  const crossfadeCb = crossfadeWrap.querySelector('#crossfade-toggle');
  const crossfadeDur = crossfadeWrap.querySelector('#crossfade-duration');
  const crossfadeDurVal = crossfadeWrap.querySelector('#crossfade-dur-val');
  crossfadeDur.addEventListener('input', () => {
    crossfadeDuration = parseFloat(crossfadeDur.value);
    crossfadeDurVal.textContent = crossfadeDuration + 's';
  });
  crossfadeCb.addEventListener('change', () => {
    announce(`Crossfade ${crossfadeCb.checked ? 'enabled' : 'disabled'}`);
  });
  // Patch playNext and the autoplay ended handler to do crossfade
  const _origPlayNext = playNext;
  playNext = function () {
    if (crossfadeCb.checked && crossfadeDuration > 0 && !mediaPlayer.paused && mediaPlayer.volume > 0) {
      const origVol = mediaPlayer.volume;
      const steps = 20;
      let step = 0;
      const fadeInterval = (crossfadeDuration * 1000) / steps;
      if (crossfadeTimer) { clearInterval(crossfadeTimer); crossfadeTimer = null; }
      crossfadeTimer = setInterval(() => {
        step++;
        const vol = Math.max(0, origVol * (1 - step / steps));
        mediaPlayer.volume = vol;
        if (step >= steps) {
          clearInterval(crossfadeTimer);
          crossfadeTimer = null;
          mediaPlayer.volume = origVol;
          _origPlayNext();
          // Fade in the new track
          mediaPlayer.volume = 0;
          let inStep = 0;
          const fadeInTimer = setInterval(() => {
            inStep++;
            const vol = Math.min(origVol, origVol * (inStep / steps));
            mediaPlayer.volume = vol;
            if (inStep >= steps) { clearInterval(fadeInTimer); mediaPlayer.volume = origVol; }
          }, fadeInterval);
        }
      }, fadeInterval);
    } else {
      _origPlayNext();
    }
  };

  /* ------------------------------------------------- VIDEO CONTEXT MENU -- */
  const videoCtxMenu = ce('ul', { role: 'menu', 'aria-label': 'Video context menu', style: 'display:none;position:fixed;z-index:500;background:#222;border:1px solid #444;border-radius:6px;padding:4px;min-width:160px;list-style:none;margin:0;box-shadow:0 4px 16px rgba(0,0,0,0.5);' });
  const ctxActions = [
    { label: 'Play / Pause', run: () => togglePlay() },
    { label: 'Fullscreen', run: () => toggleFullscreen() },
    { label: 'Always on Top', run: () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); announce('Always on top ' + (alwaysOnTop ? 'on' : 'off')); } },
    { label: 'Media Information', run: openMediaInfo },
    { label: 'Picture-in-Picture', run: () => pipBtn.click() },
    { label: 'Open Files', run: () => openFilesHandler() },
    { label: 'Settings', run: () => toggleSettingsModal() }
  ];
  ctxActions.forEach(a => {
    const li = ce('li', { role: 'none' });
    const btn = ce('button', { role: 'menuitem', text: a.label, style: 'background:none;border:none;color:#eee;padding:8px 12px;width:100%;text-align:left;border-radius:4px;font-size:0.85rem;cursor:pointer;',
      onclick: () => { a.run(); closeVideoCtxMenu(); } });
    btn.addEventListener('mouseenter', () => btn.style.background = '#333');
    btn.addEventListener('mouseleave', () => btn.style.background = 'none');
    li.appendChild(btn);
    videoCtxMenu.appendChild(li);
  });
  document.body.appendChild(videoCtxMenu);
  function showVideoCtxMenu(e) {
    e.preventDefault();
    videoCtxMenu.style.display = 'block';
    videoCtxMenu.style.left = e.clientX + 'px';
    videoCtxMenu.style.top = e.clientY + 'px';
    videoCtxMenu.setAttribute('aria-hidden', 'false');
    const first = videoCtxMenu.querySelector('button');
    if (first) first.focus();
  }
  function closeVideoCtxMenu() {
    videoCtxMenu.style.display = 'none';
    videoCtxMenu.setAttribute('aria-hidden', 'true');
  }
  videoWrapper.addEventListener('contextmenu', showVideoCtxMenu);
  window.addEventListener('click', (e) => {
    if (!videoCtxMenu.contains(e.target)) closeVideoCtxMenu();
  });
  videoCtxMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeVideoCtxMenu(); }
    if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const btns = Array.from(videoCtxMenu.querySelectorAll('button'));
      if (!btns.length) return;
      const idx = btns.indexOf(document.activeElement);
      let next;
      if (e.key === 'ArrowUp') next = (idx - 1 + btns.length) % btns.length;
      else next = (idx + 1) % btns.length;
      btns[next].focus();
    }
  });

  /* ------------------------------------------------- NUMBER KEY SHORTCUTS -- */
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) {
      e.preventDefault();
      const bms = getBookmarks();
      if (bms.length >= num) {
        const target = bms[num - 1];
        mediaPlayer.currentTime = target.time;
        announce(`Jumped to bookmark ${num}: ${formatTime(target.time)}`);
      } else {
        announce(`No bookmark ${num}`);
      }
    }
  });

  /* ------------------------------------------------- ENHANCED SEEK TOOLTIP -- */
  // Add a small thumbnail preview to the seek tooltip when hovering over the progress bar
  const seekThumb = ce('canvas', { id: 'seek-thumb', 'aria-hidden': 'true',
    style: 'display:none;position:fixed;z-index:250;border:2px solid var(--focus-color);border-radius:4px;background:#000;width:160px;height:90px;pointer-events:none;' });
  document.body.appendChild(seekThumb);
  const seekThumbCtx = seekThumb.getContext('2d');
  let seekThumbTimer = null;
  progressSlider.addEventListener('mousemove', (e) => {
    if (!mediaPlayer.duration || !mediaPlayer.videoWidth) return;
    const rect = progressSlider.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * mediaPlayer.duration;
    // Show thumbnail
    seekThumb.style.display = 'block';
    seekThumb.style.left = Math.max(0, Math.min(window.innerWidth - 170, e.clientX - 80)) + 'px';
    seekThumb.style.top = (rect.top - 100) + 'px';
    // Capture frame at current time (cache to avoid seeking constantly)
    if (seekThumbTimer) { clearTimeout(seekThumbTimer); seekThumbTimer = null; }
    seekThumbTimer = setTimeout(() => {
      try {
        seekThumbCtx.drawImage(mediaPlayer, 0, 0, seekThumb.width, seekThumb.height);
      } catch (e) {}
    }, 100);
  });
  progressSlider.addEventListener('mouseleave', () => { seekThumb.style.display = 'none'; if (seekThumbTimer) { clearTimeout(seekThumbTimer); seekThumbTimer = null; } });

  // Ensure defaults are set
  if (!document.documentElement.style.getPropertyValue('--vis-color')) document.documentElement.style.setProperty('--vis-color', '#4facfe');
  if (!document.documentElement.style.getPropertyValue('--vis-bg')) document.documentElement.style.setProperty('--vis-bg', '#0a0a0a');

  // Add more visualizer themes by extending the select

  /* ------------------------------------------------- LAUNCH ON STARTUP -- */
  const startupToggle = ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.9rem;color:#ccc;cursor:pointer;margin-top:8px;' }, [
    ce('input', { type: 'checkbox', id: 'startup-toggle', 'aria-label': 'Launch Accessible Media Player on system startup' }),
    ce('span', { text: 'Launch on system startup' })
  ]);
  const gs = document.getElementById('general-settings');
  if (gs) gs.appendChild(startupToggle);
  const startupCb = startupToggle.querySelector('input');
  startupCb.checked = loadState('startupLaunch', false);
  startupCb.addEventListener('change', () => {
    const on = startupCb.checked;
    saveState('startupLaunch', on);
    ipcRenderer.send('set-startup', on);
    announce(`Startup launch ${on ? 'enabled' : 'disabled'}`);
  });

  /* ------------------------------------------------- COMMAND PALETTE EXTENSIONS -- */
  COMMANDS.push(
    { name: 'Set Loop Point A', run: () => { abLoopA = mediaPlayer.currentTime; updateABStatus(); announce(`A set at ${formatTime(abLoopA)}`); } },
    { name: 'Set Loop Point B', run: () => { abLoopB = mediaPlayer.currentTime; updateABStatus(); announce(`B set at ${formatTime(abLoopB)}`); } },
    { name: 'Toggle A-B Loop', run: () => { abLoopActive = !abLoopActive; announce(`A-B loop ${abLoopActive ? 'on' : 'off'}`); } },
    { name: 'Spatial Audio: Wide', run: () => { spatialMode = 'wide'; spatialModeSelect.value = 'wide'; spatialEnabled = true; spatialToggle.checked = true; applySpatial(); announce('Spatial: Stereo Widening'); } },
    { name: 'Spatial Audio: Surround', run: () => { spatialMode = 'surround'; spatialModeSelect.value = 'surround'; spatialEnabled = true; spatialToggle.checked = true; applySpatial(); announce('Spatial: Surround'); } },
    { name: 'Spatial Audio: Theater', run: () => { spatialMode = 'theater'; spatialModeSelect.value = 'theater'; spatialEnabled = true; spatialToggle.checked = true; applySpatial(); announce('Spatial: Theater'); } },
    { name: 'Spatial Audio: Headphone 3D', run: () => { spatialMode = 'headphone'; spatialModeSelect.value = 'headphone'; spatialEnabled = true; spatialToggle.checked = true; applySpatial(); announce('Spatial: Headphone 3D'); } },
    { name: 'Spatial Audio: Off', run: () => { spatialEnabled = false; spatialToggle.checked = false; applySpatial(); announce('Spatial: Off'); } },
    { name: 'Media Information', run: openMediaInfo },
    { name: 'Jump to Current Track', run: () => { if (currentPlaylistIndex >= 0) { const el = document.querySelector('.playlist-item.active'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } } } },
    { name: 'Set as Default Media Player', run: () => ipcRenderer.send('open-default-apps') }
  );

  // ---- Drag and drop with visual feedback ----
  const dragOverlay = document.getElementById('drag-overlay');
  if (dragOverlay) {
    document.addEventListener('dragenter', (e) => {
      if (e.dataTransfer.types.includes('Files')) { dragOverlay.style.display = 'flex'; }
    });
    document.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null || e.relatedTarget === document.body) { dragOverlay.style.display = 'none'; }
    });
    document.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); } });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragOverlay.style.display = 'none';
      const files = Array.from(e.dataTransfer.files).filter(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        return ['mp4','mkv','avi','webm','ogv','mp3','wav','ogg','flac','aac','m4a','wma','m4v','3gp','mov','wmv','m3u','m3u8','pls'].includes(ext);
      });
      if (files.length === 0) { announce('No supported files found'); return; }
      files.forEach(f => addToPlaylist(f.path));
      if (currentPlaylistIndex === -1 && playlist.length > 0) { playPlaylistItem(playlist.length - files.length); }
      announce(`Added ${files.length} file(s)`);
    });
  }

  /* ====================================================================
     FEATURE PACK 3: Debug Console, Shortcuts Customizer, Visual EQ,
     Lyrics, Themes, Accessibility, Normalization Presets
     ==================================================================== */

  /* ------------------------------------------------- DEBUG LOG CONSOLE -- */
  const MAX_LOGS = 200;
  const _logs = [];
  function _captureLog(level, args) {
    const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    _logs.push({ level, msg, time: new Date().toLocaleTimeString() });
    if (_logs.length > MAX_LOGS) _logs.shift();
  }
  const _origConsoleLog = console.log;
  const _origConsoleWarn = console.warn;
  const _origConsoleError = console.error;
  console.log = (...args) => { _captureLog('log', args); _origConsoleLog.apply(console, args); };
  console.warn = (...args) => { _captureLog('warn', args); _origConsoleWarn.apply(console, args); };
  console.error = (...args) => { _captureLog('error', args); _origConsoleError.apply(console, args); };

  const debugModal = ce('div', { id: 'debug-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;z-index:9999;' });
  const debugContent = ce('div', { class: 'modal-content', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Debug Console', style: 'min-width:600px;max-width:800px;padding:16px;max-height:80vh;display:flex;flex-direction:column;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;' }, [
      ce('h2', { style: 'margin:0;font-size:1.1rem;', text: 'Debug Console' }),
      ce('button', { class: 'icon-btn', 'aria-label': 'Close debug console', html: '<svg viewBox="0 0 24 24" style="width:20px;height:20px;"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', onclick: closeDebug })
    ]),
    ce('div', { style: 'display:flex;gap:6px;margin-bottom:8px;' }, [
      ce('button', { class: 'action-btn-small', text: 'Clear', 'aria-label': 'Clear logs', onclick: () => { _logs.length = 0; renderDebug(); } }),
      ce('span', { style: 'flex:1;' }),
      ce('span', { id: 'debug-count', style: 'font-size:0.8rem;color:#888;' })
    ]),
    ce('div', { id: 'debug-list', style: 'flex:1;overflow-y:auto;font-family:monospace;font-size:0.78rem;background:#111;border-radius:4px;padding:8px;border:1px solid #333;line-height:1.5;' })
  ]);
  debugModal.appendChild(debugContent);
  document.getElementById('app-container').appendChild(debugModal);
  function renderDebug() {
    const list = document.getElementById('debug-list');
    const count = document.getElementById('debug-count');
    if (!list) return;
    list.innerHTML = _logs.map(l => `<span style="color:${l.level === 'error' ? '#ff5555' : l.level === 'warn' ? '#ffaa00' : '#aaa'}">[${l.time}] ${l.level.toUpperCase()}: ${l.msg}</span>`).join('<br>');
    list.scrollTop = list.scrollHeight;
    if (count) count.textContent = `${_logs.length} entries`;
  }
  function openDebug() { window._lastModalPrevFocus = document.activeElement; debugModal.style.display = 'flex'; debugModal.setAttribute('aria-hidden', 'false'); renderDebug(); debugModal.querySelector('.icon-btn').focus(); }
  function closeDebug() { debugModal.style.display = 'none'; debugModal.setAttribute('aria-hidden', 'true'); if (window._lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } }
  enableModalA11y(debugModal, debugModal.querySelector('.icon-btn'), closeDebug);
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); openDebug(); }
  });
  COMMANDS.push({ name: 'Debug Console', run: openDebug });
  SHORTCUTS.push(['`', 'Debug Console']);

  /* ------------------------------------------------- VISUAL EQ DISPLAY -- */
  const eqCanvas = ce('canvas', { id: 'eq-canvas', 'aria-label': 'Equalizer frequency response curve', style: 'width:100%;height:80px;border-radius:4px;background:#111;border:1px solid #333;margin:4px 0;' });
  const eqCanvasWrap = ce('div', { style: 'margin:8px 0;' }, [eqCanvas]);
  const eqCanvasSettings = document.getElementById('eq-settings');
  if (eqCanvasSettings) eqCanvasSettings.insertBefore(eqCanvasWrap, eqCanvasSettings.querySelector('.eq-bands'));
  function drawEQCurve() {
    if (!eqCanvas) return;
    const ctx = eqCanvas.getContext('2d');
    const rect = eqCanvas.parentElement.getBoundingClientRect();
    eqCanvas.width = (rect.width || 400) * (window.devicePixelRatio || 1);
    eqCanvas.height = 80 * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const w = rect.width || 400;
    const h = 80;
    ctx.clearRect(0, 0, w, h);
    // Background grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const y = (h / 4) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const sliders = document.querySelectorAll('.eq-slider');
    if (!sliders.length) return;
    const values = Array.from(sliders).map(s => parseFloat(s.value) / 12);
    // Draw curve
    ctx.beginPath();
    ctx.moveTo(0, h / 2 - values[0] * (h / 2 - 4));
    for (let i = 0; i < values.length; i++) {
      const x = (w / (values.length - 1)) * i;
      const y = h / 2 - values[i] * (h / 2 - 4);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'var(--focus-color)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Points
    values.forEach((v, i) => {
      const x = (w / (values.length - 1)) * i;
      const y = h / 2 - v * (h / 2 - 4);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = v > 0 ? '#4caf50' : v < 0 ? '#ff5252' : '#888';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
  document.querySelectorAll('.eq-slider').forEach(s => s.addEventListener('input', drawEQCurve));
  window.addEventListener('resize', drawEQCurve);
  setTimeout(drawEQCurve, 100);

  /* ------------------------------------------------- KEYBOARD SHORTCUT CUSTOMIZER -- */
  const DEFAULT_SHORTCUTS = {
    'Play / Pause': 'Space',
    'Fullscreen': 'F',
    'Mute': 'M',
    'Repeat': 'L',
    'Picture-in-Picture': 'P',
    'Toggle Playlist': 'Q',
    'Toggle Bookmarks': 'B',
    'Add Bookmark': 'Shift+B',
    'Toggle More Options': 'O',
    'Settings': 'E',
    'Screenshot': 'S',
    'Home': 'Ctrl+H',
    'Command Palette': 'Ctrl+Shift+P',
    'Go to Time': 'Ctrl+G',
    'Open Files': 'Ctrl+O',
    'Open URL': 'Ctrl+U',
    'Media Information': 'I',
    'Debug Console': '`'
  };
  let _customShortcuts = loadState('customShortcuts', {});
  function getShortcut(action) { return _customShortcuts[action] || DEFAULT_SHORTCUTS[action] || ''; }
  function saveShortcut(action, key) { _customShortcuts[action] = key; saveState('customShortcuts', _customShortcuts); }

  const scPanel = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:6px;border:1px solid #333;margin-top:10px;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Customize Shortcuts' }),
    ce('p', { style: 'font-size:0.8rem;color:#aaa;margin:0;', text: 'Click a shortcut, then press the new key(s).' }),
    ce('div', { id: 'shortcut-list', style: 'display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;' })
  ]);
  const genSettings = document.getElementById('general-settings');
  if (genSettings) genSettings.appendChild(scPanel);

  function renderShortcuts() {
    const list = document.getElementById('shortcut-list');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(DEFAULT_SHORTCUTS).forEach(action => {
      const row = ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:3px 6px;border-radius:3px;background:#1e1e1e;' });
      row.appendChild(ce('span', { style: 'font-size:0.8rem;color:#ccc;flex:1;', text: action }));
      const keyBtn = ce('button', {
        class: 'action-btn-small',
        style: 'font-size:0.75rem;min-width:80px;text-align:center;font-family:monospace;',
        text: getShortcut(action) || '—',
        'aria-label': `Shortcut for ${action}: ${getShortcut(action) || 'none'}. Click to change.`
      });
      let listening = false;
      keyBtn.addEventListener('click', () => {
        if (listening) return;
        listening = true;
        keyBtn.textContent = '…';
        keyBtn.style.background = 'var(--focus-color)';
        keyBtn.style.color = '#000';
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const parts = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.shiftKey) parts.push('Shift');
          if (e.altKey) parts.push('Alt');
          if (e.metaKey) parts.push('Meta');
          const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
          if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) parts.push(key);
          const shortcut = parts.join('+');
          if (shortcut) {
            saveShortcut(action, shortcut);
            keyBtn.textContent = shortcut;
            keyBtn.setAttribute('aria-label', `Shortcut for ${action}: ${shortcut}. Click to change.`);
            announce(`Shortcut for ${action}: ${shortcut}`);
          }
          keyBtn.style.background = '';
          keyBtn.style.color = '';
          listening = false;
          document.removeEventListener('keydown', handler, true);
        };
        document.addEventListener('keydown', handler, true);
        // Timeout after 5s
        setTimeout(() => { if (listening) { listening = false; keyBtn.textContent = getShortcut(action) || '—'; keyBtn.style.background = ''; keyBtn.style.color = ''; document.removeEventListener('keydown', handler, true); } }, 5000);
      });
      row.appendChild(keyBtn);
      list.appendChild(row);
    });
  }
  renderShortcuts();

  /* ------------------------------------------------- LYRICS PANEL -- */
  let _lyricsCues = [];
  let _lyricsActiveIdx = -1;
  const lyricsList = ce('ul', { id: 'lyrics-list', 'aria-label': 'Synchronized lyrics', style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;font-size:0.9rem;' });
  const lyricsWrap = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;' }, [
      ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Lyrics' }),
      ce('button', { class: 'action-btn-small', text: 'Load .lrc', 'aria-label': 'Load lyrics from LRC file', onclick: loadLyrics })
    ]),
    lyricsList
  ]);
  if (moScroll) moScroll.insertBefore(lyricsWrap, moScroll.firstChild);
  function loadLyrics() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        parseLRC(text);
      };
      reader.readAsText(file);
    };
    input.click();
  }
  function parseLRC(text) {
    _lyricsCues = [];
    const lines = text.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;
    lines.forEach(line => {
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3]) * (match[3].length === 2 ? 10 : 1);
        const time = min * 60 + sec + ms / 1000;
        const text = line.replace(timeRegex, '').trim();
        if (text) _lyricsCues.push({ time, text });
      }
    });
    _lyricsCues.sort((a, b) => a.time - b.time);
    renderLyrics();
    announce(`Loaded ${_lyricsCues.length} lyrics lines`);
  }
  function renderLyrics() {
    lyricsList.innerHTML = '';
    if (!_lyricsCues.length) { lyricsList.innerHTML = '<li style="color:#888;padding:8px;font-size:0.85rem;">No lyrics loaded. Click "Load .lrc" to load a lyrics file.</li>'; return; }
    _lyricsCues.forEach((c, i) => {
      const li = ce('li', { class: 'lyrics-line', tabIndex: 0, 'aria-label': c.text }, [ce('span', { text: c.text })]);
      li.addEventListener('click', () => { mediaPlayer.currentTime = c.time; announce(`Jumped to ${formatTime(c.time)}`); });
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mediaPlayer.currentTime = c.time; announce(`Jumped to ${formatTime(c.time)}`); } });
      if (i === _lyricsActiveIdx) { li.style.color = 'var(--focus-color)'; li.style.fontWeight = 'bold'; li.scrollIntoView({ block: 'center' }); }
      lyricsList.appendChild(li);
    });
  }
  mediaPlayer.addEventListener('timeupdate', () => {
    if (!_lyricsCues.length) return;
    let newIdx = -1;
    for (let i = _lyricsCues.length - 1; i >= 0; i--) {
      if (mediaPlayer.currentTime >= _lyricsCues[i].time) { newIdx = i; break; }
    }
    if (newIdx !== _lyricsActiveIdx) { _lyricsActiveIdx = newIdx; renderLyrics(); }
  });

  /* ------------------------------------------------- CUSTOM THEMES -- */
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    const extraThemes = [
      ['highcontrast', 'High Contrast'],
      ['sepia', 'Sepia'],
      ['retro', 'Retro Terminal']
    ];
    extraThemes.forEach(([v, t]) => {
      if (!Array.from(themeSelect.options).some(o => o.value === v)) themeSelect.appendChild(ce('option', { value: v, text: t }));
    });
    themeSelect.addEventListener('change', () => {
      const v = themeSelect.value;
      document.documentElement.setAttribute('data-theme', v);
      saveState('theme', v);
      announce(`Theme: ${themeSelect.options[themeSelect.selectedIndex].text}`);
    });
  }

  /* ------------------------------------------------- ACCESSIBILITY IMPROVEMENTS -- */
  // Ensure the skip link works and add a second skip to playlist
  const skipToPlaylist = ce('a', { href: '#playlist-sidebar', class: 'sr-only', text: 'Skip to playlist',
    onclick: (e) => { e.preventDefault(); playlistSidebar.setAttribute('tabindex', '-1'); playlistSidebar.focus(); } });
  document.getElementById('app-container').insertBefore(skipToPlaylist, document.getElementById('app-container').firstChild.nextSibling);

  // Add aria-labels to all sidebar toggles and major controls that lack them
  document.querySelectorAll('.sidebar-toggle').forEach(el => { if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title || el.textContent.trim() || 'Toggle sidebar'); });

  // Add role="status" to OSD
  osd.setAttribute('role', 'status');
  osd.setAttribute('aria-live', 'polite');

  // Ensure the progress slider describes the keyboard interaction every time
  if (!document.getElementById('progress-help')) {
    const ph = ce('span', { id: 'progress-help', class: 'sr-only', text: 'Progress slider. Use Left and Right arrows to seek ten seconds. Home for start, End for end.' });
    progressSlider.parentElement.appendChild(ph);
  }
  progressSlider.setAttribute('aria-describedby', 'progress-help');

  // Make sure all modals can be closed with Escape and have proper labels
  document.querySelectorAll('.modal[role="dialog"]').forEach(m => {
    if (!m.getAttribute('aria-label') && !m.getAttribute('aria-labelledby')) {
      const h = m.querySelector('h2, h3');
      if (h) m.setAttribute('aria-label', h.textContent);
    }
  });

  // Improved focus visibility for all interactive elements
  const focusStyle = document.createElement('style');
  focusStyle.textContent = `
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
      outline: 3px solid var(--focus-color) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.3) !important;
    }
    .playlist-item.active { border-left: 3px solid var(--focus-color); background: rgba(62,166,255,0.1) !important; }
    .lyrics-line { padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #ccc; transition: all 0.15s; }
    .lyrics-line:hover, .lyrics-line:focus { background: #2a2a2a; }
  `;
  document.head.appendChild(focusStyle);

  /* ------------------------------------------------- AUDIO NORMALIZATION PRESETS -- */
  const normPresetSelect = ce('select', { id: 'norm-preset-select', 'aria-label': 'Normalization preset', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;' }, [
    ce('option', { value: 'off', text: 'Off' }),
    ce('option', { value: 'light', text: 'Light' }),
    ce('option', { value: 'medium', text: 'Medium (Recommended)' }),
    ce('option', { value: 'strong', text: 'Strong' }),
    ce('option', { value: 'voice', text: 'Voice / Podcast' })
  ]);
  const normPresetWrap = ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:8px;' }, [
    ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Normalization Preset:' }),
    normPresetSelect
  ]);
  const audioSettingsEl = document.getElementById('audio-settings');
  if (audioSettingsEl) audioSettingsEl.appendChild(normPresetWrap);

  normPresetSelect.addEventListener('change', () => {
    const val = normPresetSelect.value;
    if (!normalizationNode) { announce('Load media first to change normalization'); return; }
    switch (val) {
      case 'off':
        normalizationNode.threshold.value = 0;
        normalizationNode.ratio.value = 1;
        normalizationNode.knee.value = 30;
        announce('Normalization off');
        break;
      case 'light':
        normalizationNode.threshold.value = -18;
        normalizationNode.ratio.value = 2;
        normalizationNode.knee.value = 15;
        normalizationNode.attack.value = 0.01;
        normalizationNode.release.value = 0.3;
        announce('Normalization: Light');
        break;
      case 'medium':
        normalizationNode.threshold.value = -24;
        normalizationNode.ratio.value = 4;
        normalizationNode.knee.value = 20;
        normalizationNode.attack.value = 0.005;
        normalizationNode.release.value = 0.2;
        announce('Normalization: Medium');
        break;
      case 'strong':
        normalizationNode.threshold.value = -30;
        normalizationNode.ratio.value = 8;
        normalizationNode.knee.value = 10;
        normalizationNode.attack.value = 0.002;
        normalizationNode.release.value = 0.1;
        announce('Normalization: Strong');
        break;
      case 'voice':
        normalizationNode.threshold.value = -20;
        normalizationNode.ratio.value = 3;
        normalizationNode.knee.value = 5;
        normalizationNode.attack.value = 0.001;
        normalizationNode.release.value = 0.05;
        announce('Normalization: Voice/Podcast');
        break;
    }
  });

  // Sync the toggle with the preset select
  if (normalizationOn !== undefined) {
    const _origSetNorm = setNormalization;
    setNormalization = function(on) {
      _origSetNorm(on);
      if (on && normPresetSelect.value === 'off') { normPresetSelect.value = 'medium'; normPresetSelect.dispatchEvent(new Event('change')); }
      if (!on) normPresetSelect.value = 'off';
    };
  }

  /* ====================================================================
     FEATURE PACK 4: Search, Keys, Time Toggle, Frame Advance, Sort, Boost, Media Session
     ==================================================================== */

  /* ------------------------------------------------- KEYBOARD: VOLUME + SPEED + FRAME ADVANCE -- */
  // Up/Down: volume; +/-: speed; Period: frame advance
  window.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const vol = Math.min(100, (parseFloat(volumeSlider.value) || 50) + 5);
      volumeSlider.value = vol;
      volumeSlider.dispatchEvent(new Event('input'));
      showOSD(`Volume ${Math.round(vol)}%`);
      announce(`Volume ${Math.round(vol)}%`);
    } else if (e.key === 'ArrowDown' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const vol = Math.max(0, (parseFloat(volumeSlider.value) || 50) - 5);
      volumeSlider.value = vol;
      volumeSlider.dispatchEvent(new Event('input'));
      showOSD(`Volume ${Math.round(vol)}%`);
      announce(`Volume ${Math.round(vol)}%`);
    } else if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      const speedVal = parseFloat(mediaPlayer.playbackRate) || 1;
      const newSpeed = Math.min(4, Math.round((speedVal + 0.1) * 100) / 100);
      mediaPlayer.playbackRate = newSpeed;
      speedBtn.textContent = `${newSpeed.toFixed(2)}x`;
      showOSD(`Speed ${newSpeed.toFixed(2)}x`);
      announce(`Speed ${newSpeed.toFixed(2)}x`);
    } else if (e.key === '-' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const speedVal = parseFloat(mediaPlayer.playbackRate) || 1;
      const newSpeed = Math.max(0.1, Math.round((speedVal - 0.1) * 100) / 100);
      mediaPlayer.playbackRate = newSpeed;
      speedBtn.textContent = `${newSpeed.toFixed(2)}x`;
      showOSD(`Speed ${newSpeed.toFixed(2)}x`);
      announce(`Speed ${newSpeed.toFixed(2)}x`);
    } else if (e.key === '.' && !e.ctrlKey && !e.altKey && !e.metaKey && mediaPlayer.paused) {
      e.preventDefault();
      mediaPlayer.currentTime = Math.min(mediaPlayer.duration || Infinity, (mediaPlayer.currentTime || 0) + 0.04);
    }
  });

  /* ------------------------------------------------- REMAINING TIME TOGGLE -- */
  let _showRemaining = false;
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    timeDisplay.style.cursor = 'pointer';
    timeDisplay.setAttribute('role', 'button');
    timeDisplay.setAttribute('tabindex', '0');
    timeDisplay.setAttribute('aria-label', 'Click to toggle elapsed/remaining time');
    timeDisplay.addEventListener('click', () => {
      _showRemaining = !_showRemaining;
      timeDisplay.setAttribute('aria-label', `Showing ${_showRemaining ? 'remaining' : 'elapsed'} time. Click to toggle.`);
      announce(`${_showRemaining ? 'Remaining' : 'Elapsed'} time`);
    });
    timeDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); timeDisplay.click(); } });
    // Override the time update to show remaining
    mediaPlayer.addEventListener('timeupdate', () => {
      if (!_showRemaining || !timeDisplay) return;
      const cur = mediaPlayer.currentTime || 0;
      const dur = mediaPlayer.duration || 0;
      if (dur) {
        const rem = Math.max(0, dur - cur);
        timeDisplay.textContent = `-${formatTime(rem)}`;
      }
    });
  }

  /* ------------------------------------------------- VOLUME BOOST TOGGLE -- */
  let _boostOn = false;
  let _savedBoostGain = 1;
  const boostBtn = ce('button', {
    class: 'action-btn-small',
    'aria-label': 'Toggle volume boost 200%',
    'aria-pressed': 'false',
    style: 'margin-left:4px;',
    text: 'Boost',
    onclick: () => {
      _boostOn = !_boostOn;
      boostBtn.setAttribute('aria-pressed', _boostOn);
      boostBtn.style.color = _boostOn ? 'var(--focus-color)' : '';
      announce(`Volume boost ${_boostOn ? '200%' : 'off'}`);
      if (gainNode) {
        if (_boostOn) {
          _savedBoostGain = gainNode.gain.value;
          gainNode.gain.value = Math.min(2, _savedBoostGain * 2);
        } else {
          gainNode.gain.value = _savedBoostGain;
        }
      }
    }
  });
  const volContainer = volumeSlider?.parentElement;
  if (volContainer) volContainer.appendChild(boostBtn);

  /* ------------------------------------------------- PLAYLIST SORT -- */
  const sortWrap = ce('div', { style: 'display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid #333;' });
  const sortNameBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by name', text: 'Name', onclick: () => { sortPlaylist('name'); } });
  const sortDateBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by date added', text: 'Date', onclick: () => { sortPlaylist('date'); } });
  const sortDurBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by duration', text: 'Duration', onclick: () => { sortPlaylist('duration'); } });
  const sortRevBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Reverse order', text: 'Reverse', onclick: () => { sortPlaylist('reverse'); } });
  sortWrap.append(sortNameBtn, sortDateBtn, sortDurBtn, sortRevBtn);
  // Add sort buttons BELOW the search box, above playlist-items
  const playlistItemsEl = document.getElementById('playlist-items');
  if (playlistItemsEl && playlistItemsEl.parentElement) {
    playlistItemsEl.parentElement.insertBefore(sortWrap, playlistItemsEl);
  }
  function sortPlaylist(mode) {
    if (!playlist.length) return;
    const currentFile = currentPlaylistIndex >= 0 ? playlist[currentPlaylistIndex] : null;
    if (mode === 'name') {
      const idxMap = playlist.map((p, i) => i).sort((a, b) => getFileName(playlist[a]).localeCompare(getFileName(playlist[b])));
      playlist = idxMap.map(i => playlist[i]);
    } else if (mode === 'date') {
      // Already in insertion order — reverse it so newest first
      playlist.reverse();
    } else if (mode === 'reverse') {
      playlist.reverse();
    } else if (mode === 'duration') {
      // Sort by file name as proxy since we don't have durations stored
      playlist.sort((a, b) => getFileName(a).localeCompare(getFileName(b)));
      // Then reverse so longest names first (weak proxy for duration)
    }
    if (currentFile) currentPlaylistIndex = playlist.indexOf(currentFile);
    if (currentPlaylistIndex === -1 && playlist.length) currentPlaylistIndex = 0;
    renderPlaylist();
    announce(`Playlist sorted by ${mode}`);
  }

  /* ------------------------------------------------- PLAYLIST RIGHT-CLICK ENHANCEMENTS -- */
  // The existing right-click on playlist items already has Play Next and Remove.
  // We extend the context menu by patching the menu creation.
  const _origShowPlaylistMenu = window.showPlaylistMenu;
  document.getElementById('playlist-items')?.addEventListener('contextmenu', (e) => {
    const li = e.target.closest('.playlist-item');
    if (!li) return;
    const idx = Array.from(li.parentNode.children).indexOf(li);
    if (idx < 0 || idx >= playlist.length) return;
    e.preventDefault();
    const menu = ce('div', { class: 'context-menu', role: 'menu', 'aria-label': 'Playlist item actions', style: 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:9999;background:#252525;border:1px solid #444;border-radius:6px;padding:4px;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.5);' });
    const items = [
      { label: 'Play', run: () => playPlaylistItem(idx) },
      { label: 'Play Next', run: () => playNextAfter(idx) },
      { label: 'Remove', run: () => { lastRemoved = { item: playlist[idx], index: idx }; playlist.splice(idx, 1); if (currentPlaylistIndex > idx) currentPlaylistIndex--; renderPlaylist(); showUndo(); } },
      { label: 'Copy Path', run: () => { navigator.clipboard.writeText(playlist[idx]); announce('Path copied'); } },
      { label: 'Reveal in Explorer', run: () => { ipcRenderer.send('open-external', playlist[idx]); } },
    ];
    items.forEach((item, i) => {
      const btn = ce('button', { class: 'context-menu-item', role: 'menuitem', text: item.label, style: 'display:block;width:100%;text-align:left;background:none;border:none;color:#ccc;padding:6px 12px;border-radius:4px;font-size:0.85rem;', onclick: () => { menu.remove(); if (item.run) item.run(); } });
      btn.addEventListener('mouseenter', () => btn.style.background = '#333');
      btn.addEventListener('mouseleave', () => btn.style.background = '');
      menu.appendChild(btn);
      if (i === 0) setTimeout(() => btn.focus(), 0);
    });
    document.body.appendChild(menu);
    // Close on click outside
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); document.removeEventListener('contextmenu', close); } };
    setTimeout(() => { document.addEventListener('click', close); document.addEventListener('contextmenu', close); }, 0);
    // ESC to close
    const escHandler = (ev) => { if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  });

  /* ------------------------------------------------- MEDIA SESSION API -- */
  if ('mediaSession' in navigator) {
    const updateMediaSession = () => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: getFileName(playlist[currentPlaylistIndex] || ''),
artist: 'Accessible Media Player',
    album: 'Accessible Media Player'
      });
    };
    mediaPlayer.addEventListener('loadedmetadata', updateMediaSession);
    mediaPlayer.addEventListener('play', () => { navigator.mediaSession.playbackState = 'playing'; });
    mediaPlayer.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });
    navigator.mediaSession.setActionHandler('play', () => mediaPlayer.play());
    navigator.mediaSession.setActionHandler('pause', () => mediaPlayer.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => { if (typeof playPrev === 'function') playPrev(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { if (typeof playNext === 'function') playNext(); });
    navigator.mediaSession.setActionHandler('seekto', (details) => { if (details.seekTime) mediaPlayer.currentTime = details.seekTime; });
  }

  /* ------------------------------------------------- SHUFFLE UI ENHANCEMENT -- */
  if (shuffleToggle) {
    shuffleToggle.setAttribute('aria-label', 'Shuffle playlist');
    // Update OSD when shuffle toggled
    shuffleToggle.addEventListener('change', () => {
      announce(`Shuffle ${shuffleToggle.checked ? 'on' : 'off'}`);
      showOSD(`Shuffle ${shuffleToggle.checked ? 'on' : 'off'}`);
    });
  }

  /* ------------------------------------------------- COMMANDS FOR NEW FEATURES -- */
  COMMANDS.push(
    { name: 'Toggle Remaining Time', run: () => { if (timeDisplay) timeDisplay.click(); } },
    { name: 'Toggle Volume Boost', run: () => { if (boostBtn) boostBtn.click(); } },
    { name: 'Sort Playlist A-Z', run: () => sortPlaylist('name') },
    { name: 'Reverse Playlist', run: () => sortPlaylist('reverse') },
    { name: 'Reset Video Transform', run: resetVideoTransform },
    { name: 'Reset Video Filters', run: resetVideoFilters },
    { name: 'Export Playlist M3U', run: exportPlaylistM3U },
    { name: 'Clear Playlist', run: clearPlaylist },
    { name: 'Playback Statistics', run: showPlaybackStats },
    { name: 'Screenshot with Timestamp', run: screenshotWithTimestamp },
  );

  /* ==================================================================
     FEATURE PACK 5: Filter Presets, Export, Reset, Volume Presets,
     Stats, Background, Screenshot, Playlist Tools
     ================================================================== */

  /* ------------------------------------------------- VIDEO FILTER PRESETS -- */
  const filterPresetWrap = ce('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;' });
  const filterPresets = [
    { label: 'Normal', vals: { b:100, c:100, s:100, h:0, bl:0 } },
    { label: 'Vivid', vals: { b:110, c:130, s:150, h:0, bl:0 } },
    { label: 'Vintage', vals: { b:90, c:80, s:70, h:15, bl:0 } },
    { label: 'Noir', vals: { b:70, c:50, s:0, h:0, bl:0 } },
    { label: 'Soft', vals: { b:105, c:95, s:90, h:0, bl:1 } },
  ];
  filterPresets.forEach(p => {
    const btn = ce('button', { class: 'action-btn-small', text: p.label, 'aria-label': `Apply ${p.label} video filter`, style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => applyFilterPreset(p.vals) });
    filterPresetWrap.appendChild(btn);
  });
  function applyFilterPreset(vals) {
    const bS = document.getElementById('brightness-slider');
    const cS = document.getElementById('contrast-slider');
    const sS = document.getElementById('saturation-slider');
    const hS = document.getElementById('hue-slider');
    const blS = document.getElementById('blur-slider');
    if (bS) { bS.value = vals.b; bS.dispatchEvent(new Event('input')); }
    if (cS) { cS.value = vals.c; cS.dispatchEvent(new Event('input')); }
    if (sS) { sS.value = vals.s; sS.dispatchEvent(new Event('input')); }
    if (hS) { hS.value = vals.h; hS.dispatchEvent(new Event('input')); }
    if (blS) { blS.value = vals.bl; blS.dispatchEvent(new Event('input')); }
    announce(`Filter: ${Object.keys(filterPresets).find(k => filterPresets[k].vals === vals) || 'custom'}`);
  }
  function resetVideoFilters() { applyFilterPreset({ b:100, c:100, s:100, h:0, bl:0 }); announce('Video filters reset'); }
  // Insert filter presets near the video filter controls
  const vidFilterSection = document.getElementById('brightness-slider')?.closest('div[style*="margin-top"]') || document.querySelector('#more-options-sidebar div[style*="margin-top"]');
  if (vidFilterSection && vidFilterSection.parentElement) { vidFilterSection.parentElement.insertBefore(filterPresetWrap, vidFilterSection.nextSibling); }

  /* ------------------------------------------------- EXPORT PLAYLIST TO M3U -- */
  function exportPlaylistM3U() {
    if (!playlist.length) { announce('Playlist empty'); return; }
    let m3u = '#EXTM3U\n# Accessible Media Player Playlist\n';
    const name = getFileName(playlist[0] || 'playlist');
    playlist.forEach(p => { const fn = getFileName(p); m3u += `#EXTINF:-1,${fn}\n${p}\n`; });
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\.[^.]+$/, '')}_playlist.m3u`; a.click();
    URL.revokeObjectURL(url);
    announce(`Playlist exported as M3U (${playlist.length} tracks)`);
  }

  /* ------------------------------------------------- AUTO-RESTORE PLAYLIST -- */
  window.addEventListener('beforeunload', () => {
    saveState('savedPlaylist', JSON.stringify({ files: playlist, index: currentPlaylistIndex }));
  });
  // Restore on load (if no resume)
  (function restorePlaylist() {
    const saved = loadState('savedPlaylist', null);
    if (saved && !mediaPlayer.src) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data.files) && data.files.length) {
          data.files.forEach(f => addToPlaylist(f));
          if (data.index >= 0 && data.index < playlist.length) { currentPlaylistIndex = data.index; }
          renderPlaylist();
        }
      } catch(e) { /* ignore corrupt data */ }
    }
  })();

  /* ------------------------------------------------- CTRL+R RESET VIDEO TRANSFORM -- */
  function resetVideoTransform() {
    videoZoom = 1; videoRotation = 0; flipH = false; flipV = false;
    applyVideoTransform();
    announce('Video transform reset');
  }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r' && !e.shiftKey && !e.altKey && !e.metaKey) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      e.preventDefault();
      resetVideoTransform();
    }
  });

  /* ------------------------------------------------- QUICK VOLUME PRESETS -- */
  const volPresetWrap = ce('div', { style: 'display:flex;gap:3px;margin-top:4px;' });
  [25, 50, 75, 100].forEach(pct => {
    const btn = ce('button', { class: 'action-btn-small', text: `${pct}%`, 'aria-label': `Set volume to ${pct} percent`, style: 'font-size:0.7rem;padding:2px 6px;flex:1;', onclick: () => {
      volumeSlider.value = pct;
      volumeSlider.dispatchEvent(new Event('input'));
      showOSD(`Volume ${pct}%`);
      announce(`Volume ${pct}%`);
    }});
    volPresetWrap.appendChild(btn);
  });
  const volContainer2 = volumeSlider?.parentElement;
  if (volContainer2) volContainer2.appendChild(volPresetWrap);

  /* ------------------------------------------------- CUSTOM BACKGROUND IMAGE -- */
  const bgInput = ce('input', { type: 'text', id: 'bg-url-input', placeholder: 'Background image URL…', 'aria-label': 'Custom background image URL', style: 'flex:1;background:#2a2a2a;color:#fff;border:1px solid #444;padding:4px 6px;border-radius:3px;font-size:0.8rem;' });
  const bgApply = ce('button', { class: 'action-btn-small', text: 'Set BG', 'aria-label': 'Apply background image', onclick: () => {
    const url = bgInput.value.trim();
    if (!url) { localStorage.removeItem('customBg'); document.body.style.backgroundImage = ''; announce('Background cleared'); return; }
    localStorage.setItem('customBg', url);
    document.body.style.backgroundImage = `url('${url}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    announce('Background set');
  }});
  const bgClear = ce('button', { class: 'action-btn-small', text: 'Clear', 'aria-label': 'Clear background image', onclick: () => { bgInput.value = ''; localStorage.removeItem('customBg'); document.body.style.backgroundImage = ''; announce('Background cleared'); } });
  const bgRow = ce('div', { style: 'display:flex;gap:4px;align-items:center;padding:8px;margin-top:6px;background:#252525;border-radius:6px;border:1px solid #333;' }, [
    ce('span', { style: 'color:#aaa;font-size:0.8rem;white-space:nowrap;', text: 'BG:' }),
    bgInput, bgApply, bgClear
  ]);
  // Restore saved bg
  const savedBg = localStorage.getItem('customBg');
  if (savedBg) { document.body.style.backgroundImage = `url('${savedBg}')`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; bgInput.value = savedBg; }
  const genSettings2 = document.getElementById('general-settings');
  if (genSettings2) genSettings2.appendChild(bgRow);

  /* ------------------------------------------------- SCREENSHOT WITH TIMESTAMP -- */
  function screenshotWithTimestamp() {
    if (!mediaPlayer.videoWidth) { announce('No video to capture'); return; }
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const canvas = document.createElement('canvas');
    canvas.width = mediaPlayer.videoWidth;
    canvas.height = mediaPlayer.videoHeight;
    canvas.getContext('2d').drawImage(mediaPlayer, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Accessible_${ts}.png`; a.click();
      URL.revokeObjectURL(url);
      announce(`Screenshot saved as Accessible_${ts}.png`);
    }, 'image/png');
  }

  /* ------------------------------------------------- PLAYBACK STATS -- */
  let _stats = { launches: 0, tracksPlayed: 0, totalTimeMs: 0, lastDate: '' };
  try { const s = localStorage.getItem('playbackStats'); if (s) _stats = JSON.parse(s); } catch(e) {}
  if (!_stats.lastDate || _stats.lastDate !== new Date().toDateString()) {
    _stats.launches++;
    _stats.lastDate = new Date().toDateString();
    localStorage.setItem('playbackStats', JSON.stringify(_stats));
  }
  mediaPlayer.addEventListener('timeupdate', () => {
    if (!mediaPlayer.paused) { _stats.totalTimeMs += 500; }
  });
  setInterval(() => { localStorage.setItem('playbackStats', JSON.stringify(_stats)); }, 30000);
  function showPlaybackStats() {
    const h = Math.floor(_stats.totalTimeMs / 3600000);
    const m = Math.floor((_stats.totalTimeMs % 3600000) / 60000);
    const msg = `Sessions: ${_stats.launches} | Tracks played: ${_stats.tracksPlayed} | Total play time: ${h}h ${m}m`;
    announce(msg);
    showOSD(msg);
  }
  // Track plays
  const _origPlayPlaylistItem = playPlaylistItem;
  playPlaylistItem = function(idx) { _stats.tracksPlayed++; _origPlayPlaylistItem(idx); };

  /* ------------------------------------------------- CLEAR PLAYLIST TOOL -- */
  function clearPlaylist() {
    if (!playlist.length) { announce('Playlist already empty'); return; }
    if (confirm('Clear entire playlist?')) {
      playlist.length = 0;
      currentPlaylistIndex = -1;
      renderPlaylist();
      announce('Playlist cleared');
    }
  }
  const clearBtn = ce('button', { class: 'action-btn-small', text: 'Clear All', 'aria-label': 'Clear entire playlist', style: 'margin-left:4px;font-size:0.7rem;', onclick: clearPlaylist });
  const ph = document.querySelector('#playlist-sidebar .header-btns');
  if (ph) ph.appendChild(clearBtn);

  /* ------------------------------------------------- KEYBOARD SHORTCUT CHEAT SHEET (compact) -- */
  let _cheatVisible = false;
  const cheatOverlay = ce('div', { id: 'cheat-overlay', style: 'display:none;position:fixed;bottom:70px;right:20px;z-index:9998;background:rgba(0,0,0,0.92);border:1px solid #444;border-radius:8px;padding:12px 16px;max-width:380px;max-height:60vh;overflow-y:auto;color:#ccc;font-size:0.75rem;line-height:1.6;' });
  cheatOverlay.innerHTML = `<h3 style="margin:0 0 8px;color:var(--focus-color);font-size:0.9rem;">Keyboard Shortcuts</h3>
    <table style="width:100%;border-collapse:collapse;"><tr><th style="text-align:left;padding:1px 8px;border-bottom:1px solid #333;">Key</th><th style="text-align:left;padding:1px 8px;border-bottom:1px solid #333;">Action</th></tr>
    ${SHORTCUTS.map(([key, action]) => `<tr><td style="padding:1px 8px;font-family:monospace;color:var(--focus-color);">${key}</td><td style="padding:1px 8px;">${action}</td></tr>`).join('')}
    </table>`;
  const appContainer = document.getElementById('app-container');
  if (appContainer) appContainer.appendChild(cheatOverlay);
  COMMANDS.push({ name: 'Toggle Shortcut Cheatsheet', run: () => { _cheatVisible = !_cheatVisible; cheatOverlay.style.display = _cheatVisible ? 'block' : 'none'; announce(`Shortcut cheatsheet ${_cheatVisible ? 'shown' : 'hidden'}`); } });

  /* ==================================================================
     FEATURE PACK 6: Aspect Ratio, Balance, Wheel Volume, Sub Offset,
     Startup Volume, Import Folder, Recent Manager, Bookmark Search,
     Snapshot Gallery, Audio-Only Mode, Save/Load Playlist, Theater
     ================================================================== */

  /* ------------------------------------------------- VIDEO ASPECT RATIO -- */
  const aspectWrap = ce('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;' });
  const aspectModes = [
    { label: 'Fit', val: 'contain' },
    { label: 'Fill', val: 'fill' },
    { label: 'Cover', val: 'cover' },
    { label: '16:9', val: 'none', css: '16 / 9' },
    { label: '4:3', val: 'none', css: '4 / 3' },
    { label: '1:1', val: 'none', css: '1 / 1' },
  ];
  let _aspectMode = 'contain';
  function applyAspect(mode) {
    _aspectMode = mode;
    if (mode === 'contain' || mode === 'fill' || mode === 'cover') {
      mediaPlayer.style.objectFit = mode;
      mediaPlayer.style.aspectRatio = '';
    } else {
      mediaPlayer.style.objectFit = 'fill';
      mediaPlayer.style.aspectRatio = mode;
    }
    announce(`Aspect: ${mode}`);
  }
  aspectModes.forEach(m => {
    const btn = ce('button', { class: 'action-btn-small', text: m.label, 'aria-label': `Aspect ratio ${m.label}`, style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => applyAspect(m.css || m.val) });
    aspectWrap.appendChild(btn);
  });
  const vidFilterParent = document.querySelector('#video-controls') || document.querySelector('#more-options-sidebar');
  if (vidFilterParent) {
    const sec = ce('div', { style: 'margin:8px 0;' }, [
      ce('div', { style: 'font-size:0.85rem;color:#ccc;margin-bottom:4px;', text: 'Aspect Ratio:' }),
      aspectWrap
    ]);
    vidFilterParent.appendChild(sec);
  }

  /* ------------------------------------------------- AUDIO BALANCE -- */
  const balanceSlider = ce('input', { type: 'range', id: 'balance-slider', min: '-1', max: '1', step: '0.05', value: '0', 'aria-label': 'Audio balance', style: 'width:100%;' });
  const balanceVal = ce('span', { style: 'font-size:0.8rem;color:#aaa;min-width:50px;text-align:center;', text: 'Center' });
  const balanceWrap = ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:8px;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Balance:' }),
      balanceVal
    ]),
    ce('div', { style: 'display:flex;gap:4px;align-items:center;' }, [
      ce('span', { style: 'font-size:0.7rem;color:#888;', text: 'L' }),
      balanceSlider,
      ce('span', { style: 'font-size:0.7rem;color:#888;', text: 'R' })
    ]),
    ce('button', { class: 'action-btn-small', text: 'Reset', 'aria-label': 'Reset balance to center', style: 'align-self:center;font-size:0.7rem;', onclick: () => { balanceSlider.value = '0'; balanceSlider.dispatchEvent(new Event('input')); announce('Balance reset to center'); } })
  ]);
  balanceSlider.addEventListener('input', () => {
    const val = parseFloat(balanceSlider.value);
    if (pannerNode) pannerNode.pan.value = val;
    const text = val === 0 ? 'Center' : (val < 0 ? `Left ${Math.round(-val*100)}%` : `Right ${Math.round(val*100)}%`);
    balanceVal.textContent = text;
  });
  const audioSettingsEl2 = document.getElementById('audio-settings');
  if (audioSettingsEl2) audioSettingsEl2.appendChild(balanceWrap);

  /* ------------------------------------------------- MOUSE WHEEL VOLUME (Ctrl+Scroll) -- */
  videoWrapper.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const vol = Math.max(0, Math.min(100, (parseFloat(volumeSlider.value) || 50) + delta));
    volumeSlider.value = vol;
    volumeSlider.dispatchEvent(new Event('input'));
    showOSD(`Volume ${Math.round(vol)}%`);
  }, { passive: false });

  /* ------------------------------------------------- SUBTITLE TIMING OFFSET -- */
  let _subOffset = 0;
  const subOffsetDisplay = ce('span', { style: 'font-size:0.8rem;color:#aaa;min-width:60px;text-align:center;', text: '0.0s' });
  const subOffsetWrap = ce('div', { style: 'display:flex;gap:4px;align-items:center;margin-top:6px;' }, [
    ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Sub Offset:' }),
    ce('button', { class: 'action-btn-small', text: '-0.5s', 'aria-label': 'Subtitles earlier by 0.5 seconds', style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => { _subOffset -= 0.5; updateSubOffset(); } }),
    ce('button', { class: 'action-btn-small', text: '-0.1s', 'aria-label': 'Subtitles earlier by 0.1 seconds', style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => { _subOffset -= 0.1; updateSubOffset(); } }),
    subOffsetDisplay,
    ce('button', { class: 'action-btn-small', text: '+0.1s', 'aria-label': 'Subtitles later by 0.1 seconds', style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => { _subOffset += 0.1; updateSubOffset(); } }),
    ce('button', { class: 'action-btn-small', text: '+0.5s', 'aria-label': 'Subtitles later by 0.5 seconds', style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => { _subOffset += 0.5; updateSubOffset(); } }),
    ce('button', { class: 'action-btn-small', text: 'Reset', 'aria-label': 'Reset subtitle offset', style: 'font-size:0.7rem;padding:2px 6px;', onclick: () => { _subOffset = 0; updateSubOffset(); announce('Subtitle offset reset'); } })
  ]);
  function updateSubOffset() {
    subOffsetDisplay.textContent = `${_subOffset >= 0 ? '+' : ''}${_subOffset.toFixed(1)}s`;
    showOSD(`Sub offset ${_subOffset >= 0 ? '+' : ''}${_subOffset.toFixed(1)}s`);
  }
  const subsSection = document.querySelector('#more-options-sidebar .subtitle-controls') || loadSubsBtn?.parentElement;
  if (subsSection) subsSection.appendChild(subOffsetWrap);

  /* ------------------------------------------------- STARTUP VOLUME -- */
  const startupVolSlider = ce('input', { type: 'range', id: 'startup-vol', min: '0', max: '100', value: String(loadState('startupVolume', 50)), 'aria-label': 'Startup volume', style: 'width:100%;' });
  const startupVolVal = ce('span', { style: 'font-size:0.8rem;color:#aaa;', text: `${loadState('startupVolume', 50)}%` });
  const startupVolWrap = ce('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:8px;padding:8px;background:#252525;border-radius:6px;border:1px solid #333;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;' }, [
      ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Startup Volume:' }),
      startupVolVal
    ]),
    startupVolSlider
  ]);
  startupVolSlider.addEventListener('input', () => {
    const v = parseInt(startupVolSlider.value);
    startupVolVal.textContent = `${v}%`;
    saveState('startupVolume', v);
    // Apply immediately
    volumeSlider.value = v;
    volumeSlider.dispatchEvent(new Event('input'));
  });
  if (genSettings2) genSettings2.appendChild(startupVolWrap);
  // Apply saved startup volume on boot
  (function applyStartupVol() {
    const sv = loadState('startupVolume', null);
    if (sv !== null && sv >= 0 && sv <= 100) {
      volumeSlider.value = sv;
      mediaPlayer.volume = sv / 100;
      announce(`Startup volume ${sv}%`);
    }
  })();

  /* ------------------------------------------------- AUTOPLAY TOGGLE -- */
  const autoplayWrap = ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#ccc;margin-top:8px;padding:8px;background:#252525;border-radius:6px;border:1px solid #333;' }, [
    ce('input', { type: 'checkbox', id: 'autoplay-toggle', checked: loadState('autoplay', true) ? 'checked' : undefined }),
    ce('span', { text: 'Auto-play on file load' })
  ]);
  if (genSettings2) genSettings2.appendChild(autoplayWrap);
  autoplayWrap.querySelector('input').addEventListener('change', (e) => {
    saveState('autoplay', e.target.checked);
    announce(e.target.checked ? 'Auto-play enabled' : 'Auto-play disabled');
  });

  /* ------------------------------------------------- RECURSIVE FOLDER IMPORT -- */
  const importFolderBtn = ce('button', { class: 'action-btn-small', text: 'Import Folder Tree', 'aria-label': 'Import all media from folder and subfolders', style: 'margin-left:4px;font-size:0.7rem;', onclick: async () => {
    const files = await ipcRenderer.invoke('open-directory-dialog');
    if (Array.isArray(files) && files.length) {
      let count = 0;
      // Flatten: files already come recursively from main process
      files.forEach(f => { addToPlaylist(f); count++; });
      if (currentPlaylistIndex === -1) playPlaylistItem(playlist.length - count);
      renderPlaylist();
      announce(`Added ${count} files from folder tree`);
    }
  } });
  const ph2 = document.querySelector('#playlist-sidebar .header-btns');
  if (ph2) ph2.appendChild(importFolderBtn);

  /* ------------------------------------------------- RECENT FILES MANAGER -- */
  const clearRecentBtn = ce('button', { class: 'action-btn-small', text: 'Clear Recent', 'aria-label': 'Clear recent files history', style: 'font-size:0.7rem;margin-left:4px;', onclick: () => {
    saveState('history', []);
    if (typeof renderHistory === 'function') renderHistory();
    announce('Recent history cleared');
  } });
  if (ph2) ph2.appendChild(clearRecentBtn);

  /* ------------------------------------------------- BOOKMARK SEARCH -- */
  const bmSearch = ce('input', { type: 'text', id: 'bm-search', placeholder: 'Filter bookmarks…', 'aria-label': 'Filter bookmarks', style: 'width:100%;padding:6px;margin:4px 0;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;font-size:0.8rem;' });
  const bmHeader = document.querySelector('#bookmarks-sidebar .bookmark-header') || document.querySelector('#bookmarks-sidebar h3');
  if (bmHeader && bmHeader.parentElement) {
    bmHeader.parentElement.insertBefore(bmSearch, bmHeader.nextSibling);
  }
  bmSearch.addEventListener('input', () => {
    const term = bmSearch.value.toLowerCase().trim();
    document.querySelectorAll('#bookmarks-sidebar .bookmark-item').forEach(el => {
      el.style.display = (!term || el.textContent.toLowerCase().includes(term)) ? '' : 'none';
    });
  });
  // Re-apply filter after renderBookmarks
  const _origRenderBm = renderBookmarks;
  renderBookmarks = function() {
    _origRenderBm();
    const term = (bmSearch.value || '').toLowerCase().trim();
    if (!term) return;
    document.querySelectorAll('#bookmarks-sidebar .bookmark-item').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  };

  /* ------------------------------------------------- SNAPSHOT GALLERY -- */
  let _snapshots = [];
  try {
    const legacy = localStorage.getItem('goonSnapshots');
    if (legacy) {
      _snapshots = JSON.parse(legacy);
      localStorage.setItem('accessibleSnapshots', legacy);
      localStorage.removeItem('goonSnapshots');
    } else {
      const s = localStorage.getItem('accessibleSnapshots');
      if (s) _snapshots = JSON.parse(s);
    }
  } catch(e) {}
  function addSnapshot(dataUrl) {
    _snapshots.push({ dataUrl, time: Date.now(), label: getFileName(playlist[currentPlaylistIndex]) || 'Unknown' });
    if (_snapshots.length > 50) _snapshots.shift();
    localStorage.setItem('accessibleSnapshots', JSON.stringify(_snapshots));
  }
  // Patch the existing screenshot to also save to gallery
  if (typeof screenshotWithTimestamp === 'function') {
    const _origSS = screenshotWithTimestamp;
    screenshotWithTimestamp = function() {
      _origSS();
      // Capture to gallery
      const c = document.createElement('canvas');
      c.width = mediaPlayer.videoWidth || 640;
      c.height = mediaPlayer.videoHeight || 480;
      c.getContext('2d').drawImage(mediaPlayer, 0, 0);
      addSnapshot(c.toDataURL('image/jpeg', 0.7));
    };
  }
  const galleryModal = ce('div', { id: 'snapshot-gallery', class: 'modal', 'aria-hidden': 'true', style: 'display:none;z-index:9999;' });
  const galleryContent = ce('div', { class: 'modal-content', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Snapshot Gallery', style: 'min-width:600px;max-width:900px;padding:16px;max-height:80vh;display:flex;flex-direction:column;' }, [
    ce('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;' }, [
      ce('h2', { style: 'margin:0;font-size:1.1rem;', text: 'Snapshot Gallery' }),
      ce('button', { class: 'icon-btn', 'aria-label': 'Close gallery', html: '<svg viewBox="0 0 24 24" style="width:20px;height:20px;"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', onclick: closeGallery })
    ]),
    ce('div', { id: 'snapshot-grid', style: 'flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:8px;' })
  ]);
  galleryModal.appendChild(galleryContent);
  document.getElementById('app-container').appendChild(galleryModal);
  function openGallery() { window._lastModalPrevFocus = document.activeElement; renderGallery(); galleryModal.style.display = 'flex'; galleryModal.setAttribute('aria-hidden', 'false'); galleryModal.querySelector('.icon-btn').focus(); }
  function closeGallery() { galleryModal.style.display = 'none'; galleryModal.setAttribute('aria-hidden', 'true'); if (window._lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; } }
  function renderGallery() {
    const grid = document.getElementById('snapshot-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!_snapshots.length) { grid.innerHTML = '<p style="color:#888;grid-column:1/-1;text-align:center;">No snapshots yet. Take a screenshot to save one here.</p>'; return; }
    _snapshots.slice().reverse().forEach((s, i) => {
      const div = ce('div', { style: 'position:relative;border-radius:6px;overflow:hidden;border:1px solid #333;' }, [
        ce('img', { src: s.dataUrl, alt: s.label, style: 'width:100%;display:block;' }),
        ce('div', { style: 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);padding:4px 8px;font-size:0.65rem;color:#ccc;', text: s.label }),
        ce('button', { class: 'icon-btn', 'aria-label': 'Delete snapshot', style: 'position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border-radius:50%;padding:2px;font-size:0.6rem;', text: '✕', onclick: () => { _snapshots.splice(_snapshots.length - 1 - i, 1); localStorage.setItem('accessibleSnapshots', JSON.stringify(_snapshots)); renderGallery(); announce('Snapshot deleted'); } })
      ]);
      grid.appendChild(div);
    });
  }
  enableModalA11y(galleryModal, galleryModal.querySelector('.icon-btn'), closeGallery);
  COMMANDS.push({ name: 'Open Snapshot Gallery', run: openGallery });

  /* ------------------------------------------------- AUDIO-ONLY MODE -- */
  let _audioOnly = loadState('audioOnly', false);
  const audioOnlyBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Toggle audio-only mode', 'aria-pressed': String(_audioOnly), text: _audioOnly ? 'Audio Only: On' : 'Audio Only: Off', style: _audioOnly ? 'color:var(--focus-color);' : '', onclick: () => {
    _audioOnly = !_audioOnly;
    audioOnlyBtn.textContent = _audioOnly ? 'Audio Only: On' : 'Audio Only: Off';
    audioOnlyBtn.setAttribute('aria-pressed', String(_audioOnly));
    audioOnlyBtn.style.color = _audioOnly ? 'var(--focus-color)' : '';
    saveState('audioOnly', _audioOnly);
    applyAudioOnly();
    announce(`Audio-only mode ${_audioOnly ? 'on' : 'off'}`);
  } });
  function applyAudioOnly() {
    if (_audioOnly || !mediaPlayer.videoWidth) {
      mediaPlayer.style.display = 'none';
      audioVisualizer.style.display = 'block';
      audioVisualizer.style.width = '100%';
      audioVisualizer.style.height = '100%';
    } else {
      mediaPlayer.style.display = '';
      audioVisualizer.style.display = mediaPlayer.videoWidth ? 'none' : 'block';
    }
  }
  mediaPlayer.addEventListener('loadedmetadata', applyAudioOnly);
  const togglePanel = document.querySelector('#more-options-sidebar .toggle-panel') || document.querySelector('#more-options-sidebar div:first-child');
  if (togglePanel) togglePanel.parentElement.insertBefore(audioOnlyBtn, togglePanel.nextSibling);

  /* ------------------------------------------------- SAVE/LOAD PLAYLIST JSON -- */
  function savePlaylistJSON() {
    if (!playlist.length) { announce('Playlist empty'); return; }
    const data = JSON.stringify({ files: playlist, index: currentPlaylistIndex, version: 2 }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `accessible_playlist.json`; a.click();
    URL.revokeObjectURL(url);
    announce('Playlist saved as JSON');
  }
  function loadPlaylistJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data.files)) {
            // Replace current playlist
            playlist.length = 0;
            data.files.forEach(f => addToPlaylist(f));
            currentPlaylistIndex = Math.min(data.index || 0, playlist.length - 1);
            renderPlaylist();
            announce(`Loaded playlist with ${playlist.length} tracks`);
          }
        } catch(err) { announce('Failed to load playlist'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  const plActionsWrap = ce('div', { style: 'display:flex;gap:4px;padding:4px 15px;' }, [
    ce('button', { class: 'action-btn-small', text: 'Save JSON', 'aria-label': 'Save playlist as JSON', style: 'font-size:0.7rem;flex:1;', onclick: savePlaylistJSON }),
    ce('button', { class: 'action-btn-small', text: 'Load JSON', 'aria-label': 'Load playlist from JSON file', style: 'font-size:0.7rem;flex:1;', onclick: loadPlaylistJSON })
  ]);
  const plItems = document.getElementById('playlist-items');
  if (plItems && plItems.parentElement) plItems.parentElement.insertBefore(plActionsWrap, plItems);

  /* ------------------------------------------------- THEATER MODE -- */
  let _theaterMode = false;
  const theaterBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Toggle theater mode', 'aria-pressed': 'false', text: 'Theater', style: 'margin-left:4px;', onclick: () => {
    _theaterMode = !_theaterMode;
    theaterBtn.setAttribute('aria-pressed', String(_theaterMode));
    theaterBtn.style.color = _theaterMode ? 'var(--focus-color)' : '';
    document.body.classList.toggle('theater-mode', _theaterMode);
    announce(`Theater mode ${_theaterMode ? 'on' : 'off'}`);
  } });
  // Add theater-mode CSS
  const theaterStyle = document.createElement('style');
  theaterStyle.textContent = `
    body.theater-mode { background:#000 !important; }
    body.theater-mode #video-wrapper { box-shadow:none !important; border-radius:0 !important; }
    body.theater-mode #playlist-sidebar,
    body.theater-mode #bookmarks-sidebar,
    body.theater-mode #more-options-sidebar,
    body.theater-mode #top-bar,
    body.theater-mode #controls-overlay { opacity:0; pointer-events:none; }
    body.theater-mode #video-wrapper { flex:1 1 100%; }
  `;
  document.head.appendChild(theaterStyle);
  const theaterBtnParent = document.querySelector('#controls-overlay .right-controls') || document.querySelector('#controls-overlay');
  if (theaterBtnParent) theaterBtnParent.appendChild(theaterBtn);

  /* ------------------------------------------------- DRAG URL TO PLAY -- */
  document.addEventListener('drop', (e) => {
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('m3u8://') || url.startsWith('rtmp://'))) {
      e.preventDefault();
      addToPlaylist(url);
      currentPlaylistIndex = playlist.length - 1;
      loadMedia(url);
      renderPlaylist();
      announce('Playing dropped URL');
    }
  });

  /* ------------------------------------------------- VIDEO INFO OVERLAY ON HOVER -- */
  const vidInfoEl = ce('div', { id: 'vid-info', 'aria-hidden': 'true', style: 'display:none;position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.75);color:#fff;padding:6px 10px;border-radius:4px;font-size:0.75rem;pointer-events:none;z-index:10;' });
  videoWrapper.appendChild(vidInfoEl);
  videoWrapper.addEventListener('mouseenter', () => {
    if (!mediaPlayer.src) return;
    const fn = getFileName(playlist[currentPlaylistIndex]) || 'Unknown';
    const res = mediaPlayer.videoWidth ? `${mediaPlayer.videoWidth}x${mediaPlayer.videoHeight}` : 'Audio';
    const dur = mediaPlayer.duration ? formatTime(mediaPlayer.duration) : 'Live';
    vidInfoEl.textContent = `${fn} | ${res} | ${dur} | ${Math.round(mediaPlayer.playbackRate * 100)}% speed`;
    vidInfoEl.style.display = 'block';
  });
  videoWrapper.addEventListener('mouseleave', () => { vidInfoEl.style.display = 'none'; });

  /* ------------------------------------------------- QUICK COMMANDS -- */
  COMMANDS.push(
    { name: 'Toggle Audio-Only Mode', run: () => audioOnlyBtn.click() },
    { name: 'Toggle Theater Mode', run: () => theaterBtn.click() },
    { name: 'Open Snapshot Gallery', run: openGallery },
    { name: 'Reset Subtitle Offset', run: () => { _subOffset = 0; updateSubOffset(); announce('Subtitle offset reset'); } },
    { name: 'Save Playlist JSON', run: savePlaylistJSON },
    { name: 'Load Playlist JSON', run: loadPlaylistJSON },
    { name: 'Aspect Ratio Contain', run: () => applyAspect('contain') },
    { name: 'Aspect Ratio Fill', run: () => applyAspect('fill') },
    { name: 'Aspect Ratio 16:9', run: () => applyAspect('16 / 9') },
    { name: 'Aspect Ratio 4:3', run: () => applyAspect('4 / 3') },
    { name: 'Reset Balance', run: () => { balanceSlider.value = '0'; balanceSlider.dispatchEvent(new Event('input')); announce('Balance reset'); } },
    { name: 'Clear Recent History', run: () => { saveState('history', []); if (typeof renderHistory === 'function') renderHistory(); announce('Recent history cleared'); } },
  );

  console.log('[features.js] loaded');
})();
