/* ============================================================================
   features.js — Extended features for Accessible Media Player
   Loaded AFTER renderer.js; shares its global (module-level) bindings.
   Implements: WMP-style home/recent screen, playlist power-tools, per-file
   memory & stats, mouse-wheel controls, command palette, OSD,
   network URL play, multi-audio, enhanced bookmarks,
   subtitle export, auto-save playlist, sleep-after-track, and IPC hooks.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function ce(tag, props = {}, children = []) {
    // svg must be namespaced or the browser treats it as an unknown HTML tag and draws nothing
    const el = tag === 'svg' ? document.createElementNS(SVG_NS, 'svg') : document.createElement(tag);
    for (const k in props) {
      if (props[k] === undefined) continue;
      if (k === 'class') el.setAttribute('class', props[k]);
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
    const backAction = hasMedia() ? [{ label: 'Back to Player', icon: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', run: () => hideHome() }] : [];
    const quickActions = [...backAction,
      { label: 'Open Files', icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z', run: () => openFilesHandler() },
      { label: 'Open URL', icon: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z', run: () => openUrlPrompt() },
      { label: 'Open Playlist', icon: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', run: () => loadPlaylistBtn.click() },
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
        // Pick up where the listener stopped, unless they had basically finished it
        const dur = loadState('durations', {})[normalizePath(path)];
        const canResume = loadState('resumeEnabled', true) && lastPos > 5 && (!dur || lastPos < dur - 10);
        const tile = ce('button', { class: 'hm-tile', 'aria-label': `Play ${getFileName(path)}${canResume ? `, resumes at ${formatTime(lastPos)}` : ''}`, onclick: () => { playPath(path, canResume ? lastPos : 0); hideHome(); } }, [
          ce('div', { class: 'hm-tile-icon', html: fileTypeIcon(path) }),
          ce('div', { class: 'hm-tile-meta' }, [
            ce('div', { class: 'hm-tile-name', text: getFileName(path), title: path }),
            ce('div', { class: 'hm-tile-sub', text: canResume ? `Resume at ${formatTime(lastPos)}` : (watched > 0 ? `Watched ${formatHMS(watched)}` : 'Not played yet') })
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
      ce('li', { text: 'Press F1 or Ctrl+/ for every keyboard shortcut.' }),
      ce('li', { text: 'Press Ctrl+Shift+P to search all commands.' }),
      ce('li', { text: 'Ctrl+A says the current time. Ctrl+W says what is playing.' }),
      ce('li', { text: 'Ctrl+Shift+B bookmarks the current moment. Ctrl+B opens bookmarks.' }),
      ce('li', { text: 'Ctrl+D switches between surround, 8D and the other sound modes.' })
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
  function hideHome() {
    if (homeScreen.contains(document.activeElement)) { // focus leaves before the screen is hidden
      resetIdleTimer();
      playBtn.focus();
    }
    homeScreen.classList.remove('open');
    homeScreen.setAttribute('aria-hidden', 'true');
  }

  // Hide home whenever real media starts; show via Home button / command palette.
  mediaPlayer.addEventListener('loadedmetadata', () => { if (mediaPlayer.src) hideHome(); });

  // Home button in top bar
  const homeBtn = ce('button', { id: 'home-btn', class: 'icon-btn tooltip', 'aria-label': 'Home', 'data-tooltip': 'Home (Ctrl+H)', onclick: () => {
    if (homeScreen.classList.contains('open')) hideHome(); else showHome();
  } }, [ce('svg', { viewBox: '0 0 24 24', html: '<path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' })]);
  const topLeft = document.querySelector('.top-bar-left');
  if (topLeft) topLeft.appendChild(homeBtn);



  /* -------------------------------------------- PER-FILE MEMORY & STATS -- */
  const stats = loadState('stats', {});
  localStorage.removeItem('perFile'); // speed and volume are now global
  // These records would otherwise grow forever; insertion order makes the first keys the oldest
  const pruneRecord = (record, max) => { const keys = Object.keys(record); keys.slice(0, Math.max(0, keys.length - max)).forEach(k => delete record[k]); return record; };
  pruneRecord(stats, 1000);
  saveState('durations', pruneRecord(loadState('durations', {}), 2000));
  let lastTime = 0, statSaveAccum = 0;
  // False while a new file loads, so its reset speed is not saved as the file's preference
  let perFileReady = false;

  mediaPlayer.addEventListener('loadedmetadata', () => { perFileReady = true; });
  mediaPlayer.addEventListener('volumechange', () => saveState('lastVolume', mediaPlayer.volume));
  // The element resets to its default rate on every load, so the default follows the listener's choice
  mediaPlayer.addEventListener('ratechange', () => {
    if (silenceSkipIsActive()) return; // a temporary 4x must not become the listener's speed
    if (perFileReady) mediaPlayer.defaultPlaybackRate = mediaPlayer.playbackRate;
    updateSpeedUI();
  });

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
  let lastWheel = 0;
  videoWrapper.addEventListener('wheel', (e) => {
    if (!mediaPlayer.src || mediaPlayer.src.endsWith('index.html')) return;
    e.preventDefault();
    if (performance.now() - lastWheel < 70) return; // touchpads send a flood of tiny scrolls
    lastWheel = performance.now();
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
  const palInput = ce('input', { type: 'text', id: 'cmd-input', role: 'combobox', 'aria-expanded': 'true', 'aria-autocomplete': 'list', 'aria-controls': 'cmd-list', 'aria-label': 'Command search', placeholder: 'Type a command…' });
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

    { name: 'Home Screen', run: () => showHome() },
    { name: 'Toggle Shuffle', run: () => { if (shuffleToggle) { shuffleToggle.checked = !shuffleToggle.checked; shuffleToggle.dispatchEvent(new Event('change')); } } },
    { name: 'Toggle Autoplay Next', run: () => { if (autoplayToggle) { autoplayToggle.checked = !autoplayToggle.checked; autoplayToggle.dispatchEvent(new Event('change')); showOSD(`Autoplay ${autoplayToggle.checked ? 'on' : 'off'}`); } } },
    { name: 'Load Subtitles', run: () => loadSubsBtn.click() },
    { name: 'Export Subtitles', run: () => exportSubtitles() },

    { name: 'Toggle High Contrast', run: () => { if (highContrastToggle) { highContrastToggle.checked = !highContrastToggle.checked; highContrastToggle.dispatchEvent(new Event('change')); } } },
    { name: 'Toggle Large Text', run: () => { if (largeTextToggle) { largeTextToggle.checked = !largeTextToggle.checked; largeTextToggle.dispatchEvent(new Event('change')); } } }
  ];
  let palIndex = 0;
  function renderPalette(query) {
    palList.innerHTML = '';
    const q = (query || '').toLowerCase();
    const filtered = COMMANDS.filter((c, i) => c.name.toLowerCase().includes(q) && COMMANDS.findIndex(o => o.name === c.name) === i);
    palIndex = Math.min(palIndex, Math.max(0, filtered.length - 1));
    if (filtered.length === 0) { palList.appendChild(ce('li', { class: 'cmd-empty', text: 'No commands found' })); return; }
    filtered.forEach((c, i) => {
      const li = ce('li', { class: 'cmd-item' + (i === palIndex ? ' active' : ''), role: 'option', 'aria-selected': i === palIndex ? 'true' : 'false', text: c.name, onclick: () => runPalette(c) });
      palList.appendChild(li);
    });
  }
  function runPalette(c) {
    closePalette();
    if (window._lastModalPrevFocus) { window._lastModalPrevFocus.focus(); window._lastModalPrevFocus = null; }
    c.run();
  }
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


  /* ------------------------------------------- MINI / FOCUS / FPS MODES -- */
  /* ------------------------------------------------- NETWORK URL PLAY -- */
  const urlModal = ce('div', { id: 'url-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const urlInput = ce('input', { type: 'text', id: 'url-input', 'aria-label': 'Web address or file path', placeholder: 'https://… or file path', style: 'padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:4px;font-size:1rem;width:100%;' });
  urlModal.appendChild(ce('div', { class: 'modal-content', role: 'dialog', 'aria-label': 'Open URL', style: 'min-width:420px;padding:20px;' }, [
    ce('h3', { style: 'margin-top:0;', text: 'Open Network URL or Path' }),
    ce('p', { style: 'margin:0 0 12px;font-size:0.85rem;color:#bbb;max-width:420px;', text: 'Needs a direct link to a media file, such as one ending in .mp3 or .mp4, or a radio stream. Web pages like YouTube cannot be played.' }),
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
    const v = urlInput.value.trim().replace(/^"(.*)"$/, '$1'); // Explorer's "Copy as path" adds quotes
    if (!v) return;
    closeUrl();
    hideHome();
    playPath(v);
  }
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') closeUrl(); });

  // Paste a URL from clipboard
  window.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && /^https?:\/\/\S+$/.test(text.trim()) && !isTypingTarget(document.activeElement) && !isModalOpen()) {
      playPath(text.trim());
    }
  });

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
      bookmarksSidebarList.innerHTML = '<li style="padding: 15px; color: #888; text-align: center; font-size: 0.9rem;">No bookmarks yet. Press Ctrl+Shift+B or use the button above to add one.</li>';
      return;
    }
    bookmarks.forEach((bm, i) => {
      const li = ce('li', { class: 'bookmark-item' });
      const row = ce('div', { class: 'bookmark-row' });

      const titleInput = ce('input', { class: 'bookmark-title-input', type: 'text', value: bm.label || '', 'aria-label': 'Bookmark label' });
      titleInput.addEventListener('change', (e) => {
        const current = getBookmarks();
        if (current[i]) {
          current[i].label = e.target.value.trim() || `Bookmark at ${formatTime(bm.time)}`;
          saveBookmarks(current);
          jumpBtn.setAttribute('aria-label', `Jump to ${current[i].label}`);
          delBtn.setAttribute('aria-label', `Delete ${current[i].label}`);
          announce('Bookmark renamed');
        }
      });

      const timeBadge = ce('span', { class: 'bookmark-time-badge', text: formatTime(bm.time), title: `Jump to ${formatTime(bm.time)}`, onclick: () => { mediaPlayer.currentTime = bm.time; announce(`Jumped to ${formatTime(bm.time)}`); } });

      const note = ce('textarea', { class: 'bookmark-note', placeholder: 'Add a note…', 'aria-label': 'Bookmark note' });
      note.value = bm.note || '';
      note.addEventListener('input', (e) => { // saved as typed, so closing the app cannot lose it
        const current = getBookmarks();
        if (current[i]) { current[i].note = e.target.value; saveBookmarks(current); }
      });

      const actions = ce('div', { class: 'bookmark-actions' });
      const jumpBtn = ce('button', { class: 'action-btn-small', text: 'Jump', 'aria-label': `Jump to ${bm.label}`, onclick: () => { mediaPlayer.currentTime = bm.time; announce(`Jumped to ${formatTime(bm.time)}`); } });
      const delBtn = ce('button', { class: 'builder-remove-btn', text: 'Delete', style: 'padding:4px 8px;', 'aria-label': `Delete ${bm.label}`, onclick: () => { const current = getBookmarks(); current.splice(i, 1); saveBookmarks(current); renderBookmarks(); announce('Bookmark deleted'); } });
      actions.appendChild(jumpBtn); actions.appendChild(delBtn);

      row.appendChild(titleInput); row.appendChild(timeBadge);

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
    const label = `Bookmark at ${formatTime(time)}`;
    bookmarks.push({ time, label, note: '' });
    bookmarks.sort((a, b) => a.time - b.time);
    saveBookmarks(bookmarks);
    renderBookmarks();
    announce(`Bookmark added at ${formatTime(time)}`);
    if (window.ampCue) window.ampCue('bookmark');
  };

  /* ----------------------------------------------- PLAYLIST POWER-TOOLS -- */
  // Inject search box + duration + dedupe into playlist sidebar
  const playlistSearch = ce('input', { type: 'text', id: 'playlist-search', placeholder: 'Search queue…', 'aria-label': 'Search queue', style: 'width:100%;padding:8px;margin:8px 0;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;' });
  const playlistMeta = ce('div', { id: 'playlist-meta', style: 'font-size:0.8rem;color:#aaa;padding:0 15px 8px;display:flex;justify-content:space-between;' });

  const playlistHeader = document.querySelector('#playlist-sidebar .playlist-header');
  if (playlistHeader) {
    playlistHeader.insertAdjacentElement('afterend', playlistSearch);
    playlistHeader.insertAdjacentElement('afterend', playlistMeta);

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
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isInteger(from)) reorderPlaylist(from, idx);
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
    if (from === to || from < 0 || to < 0 || to >= playlist.length) return;
    const [moved] = playlist.splice(from, 1);
    playlist.splice(to, 0, moved);
    if (currentPlaylistIndex === from) currentPlaylistIndex = to;
    else if (from < currentPlaylistIndex && to >= currentPlaylistIndex) currentPlaylistIndex--;
    else if (from > currentPlaylistIndex && to <= currentPlaylistIndex) currentPlaylistIndex++;
    pendingPlaylistFocus = to;
    renderPlaylist();
    announce(`Moved to position ${to + 1}`);
  }

  function playNextAfter(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    if (idx === currentPlaylistIndex) return;
    const [item] = playlist.splice(idx, 1);
    if (idx < currentPlaylistIndex) currentPlaylistIndex--;
    playlist.splice(currentPlaylistIndex + 1, 0, item);
    renderPlaylist();
    announce('Queued to play next');
  }

  function removeQueueItem(idx) {
    lastRemoved = { item: playlist[idx], index: idx, wasCurrent: idx === currentPlaylistIndex };
    playlist.splice(idx, 1);
    // Removing the playing track: "next" should now be whatever slid into its place
    if (currentPlaylistIndex >= idx) currentPlaylistIndex--;
    renderPlaylist();
    showUndo();
    announce(`Removed ${getFileName(lastRemoved.item)}. Press Control Z to undo.`);
  }
  let lastClearedQueue = null;
  clearPlaylistBtn.addEventListener('click', () => {
    if (playlist.length) lastClearedQueue = { items: playlist.slice(), index: currentPlaylistIndex };
  }, true);
  function undoRemove() {
    if (lastClearedQueue && !playlist.length) {
      playlist = lastClearedQueue.items;
      currentPlaylistIndex = lastClearedQueue.index;
      lastClearedQueue = null;
      renderPlaylist();
      announce(`Queue restored, ${playlist.length} tracks`);
      return;
    }
    if (!lastRemoved) return;
    playlist.splice(lastRemoved.index, 0, lastRemoved.item);
    if (currentPlaylistIndex >= lastRemoved.index - (lastRemoved.wasCurrent ? 1 : 0)) currentPlaylistIndex++;
    pendingPlaylistFocus = playlistItems.contains(document.activeElement) ? lastRemoved.index : null;
    renderPlaylist();
    announce(`Restored ${getFileName(lastRemoved.item)}`);
    lastRemoved = null;
    document.querySelectorAll('.undo-bar').forEach(b => b.remove());
  }

  function removePlaylistMenu() { document.querySelectorAll('.ctx-menu').forEach(m => m.remove()); }

  function showUndo() {
    const bar = ce('div', { class: 'undo-bar' }, [
      ce('span', { text: 'Track removed' }),
      ce('button', { class: 'action-btn-small', text: 'Undo', onclick: undoRemove })
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
  // Restore before the first save below, so a resumed clip cannot overwrite the queue
  (function restoreQueue() {
    const auto = loadState('autoplaylist', null);
    if (!Array.isArray(auto)) return;
    const saved = auto.filter(p => typeof p === 'string' && p);
    if (!saved.length) return;
    const active = currentFilePath ? normalizePath(currentFilePath) : null;
    if (active && !saved.some(p => normalizePath(p) === active)) saved.unshift(currentFilePath);
    playlist = saved;
    currentPlaylistIndex = active ? playlist.findIndex(p => normalizePath(p) === active) : -1;
  })();
  const _renderWithSave = renderPlaylist;
  renderPlaylist = function () { _renderWithSave(); saveState('autoplaylist', playlist); };
  renderPlaylist();

  /* ------------------------------------------------- SUBTITLE EXPORT -- */
  function exportSubtitles() {
    if (!subtitleFileText) { announce('No subtitle loaded to export'); return; }
    const isSrt = /\.(srt)$/i.test(currentSubtitleName || '');
    let cues = parseSubtitles(subtitleFileText, isSrt);
    if (!cues.length) cues = parseSubtitles(subtitleFileText, !isSrt);
    // Rebuilt from cues: numbered, comma timestamps, and including any sync offset
    const out = cues.map((c, i) => {
      const stamp = (t) => fmtVtt(Math.max(0, t + subtitleOffset)).replace('.', ',');
      return `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`;
    }).join('\n');
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
    stopAfterCurrentTrack = sleepStopAtEnd;
    if (sleepStopAtEnd) { sleepTimerSelect.value = 'off'; sleepTimerSelect.dispatchEvent(new Event('change')); announce('Will stop at end of track'); }
    else announce('Sleep-at-end disabled');
  });
  mediaPlayer.addEventListener('ended', () => {
    if (sleepStopAtEnd && !isLooping) { stopAfterCurrentTrack = false; sleepStopAtEnd = false; sleepEndCheck.querySelector('input').checked = false; announce('Stopped at end of track (sleep timer)'); }
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
    hideHome();
  });
  ipcRenderer.on('request-home', () => showHome());
  ipcRenderer.on('request-url', () => openUrlPrompt());
  ipcRenderer.on('request-palette', () => openPalette());

  // Notification on track change
  mediaPlayer.addEventListener('loadedmetadata', () => {
    if (currentFilePath && loadState('setting:notify-toggle', false)) {
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
  let bootSilent = true; // restoring saved settings must not talk over launch
  announce = function (message, forceCritical) {
    if (bootSilent) return;
    const critical = forceCritical || message.includes('Playing') || message.includes('Paused') ||
      message.includes('Loaded') || message.includes('Stopped');
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
    const dialog = modalEl.querySelector('[role="dialog"]');
    if (dialog) dialog.setAttribute('aria-modal', 'true');
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
      if (i === palIndex) { li.setAttribute('aria-selected', 'true'); palInput.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
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
  const topBarEl = document.getElementById('top-bar');
  if (topBarEl) {
    topBarEl.setAttribute('role', 'navigation');
    topBarEl.setAttribute('aria-label', 'Top toolbar');
  }
  [playlistSidebar, bookmarksSidebar, moreOpts].forEach(s => { if (s) { s.setAttribute('role', 'region'); } });

  // Skip link for keyboard / SR users
  const skipLink = ce('a', { href: '#controls-overlay', id: 'skip-link', class: 'sr-only skip-link', text: 'Skip to playback controls',
    onclick: (e) => { e.preventDefault(); controlsOverlay.setAttribute('tabindex', '-1'); controlsOverlay.focus(); } });
  document.getElementById('app-container').insertBefore(skipLink, document.getElementById('app-container').firstChild);

  /* ---- Accessible context menu (was a plain div) ---- */
  function showPlaylistMenu(e, idx) {
    removePlaylistMenu();
    const menu = ce('div', { class: 'ctx-menu', role: 'menu', 'aria-label': 'Playlist item actions',
      style: `position:fixed;left:${Math.min(e.clientX, window.innerWidth - 190)}px;top:${Math.min(e.clientY, window.innerHeight - 200)}px;z-index:300;` });
    const actions = [
      { label: 'Play Now', run: () => playPlaylistItem(idx) },
      { label: 'Play Next', run: () => playNextAfter(idx) },
      { label: 'Remove', run: () => { pendingPlaylistFocus = idx; removeQueueItem(idx); } },
      { label: 'Copy Path', run: () => { navigator.clipboard && navigator.clipboard.writeText(playlist[idx]); announce('Path copied'); } },
      ...(isUrl(playlist[idx]) ? [] : [{ label: 'Show in File Explorer', run: () => ipcRenderer.send('reveal-file', playlist[idx]) }])
    ];
    const buttons = actions.map(a => ce('button', { class: 'ctx-item', role: 'menuitem', text: a.label,
      onclick: () => { a.run(); removePlaylistMenu(); if (prevMenuFocus && prevMenuFocus.isConnected) prevMenuFocus.focus(); } }));
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
  }

  /* ---- Keyboard playlist reorder (Ctrl+Arrow on a focused item) ---- */
  // Patch into the existing renderPlaylist DnD handler
  const _renderPlaylistReorder = renderPlaylist;
  renderPlaylist = function () {
    _renderPlaylistReorder();
    const items = playlistItems.querySelectorAll('.playlist-item');
    items.forEach((li, idx) => {
      li.addEventListener('keydown', (ev) => {
        if (ev.key === 'Delete') {
          ev.preventDefault();
          pendingPlaylistFocus = idx;
          removeQueueItem(idx);
          return;
        }
        // Arrows walk the queue, so a long list is not one Tab stop per track
        if (!ev.ctrlKey && !ev.shiftKey && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) {
          ev.preventDefault();
          const visible = Array.from(playlistItems.querySelectorAll('.playlist-item')).filter(x => x.style.display !== 'none');
          const at = visible.indexOf(li);
          const target = { ArrowUp: visible[at - 1], ArrowDown: visible[at + 1], Home: visible[0], End: visible[visible.length - 1] }[ev.key];
          if (target) target.focus();
          return;
        }
        if (ev.ctrlKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
          ev.preventDefault();
          reorderPlaylist(idx, ev.key === 'ArrowUp' ? idx - 1 : idx + 1);
        }
      });
    });
  };

  /* ---- Quick Toggles panel (proper aria-pressed buttons) ---- */
  let alwaysOnTop = false, normalizationOn = false;
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

  mkToggle('Always on Top', () => alwaysOnTop, () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); });

  mkToggle('Subtitles', () => subsVisible(), () => toggleSubtitles());
  // Append toggles AFTER static content so they appear at the top of the dynamic area
  if (moScroll) moScroll.appendChild(togglesPanel);
  // Everything that has to happen around a track change
  let fadingOut = false, fadeInPending = false;
  let skippingSilence = false;
  const _origLM = loadMedia;
  loadMedia = function (fp, seekTo) {
    // Some items need work before there is anything to play
    if (!preparedSources.has(fp)) {
      if (isWebPageLink(fp)) return prepareThenLoad(fp, seekTo, 'web');
      if (needsConversion(fp)) return prepareThenLoad(fp, seekTo, 'convert');
    }
    prepareToken++;
    ipcRenderer.send('cancel-convert');
    perFileReady = false;
    skippingSilence = false;
    autoSkipFailures = hasMediaError() ? autoSkipFailures : 0;
    if (fadingOut) { fadingOut = false; fadeInPending = true; }
    else if (!sleepFading) rampFade(1, 0.05);
    clearLyrics();
    clearChapters();
    let resumedAt = 0;
    if (seekTo === undefined && loadState('resumeEnabled', true)) {
      // Every file carries on from where it was left
      const lastPos = (stats[normalizePath(fp)] || {}).lastPos || 0;
      const dur = loadState('durations', {})[normalizePath(fp)];
      if (lastPos > 5 && (!dur || lastPos < dur - 10)) { seekTo = lastPos; resumedAt = lastPos; }
    }
    _origLM(fp, seekTo);
    applyAudioOnly();
    loadSidecarFiles(fp);
    loadChapters(fp);
    if (resumedAt) announce(`Resuming at ${formatTime(resumedAt)}. Press Control 0 to start over.`);
  };

  /* ---- Web links and formats that need converting first ---- */
  const WEB_PAGE_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|soundcloud\.com|dailymotion\.com|twitch\.tv|tiktok\.com|bandcamp\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|reddit\.com)$/i;
  const CONVERT_EXTS = ['avi', 'wmv', 'wma', 'flv', 'mpg', 'mpeg', 'vob', 'ts', 'm2ts', 'asf', 'rm', 'rmvb', 'ape', 'aiff', 'aif', 'ac3', 'dts', 'amr'];
  function isWebPageLink(p) {
    if (!/^https?:/i.test(p)) return false;
    try { return WEB_PAGE_HOSTS.test(new URL(p).hostname); } catch (e) { return false; }
  }
  function needsConversion(p) {
    return !isUrl(p) && CONVERT_EXTS.includes(p.split('.').pop().toLowerCase());
  }
  let prepareToken = 0;
  function prepareThenLoad(fp, seekTo, kind, options) {
    const token = ++prepareToken;
    mediaPlayer.pause();
    currentFilePath = fp;
    titleDisplay.textContent = kind === 'web' ? 'Getting link…' : 'Converting…';
    announce(kind === 'web' ? 'Getting the stream. This can take a few seconds.' : `Converting ${getFileName(fp)} so it can play. This happens once per file.`, true);
    ipcRenderer.invoke(kind === 'web' ? 'resolve-web-media' : 'convert-media', fp, options).then((result) => {
      if (token !== prepareToken || !result || result.cancelled) return; // the listener moved on
      if (result.declined) { titleDisplay.textContent = getFileName(fp); announce('Download cancelled, so this cannot be played', true); return; }
      if (result.error) {
        titleDisplay.textContent = getFileName(fp);
        announce(`Cannot play ${getFileName(fp)}: ${result.error}`, true);
        showOSD(`Cannot play: ${result.error}`);
        if (window.ampCue) window.ampCue('error');
        moveOnAfterFailure(fp);
        return;
      }
      if (kind === 'web') {
        preparedSources.set(fp, result.url);
        setTimeout(() => preparedSources.delete(fp), 3 * 60 * 60 * 1000); // stream links expire
        if (result.title) { const titles = loadState('webTitles', {}); titles[fp] = result.title; saveState('webTitles', titles); }
      } else {
        preparedSources.set(fp, toMediaSrc(result.path));
      }
      loadMedia(fp, seekTo);
      renderPlaylist();
    });
  }
  let lastProgressSpoken = -25;
  ipcRenderer.on('tool-progress', (event, { label, percent }) => {
    showOSD(`${label}: ${percent}%`);
    if (percent === 0) lastProgressSpoken = -25;
    if (percent >= lastProgressSpoken + 25) { lastProgressSpoken = percent; announce(`${label} ${percent} percent`); }
  });
  function hasMediaError() { return !!mediaPlayer.error; }

  // Subtitles and lyrics saved next to the media file, with the same name
  async function loadSidecarFiles(fp) {
    if (isUrl(fp)) return;
    let found = null;
    try { found = await ipcRenderer.invoke('read-sidecars', fp); }
    catch (e) { console.error('Could not read sidecar files', e); }
    if (!found || currentFilePath !== fp) return; // the listener has moved on
    if (found.subtitle) {
      loadSubtitleText(decodeText(found.subtitle.data), found.subtitle.name);
      announce('Subtitles found and loaded');
    }
    if (found.lyrics) parseLRC(decodeText(found.lyrics), true);
  }

  // Unplayable or missing files: say so, then keep the queue moving
  let autoSkipFailures = 0;
  const retriedSources = new Set();
  mediaPlayer.addEventListener('error', () => {
    const err = mediaPlayer.error;
    if (!err || !currentFilePath) return;
    suppressPlayAnnounce = false;
    const reasons = { 1: 'loading was stopped', 2: 'a network error occurred', 3: 'the file is damaged or uses an unsupported codec', 4: 'the file is missing or its format is not supported' };
    // A local file the engine turned down may still convert; a link may be a page yt-dlp understands
    if (err.code >= 3 && !retriedSources.has(currentFilePath)) {
      const failed = currentFilePath;
      retriedSources.add(failed);
      preparedSources.delete(failed);
      if (!isUrl(failed)) { prepareThenLoad(failed, 0, 'convert'); return; }
      if (/^https?:/i.test(failed)) {
        ipcRenderer.invoke('resolve-web-media', failed, { onlyIfInstalled: true }).then((found) => {
          if (currentFilePath === failed && found && found.url) { preparedSources.set(failed, found.url); loadMedia(failed); }
        });
      }
    }
    const reason = (isUrl(currentFilePath) && err.code === 4) ? 'that link is not a direct media file' : (reasons[err.code] || 'unknown error');
    announce(`Cannot play ${getFileName(currentFilePath)}: ${reason}`, true);
    showOSD(`Cannot play: ${reason}`);
    console.error('Media error', err.code, err.message);
    moveOnAfterFailure(currentFilePath);
  });
  function moveOnAfterFailure(failedFile) {
    autoSkipFailures++;
    const canAdvance = currentPlaylistIndex < playlist.length - 1 || repeatMode === 'all';
    if (autoplayToggle.checked && canAdvance && autoSkipFailures < playlist.length) {
      setTimeout(() => { if (currentFilePath === failedFile) playNext(); }, 2500); // unless the user already moved on
    }
  }
  mediaPlayer.addEventListener('playing', () => { autoSkipFailures = 0; });




  /* ---- M3U export + Add Folder buttons in playlist sidebar ---- */
  const headerBtns = document.querySelector('#playlist-sidebar .header-btns');
  if (headerBtns) {
    const m3uBtn = ce('button', { class: 'icon-btn tooltip', 'aria-label': 'Export M3U Playlist', title: 'Export M3U', text: 'M3U',
      onclick: exportPlaylistM3U });
    const folderBtn = ce('button', { class: 'icon-btn tooltip', 'aria-label': 'Add Folder to Playlist', title: 'Add Folder', text: '📁',
      onclick: async () => { const files = await ipcRenderer.invoke('open-directory-dialog'); if (Array.isArray(files)) { if (files.length) addFilesAndPlay(files); else announce('No media files found in that folder'); } } });
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

  /* ---- Audio output device selection ---- */
  const audioDevSelect = ce('select', { id: 'audio-device-select', 'aria-label': 'Audio Output Device', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' }, [ce('option', { value: '', text: 'System Default' })]);
  // Audio leaves through the Web Audio graph, so the AudioContext picks the device.
  audioDevSelect.addEventListener('change', async () => {
    try {
      initAudio();
      await audioCtx.setSinkId(audioDevSelect.value);
      saveState('audioDevice', audioDevSelect.value);
      announce(`Audio output: ${audioDevSelect.options[audioDevSelect.selectedIndex].text}`);
    } catch (e) { console.error('setSinkId failed', e); announce('Could not switch audio output'); }
  });
  const refreshDevBtn = ce('button', { class: 'action-btn-small', text: 'Refresh', onclick: refreshDevices });
  async function refreshDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const wanted = audioDevSelect.value || loadState('audioDevice', '');
      audioDevSelect.innerHTML = '<option value="">System Default</option>';
      devs.filter(d => d.kind === 'audiooutput').forEach(d => audioDevSelect.appendChild(ce('option', { value: d.deviceId, text: d.label || ('Device ' + d.deviceId.slice(0, 6)) })));
      const stillThere = Array.from(audioDevSelect.options).some(o => o.value === wanted);
      audioDevSelect.value = stillThere ? wanted : '';
      // Follow a saved choice, or fall back cleanly when that device has gone
      if (wanted && (stillThere ? !audioCtx || audioCtx.sinkId !== wanted : true)) audioDevSelect.dispatchEvent(new Event('change'));
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
    if (!mediaPlayer.videoWidth) return announce('No video picture to copy');
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
    { name: 'Always on Top', run: () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); } },
    { name: 'Clear History', run: () => clearHistory() },
  );
  function clearHistory() {
    // The in-memory copy is saved again on exit, so it has to be emptied too
    Object.keys(stats).forEach(k => delete stats[k]);
    saveState('history', []); saveState('stats', {}); saveState('resume', null);
    renderHome(); announce('History cleared');
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

  // On-demand position reports, instead of a constant stream of time updates
  function sayTime() {
    if (!hasMedia()) return announce('No media loaded', true);
    const dur = mediaPlayer.duration;
    if (!isFinite(dur)) return announce(`${formatTime(mediaPlayer.currentTime)} elapsed`, true);
    const sleepNote = sleepTimerEndTime ? `. Sleep timer ends in ${formatTime((sleepTimerEndTime - Date.now()) / 1000)}` : '';
    announce(`${formatTime(mediaPlayer.currentTime)} elapsed of ${formatTime(dur)}, ${formatTime(dur - mediaPlayer.currentTime)} remaining${sleepNote}`, true);
  }
  function sayNowPlaying() {
    if (!currentFilePath) return announce('Nothing is playing', true);
    const pos = currentPlaylistIndex >= 0 ? `, track ${currentPlaylistIndex + 1} of ${playlist.length}` : '';
    announce(`${mediaPlayer.paused ? 'Paused' : 'Now Playing'}: ${getFileName(currentFilePath)}${pos}`, true);
  }
  COMMANDS.push({ name: 'Say Current Time', run: sayTime }, { name: 'Say What Is Playing', run: sayNowPlaying });

  /* ====================================================================
     MORE FEATURES
     ==================================================================== */

  let _audioOnly = loadState('audioOnly', false);
  // The one place that decides what is shown: the video picture or the visualizer
  function applyAudioOnly() {
    const noPicture = isAudioFile(currentFilePath) || (mediaPlayer.readyState >= 1 && !mediaPlayer.videoWidth);
    const hideVideo = _audioOnly || noPicture;
    mediaPlayer.style.display = hideVideo ? 'none' : '';
    audioVisualizer.style.display = hideVideo && currentFilePath ? 'flex' : 'none';
  }

  // --- Transcript panel (accessible subtitle browser) ---
  const transcriptList = ce('ul', { id: 'transcript-list', 'aria-label': 'Subtitle transcript', style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;' });
  const transcriptSearch = ce('input', { type: 'text', placeholder: 'Search transcript…', 'aria-label': 'Search transcript', style: 'width:100%;padding:6px;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;margin-bottom:8px;' });
  function renderTranscript() {
    transcriptList.innerHTML = '';
    let cues = [];
    if (mediaPlayer.textTracks && mediaPlayer.textTracks.length) {
      const t = Array.from(mediaPlayer.textTracks).find(tr => tr.kind === 'subtitles' && tr.cues && tr.cues.length);
      if (t) for (let i = 0; i < t.cues.length; i++) cues.push({ start: t.cues[i].startTime, text: t.cues[i].text });
    }
    if (!cues.length) { transcriptList.innerHTML = '<li style="color:#888;padding:8px;">No subtitles loaded.</li>'; return; }
    const q = transcriptSearch.value.toLowerCase();
    cues.forEach(c => {
      c.text = c.text.replace(/<[^>]+>/g, ''); // italics and voice tags are not for reading
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
  document.addEventListener('subtitles-changed', renderTranscript);
  const transcriptSection = ce('div', { class: 'mo-section', style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);display:flex;justify-content:space-between;align-items:center;', text: 'Transcript' }),
    transcriptSearch, transcriptList
  ]);
  if (moScroll) moScroll.insertBefore(transcriptSection, moScroll.firstChild);
  COMMANDS.push({ name: 'Show Transcript', run: () => {
    if (!moreOptionsSidebar.classList.contains('open')) toggleMoreOptionsSidebar();
    setTimeout(() => transcriptSearch.focus(), 350);
  } });

  // --- Keyboard shortcuts help overlay ---
  // Keys that belong to whatever has focus, so they stay as they are and are not remappable
  const FOCUS_KEYS = [
    ['Esc', 'Close panel or exit fullscreen'], ['F1', 'This help'],
    ['← / → on seek bar', 'Seek 10 seconds'], ['Page Up / Down on seek bar', 'Seek 1 minute'],
    ['↑ / ↓ in queue', 'Move between tracks'], ['Ctrl+↑ / ↓ in queue', 'Move the track'],
    ['Enter in queue', 'Play the track'], ['Shift+Enter in queue', 'Play the track next'], ['Delete in queue', 'Remove the track']
  ];
  const helpModal = ce('div', { id: 'help-modal', class: 'modal', 'aria-hidden': 'true', style: 'display:none;' });
  const helpList = ce('ul', { id: 'help-list', style: 'list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;overflow-y:auto;max-height:60vh;' });

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

  // Make the progress slider explain its keys to screen readers
  progressSlider.setAttribute('aria-describedby', 'progress-help');
  const progressHelp = ce('span', { id: 'progress-help', class: 'sr-only', text: 'Use Left and Right arrows to seek ten seconds. Page Up and Page Down seek one minute. Home and End jump to the start or end.' });
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
    if (!silenceSkipIsActive() && perFileReady && now - lastRateAnnounce > 400) { lastRateAnnounce = now; announce(`Speed ${formatRate(mediaPlayer.playbackRate)} times`); }
  });

  // --- Wire the new General-setting checkboxes ---
  const resumeToggle = document.getElementById('resume-enabled-toggle');
  const homeToggle = document.getElementById('start-in-home-toggle');
  if (resumeToggle) { resumeToggle.checked = loadState('resumeEnabled', true); resumeToggle.addEventListener('change', () => saveState('resumeEnabled', resumeToggle.checked)); }
  if (homeToggle) { homeToggle.checked = loadState('startInHome', false); homeToggle.addEventListener('change', () => saveState('startInHome', homeToggle.checked)); }

  // Add Audio-Only to Quick Toggles
  mkToggle('Audio Only', () => _audioOnly, () => audioOnlyBtn.click());

  // Show home screen on launch when there is no media to resume into
  if (!mediaPlayer.src || mediaPlayer.src.endsWith('index.html')) {
    showHome();
  }

  /* ====================================================================
     FEATURE PACK 2: Spatial Audio, A-B Loop, Media Info, EQ Presets,
     Chapters, Speed Presets, Enhanced Visualizer Themes, Startup
     ==================================================================== */

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
        <span style="color:#888;">File:</span><span>${escapeHtml(name)}</span>
        <span style="color:#888;">Type:</span><span>${escapeHtml(ext)}</span>
        <span style="color:#888;">Duration:</span><span>${dur}</span>
        <span style="color:#888;">Resolution:</span><span>${w} × ${h}</span>
        <span style="color:#888;">Audio Tracks:</span><span>${audioT}</span>
        <span style="color:#888;">Volume:</span><span>${Math.round(mediaPlayer.volume * 100)}%</span>
        <span style="color:#888;">Speed:</span><span>${mediaPlayer.playbackRate.toFixed(2)}x</span>
        <span style="color:#888;">Path:</span><span style="word-break:break-all;font-size:0.8rem;">${escapeHtml(currentFilePath)}</span>
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


  /* ------------------------------------------------- FADE BETWEEN TRACKS -- */
  // One media element cannot overlap two tracks, so this fades the old track
  // out over its last seconds and the new one in. It lives on its own gain node
  // so the user's volume setting is never touched.
  let crossfadeDuration = 3;
  const crossfadeCb = document.getElementById('crossfade-toggle');
  const gaplessCb = document.getElementById('gapless-toggle');
  const crossfadeDur = ce('input', { type: 'range', id: 'crossfade-duration', min: '1', max: '10', step: '0.5', value: '3', 'aria-label': 'Fade length in seconds', 'aria-valuetext': '3 seconds', style: 'flex:1;' });
  const crossfadeDurVal = ce('span', { id: 'crossfade-dur-val', style: 'font-size:0.85rem;color:var(--focus-color);min-width:30px;', text: '3s' });
  crossfadeCb.closest('div[style*="background"]').appendChild(ce('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
    ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Length:' }), crossfadeDur, crossfadeDurVal
  ]));
  crossfadeDur.addEventListener('input', () => {
    crossfadeDuration = parseFloat(crossfadeDur.value);
    crossfadeDurVal.textContent = crossfadeDuration + 's';
    crossfadeDur.setAttribute('aria-valuetext', `${crossfadeDuration} seconds`);
  });
  crossfadeCb.addEventListener('change', () => {
    if (crossfadeCb.checked && gaplessCb.checked) gaplessCb.checked = false;
    if (!crossfadeCb.checked && fadingOut) { fadingOut = false; rampFade(1, 0.1); }
    announce(`Fade between tracks ${crossfadeCb.checked ? 'enabled' : 'disabled'}`);
  });
  gaplessCb.addEventListener('change', () => {
    if (gaplessCb.checked && crossfadeCb.checked) { crossfadeCb.checked = false; crossfadeCb.dispatchEvent(new Event('change')); }
    announce(`Gapless ${gaplessCb.checked ? 'enabled' : 'disabled'}`);
  });
  function willAutoAdvance() {
    if (repeatMode === 'one' || !playlist.length || sleepStopAtEnd) return false;
    if (!autoplayToggle.checked && repeatMode !== 'all') return false;
    if (shuffleToggle.checked && playlist.length > 1) return shuffleChoices().length > 0 || repeatMode === 'all';
    return currentPlaylistIndex < playlist.length - 1 || repeatMode === 'all';
  }
  mediaPlayer.addEventListener('timeupdate', () => {
    const dur = mediaPlayer.duration, cur = mediaPlayer.currentTime;
    if (!crossfadeCb.checked || fadingOut || mediaPlayer.paused || !isFinite(dur) || abEnd !== null) return;
    if (dur > crossfadeDuration * 2 && dur - cur <= crossfadeDuration && willAutoAdvance()) {
      fadingOut = true;
      rampFade(0, Math.max(0.05, (dur - cur) / mediaPlayer.playbackRate));
    }
  });
  mediaPlayer.addEventListener('seeked', () => {
    if (fadingOut && mediaPlayer.duration - mediaPlayer.currentTime > crossfadeDuration) { fadingOut = false; rampFade(1, 0.1); }
  });
  mediaPlayer.addEventListener('playing', () => {
    if (!fadeInPending || !fadeNode) return;
    fadeInPending = false;
    fadeNode.gain.cancelScheduledValues(audioCtx.currentTime);
    fadeNode.gain.setValueAtTime(0, audioCtx.currentTime);
    rampFade(1, crossfadeDuration);
  });

  /* ---- Gapless: have the next file buffered before it is needed ---- */
  const nextTrackPreloader = new Audio();
  nextTrackPreloader.preload = 'auto';
  nextTrackPreloader.muted = true;
  let preloadedPath = null;
  mediaPlayer.addEventListener('timeupdate', () => {
    const next = playlist[currentPlaylistIndex + 1];
    if (!gaplessCb.checked || !next || next === preloadedPath || shuffleToggle.checked) return;
    if (mediaPlayer.duration - mediaPlayer.currentTime < 30) {
      preloadedPath = next;
      nextTrackPreloader.src = toMediaSrc(next);
    }
  });

  /* ---- Smart pause: stop when the listening device goes away ---- */
  const smartPauseCb = document.getElementById('smart-pause-toggle');
  async function listOutputIds() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications').map(d => d.deviceId);
  }
  let knownOutputs = [];
  listOutputIds().then(ids => { knownOutputs = ids; }).catch(() => {});
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    let current;
    try { current = await listOutputIds(); } catch (e) { return; }
    const removed = knownOutputs.some(id => !current.includes(id));
    knownOutputs = current;
    refreshDevices();
    if (removed && smartPauseCb.checked && !mediaPlayer.paused) {
      mediaPlayer.pause();
      announce('Audio device disconnected. Paused', true);
      showOSD('Audio device disconnected');
    }
  });

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
  let videoCtxMenuPrevFocus = null;
  function showVideoCtxMenu(e) {
    e.preventDefault();
    videoCtxMenuPrevFocus = document.activeElement;
    videoCtxMenu.style.display = 'block';
    videoCtxMenu.style.left = Math.min(e.clientX, window.innerWidth - videoCtxMenu.offsetWidth - 8) + 'px';
    videoCtxMenu.style.top = Math.min(e.clientY, window.innerHeight - videoCtxMenu.offsetHeight - 8) + 'px';
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
    if (e.key === 'Escape') { e.preventDefault(); closeVideoCtxMenu(); if (videoCtxMenuPrevFocus) videoCtxMenuPrevFocus.focus(); }
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
    { name: 'Set Loop Point A', run: () => setPointABtn.click() },
    { name: 'Set Loop Point B', run: () => setPointBBtn.click() },
    { name: 'Clear A-B Loop', run: () => clearAbLoopBtn.click() },
    { name: 'Jump to Current Track', run: () => {
      if (currentPlaylistIndex < 0) return;
      if (!playlistSidebar.classList.contains('open')) togglePlaylistSidebar();
      const el = document.querySelector('.playlist-item.playing');
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
    } },
    { name: 'Set as Default Media Player', run: () => ipcRenderer.send('open-default-apps') }
  );

  // ---- Drag and drop with visual feedback ----
  const dragOverlay = document.getElementById('drag-overlay');
  const PLAYLIST_EXTS = ['m3u', 'm3u8', 'amp'];
  const DROP_EXTS = ['mp4','m4v','mkv','mov','webm','ogv','3gp','mp3','wav','ogg','oga','opus','weba','flac','aac','m4a', ...CONVERT_EXTS];
  const isFileDrag = (e) => e.dataTransfer && e.dataTransfer.types.includes('Files');
  // dragenter/leave also fire for every child element, so count the depth
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => { if (isFileDrag(e)) { dragDepth++; dragOverlay.classList.add('drag-active'); } });
  document.addEventListener('dragleave', (e) => { if (isFileDrag(e) && --dragDepth <= 0) { dragDepth = 0; dragOverlay.classList.remove('drag-active'); } });
  document.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    dragOverlay.classList.remove('drag-active');
    if (!isFileDrag(e)) return;
    // File.path was removed in current Electron; webUtils is the replacement
    const dropped = Array.from(e.dataTransfer.files).map(f => webUtils.getPathForFile(f)).filter(Boolean);
    const paths = await ipcRenderer.invoke('expand-dropped', dropped); // folders become the media inside them
    const extOf = (p) => p.split('.').pop().toLowerCase();
    const media = paths.filter(p => DROP_EXTS.includes(extOf(p)));
    for (const p of paths.filter(x => PLAYLIST_EXTS.includes(extOf(x)))) {
      const list = await ipcRenderer.invoke('read-playlist-file', p);
      if (Array.isArray(list)) media.push(...list);
    }
    if (media.length === 0) { announce('No supported files found'); return; }
    addFilesAndPlay(media);
    hideHome();
  });

  /* ====================================================================
     FEATURE PACK 3: Debug Console, Shortcuts Customizer, Visual EQ,
     Lyrics, Themes, Accessibility, Normalization Presets
     ==================================================================== */

  /* ------------------------------------------------- KEYBOARD SHORTCUT CUSTOMIZER -- */
  function changeVolumeBy(step) {
    const vol = Math.max(0, Math.min(100, Math.round(mediaPlayer.volume * 100) + step)); // the slider reads 0 while muted
    volumeSlider.value = vol;
    volumeSlider.dispatchEvent(new Event('input'));
    showOSD(`Volume ${vol}%`);
  }
  function changeSpeedBy(step) {
    setPlaybackRate(mediaPlayer.playbackRate + step);
    showOSD(`Speed ${formatRate(mediaPlayer.playbackRate)}x`);
    announce(`Speed ${formatRate(mediaPlayer.playbackRate)} times`);
  }

  function jumpToBookmarkNumber(n) {
    const bms = getBookmarks();
    if (bms.length < n) return announce(`No bookmark ${n}`);
    mediaPlayer.currentTime = bms[n - 1].time;
    announce(`Jumped to bookmark ${n}: ${formatTime(bms[n - 1].time)}`);
  }
  // The one list of shortcuts: it drives the keys, the help screen and the customizer.
  // "hold" marks the actions that should repeat while the key is held down.
  const SHORTCUT_TABLE = [
    ['Play / Pause', 'Ctrl+Space', () => togglePlay()],
    ['Seek Back 10 Seconds', 'Ctrl+ArrowLeft', () => rewindBtn.click(), 'hold'],
    ['Seek Forward 10 Seconds', 'Ctrl+ArrowRight', () => forwardBtn.click(), 'hold'],
    ['Volume Up', 'Ctrl+ArrowUp', () => changeVolumeBy(5), 'hold'],
    ['Volume Down', 'Ctrl+ArrowDown', () => changeVolumeBy(-5), 'hold'],
    ['Speed Up', 'Ctrl+Shift+ArrowUp', () => changeSpeedBy(0.1), 'hold'],
    ['Speed Down', 'Ctrl+Shift+ArrowDown', () => changeSpeedBy(-0.1), 'hold'],
    ['Speed Up (alternate)', 'Ctrl+=', () => changeSpeedBy(0.1), 'hold'],
    ['Speed Down (alternate)', 'Ctrl+-', () => changeSpeedBy(-0.1), 'hold'],
    ['Start Over', 'Ctrl+0', () => { if (hasMedia()) { mediaPlayer.currentTime = 0; announce('Back to the start'); } }],
    ['Next Chapter', 'Ctrl+Shift+ArrowRight', () => { const i = chapterIndexNow(); goToChapter(i + 1); }],
    ['Previous Chapter', 'Ctrl+Shift+ArrowLeft', () => { const i = chapterIndexNow(); goToChapter(i - 1); }],
    ['Speech Boost', 'Ctrl+Shift+S', () => toggleSpeechBoost()],
    ['Next Track', 'Ctrl+N', () => playNext()],
    ['Previous Track', 'Ctrl+Shift+N', () => playPrev()],
    ['Mute', 'Ctrl+M', () => muteBtn.click()],
    ['Repeat', 'Ctrl+L', () => loopBtn.click()],
    ['Fullscreen', 'Ctrl+F', () => toggleFullscreen()],
    ['Picture-in-Picture', 'Ctrl+P', () => pipBtn.click()],
    ['Say Current Time', 'Ctrl+A', () => sayTime()],
    ['Say What Is Playing', 'Ctrl+W', () => sayNowPlaying()],
    ['Cycle Sound Mode', 'Ctrl+D', () => cycleAudioEffect()],
    ['Toggle Playlist', 'Ctrl+Q', () => togglePlaylistSidebar()],
    ['Toggle Bookmarks', 'Ctrl+B', () => toggleBookmarksSidebar()],
    ['Add Bookmark', 'Ctrl+Shift+B', () => addBookmarkAtCurrentTime()],
    ['Toggle More Options', 'Ctrl+Shift+O', () => toggleMoreOptionsSidebar()],
    ['Settings', 'Ctrl+E', () => toggleSettingsModal()],
    ['Screenshot', 'Ctrl+S', () => triggerScreenshot()],
    ['Subtitles On / Off', 'Ctrl+C', () => toggleSubtitles()],
    ['Subtitles Earlier', 'Ctrl+[', () => updateSubtitleDelay(-0.5), 'hold'],
    ['Subtitles Later', 'Ctrl+]', () => updateSubtitleDelay(0.5), 'hold'],
    ['Always on Top', 'Ctrl+T', () => { alwaysOnTop = !alwaysOnTop; ipcRenderer.send('set-always-on-top', alwaysOnTop); announce('Always on top ' + (alwaysOnTop ? 'on' : 'off')); }],
    ['Media Information', 'Ctrl+I', () => openMediaInfo()],
    ['Undo Remove', 'Ctrl+Z', () => undoRemove()],
    ['Home', 'Ctrl+H', () => showHome()],
    ['Open Files', 'Ctrl+O', () => openFilesHandler()],
    ['Open URL', 'Ctrl+U', () => openUrlPrompt()],
    ['Go to Time', 'Ctrl+G', () => openGotoModal()],
    ['Command Palette', 'Ctrl+Shift+P', () => openPalette()],
    ['Help', 'Ctrl+/', () => openHelp()]
  ];
  for (let n = 1; n <= 9; n++) SHORTCUT_TABLE.push([`Jump to Bookmark ${n}`, `Ctrl+${n}`, () => jumpToBookmarkNumber(n)]);
  const DEFAULT_SHORTCUTS = Object.fromEntries(SHORTCUT_TABLE.map(([name, keys]) => [name, keys]));
  let _customShortcuts = loadState('customShortcuts', {});
  delete _customShortcuts['Debug Console']; // action no longer exists
  function getShortcut(action) { return _customShortcuts[action] || DEFAULT_SHORTCUTS[action] || ''; }
  function saveShortcut(action, key) { _customShortcuts[action] = key; saveState('customShortcuts', _customShortcuts); }
  let recordingShortcut = false;
  function shortcutFromEvent(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey && e.key.length > 1 || e.shiftKey && /[a-z]/i.test(e.key)) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) parts.push(key);
    return parts.join('+');
  }
  // Runs last, so anything that already used the key (the queue, a menu, the seek bar) wins
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || recordingShortcut || globalKeysBlocked()) return;
    if (e.key === 'F1') { e.preventDefault(); openHelp(); return; }
    const combo = shortcutFromEvent(e);
    const entry = SHORTCUT_TABLE.find(([name]) => getShortcut(name) === combo);
    if (!entry) return;
    e.preventDefault();
    if (e.repeat && entry[3] !== 'hold') return; // holding Ctrl+M must not flicker mute on and off
    entry[2]();
  });
  const shortcutLabel = (keys) => keys.replace('ArrowLeft', 'Left').replace('ArrowRight', 'Right').replace('ArrowUp', 'Up').replace('ArrowDown', 'Down');
  function renderHelpList() {
    helpList.innerHTML = '';
    const rows = [...SHORTCUT_TABLE.map(([name]) => [shortcutLabel(getShortcut(name)), name]), ...FOCUS_KEYS];
    rows.forEach(([k, d]) => helpList.appendChild(ce('li', { style: 'display:flex;gap:10px;font-size:0.85rem;' }, [
      ce('kbd', { style: 'background:#333;padding:2px 8px;border-radius:4px;min-width:60px;text-align:center;', text: k }),
      ce('span', { text: d })
    ])));
  }
  const _openHelpList = openHelp;
  openHelp = function () { renderHelpList(); _openHelpList(); };

  const scPanel = ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:6px;border:1px solid #333;margin-top:10px;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Customize Shortcuts' }),
      ce('p', { style: 'font-size:0.8rem;color:#aaa;margin:0;', text: 'Activate a shortcut, then press the new key(s). Escape cancels.' }),
    ce('div', { id: 'shortcut-list', style: 'display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;' }),
    ce('button', { class: 'action-btn-small', text: 'Reset All Shortcuts', onclick: () => { _customShortcuts = {}; saveState('customShortcuts', {}); renderShortcuts(); announce('Shortcuts reset to defaults'); } })
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
        recordingShortcut = true;
        announce(`Press the new shortcut for ${action}`);
        keyBtn.textContent = '…';
        keyBtn.style.background = 'var(--focus-color)';
        keyBtn.style.color = '#000';
        const handler = (e) => {
          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; // wait for the real key
          e.preventDefault();
          e.stopPropagation();
          const stopListening = () => {
            keyBtn.style.background = '';
            keyBtn.style.color = '';
            listening = false;
            recordingShortcut = false;
            document.removeEventListener('keydown', handler, true);
          };
          const shortcut = shortcutFromEvent(e);
          const usedBy = Object.keys(DEFAULT_SHORTCUTS).find(a => a !== action && getShortcut(a) === shortcut);
          if (e.key === 'Escape' || e.key === 'Tab') {
            keyBtn.textContent = getShortcut(action) || '—';
            announce('Shortcut unchanged');
          } else if (usedBy) {
            keyBtn.textContent = getShortcut(action) || '—';
            announce(`${shortcut} is already used by ${usedBy}. Shortcut unchanged.`, true);
          } else {
            saveShortcut(action, shortcut);
            keyBtn.textContent = shortcut;
            keyBtn.setAttribute('aria-label', `Shortcut for ${action}: ${shortcut}. Click to change.`);
            announce(`Shortcut for ${action}: ${shortcut}`);
          }
          stopListening();
        };
        document.addEventListener('keydown', handler, true);
        // Generous timeout: screen-reader users need time to hear the prompt
        setTimeout(() => { if (listening) { listening = false; recordingShortcut = false; keyBtn.textContent = getShortcut(action) || '—'; keyBtn.style.background = ''; keyBtn.style.color = ''; document.removeEventListener('keydown', handler, true); announce('Shortcut unchanged'); } }, 15000);
      });
      row.appendChild(keyBtn);
      list.appendChild(row);
    });
  }
  renderShortcuts();

  /* ------------------------------------------------- LYRICS PANEL -- */
  let _lyricsCues = [];
  let _lyricsActiveIdx = -1;
  const lyricsToggle = document.getElementById('lyrics-toggle');
  const lyricsDisplay = document.getElementById('lyrics-display');
  const lyricsList = ce('ul', { id: 'lyrics-list', 'aria-label': 'Synchronized lyrics', style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:0.9rem;' });
  lyricsDisplay.appendChild(lyricsList);
  lyricsDisplay.parentElement.insertBefore(ce('button', { class: 'action-btn-small', text: 'Load .lrc File', 'aria-label': 'Load lyrics from LRC file', onclick: loadLyrics }), lyricsDisplay);
  function showLyricsPanel(on) {
    lyricsToggle.checked = on;
    lyricsDisplay.style.display = on ? 'block' : 'none';
  }
  lyricsToggle.addEventListener('change', () => { showLyricsPanel(lyricsToggle.checked); announce(`Lyrics ${lyricsToggle.checked ? 'shown' : 'hidden'}`); });
  function clearLyrics() { _lyricsCues = []; _lyricsActiveIdx = -1; renderLyrics(); }
  function loadLyrics() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        parseLRC(decodeText(ev.target.result));
        showLyricsPanel(true);
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }
  function parseLRC(text, silent) {
    _lyricsCues = [];
    _lyricsActiveIdx = -1;
    // A line can carry several timestamps when a chorus repeats
    const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    text.split(/\r?\n/).forEach(line => {
      const words = line.replace(stamp, '').trim();
      if (!words) return;
      for (const m of line.matchAll(stamp)) {
        const fraction = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0;
        _lyricsCues.push({ time: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + fraction, text: words });
      }
    });
    _lyricsCues.sort((a, b) => a.time - b.time);
    renderLyrics();
    if (!silent) announce(`Loaded ${_lyricsCues.length} lyrics lines`);
  }
  function renderLyrics() {
    lyricsList.innerHTML = '';
    if (!_lyricsCues.length) { lyricsList.appendChild(ce('li', { style: 'color:#888;padding:8px;font-size:0.85rem;', text: 'No lyrics loaded. A .lrc file with the same name as the track loads automatically.' })); return; }
    _lyricsCues.forEach((c) => {
      const jump = () => { mediaPlayer.currentTime = c.time; announce(`Jumped to ${formatTime(c.time)}`); };
      const li = ce('li', { class: 'lyrics-line', tabindex: '0', role: 'button', 'aria-label': `${c.text}, at ${formatTime(c.time)}`, text: c.text, onclick: jump });
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      lyricsList.appendChild(li);
    });
  }
  renderLyrics();
  // Only move the highlight: rebuilding the list would knock keyboard focus out of it
  mediaPlayer.addEventListener('timeupdate', () => {
    if (!_lyricsCues.length) return;
    let newIdx = -1;
    for (let i = _lyricsCues.length - 1; i >= 0; i--) {
      if (mediaPlayer.currentTime >= _lyricsCues[i].time) { newIdx = i; break; }
    }
    if (newIdx === _lyricsActiveIdx) return;
    const items = lyricsList.children;
    if (items[_lyricsActiveIdx]) items[_lyricsActiveIdx].classList.remove('current');
    _lyricsActiveIdx = newIdx;
    const line = items[newIdx];
    if (line) {
      line.classList.add('current');
      lyricsDisplay.scrollTop = line.offsetTop - lyricsDisplay.clientHeight / 2;
    }
  });

  /* ------------------------------------------------- ACCESSIBILITY IMPROVEMENTS -- */
  // Ensure the skip link works and add a second skip to playlist
  const skipToPlaylist = ce('a', { href: '#playlist-sidebar', class: 'sr-only skip-link', text: 'Skip to playlist',
    onclick: (e) => { e.preventDefault(); if (!playlistSidebar.classList.contains('open')) togglePlaylistSidebar(); } });
  document.getElementById('app-container').insertBefore(skipToPlaylist, document.getElementById('app-container').firstChild.nextSibling);

  // Add aria-labels to all sidebar toggles and major controls that lack them
  document.querySelectorAll('.sidebar-toggle').forEach(el => { if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title || el.textContent.trim() || 'Toggle sidebar'); });


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


  const normalizerToggle = document.getElementById('normalizer-toggle');
  const normalizerButtons = { light: 'normalizer-preset-soft', medium: 'normalizer-preset-medium', strong: 'normalizer-preset-hard' };
  function syncNormalizerUI() {
    const val = normPresetSelect.value;
    normalizationOn = val !== 'off';
    normalizerToggle.checked = normalizationOn;
    Object.keys(normalizerButtons).forEach(p => document.getElementById(normalizerButtons[p]).setAttribute('aria-pressed', p === val ? 'true' : 'false'));

    saveState('normPreset', val);
  }
  normalizerToggle.addEventListener('change', () => {
    normPresetSelect.value = normalizerToggle.checked ? (loadState('normPresetLast', 'medium')) : 'off';
    normPresetSelect.dispatchEvent(new Event('change'));
  });
  Object.keys(normalizerButtons).forEach(p => document.getElementById(normalizerButtons[p]).addEventListener('click', () => {
    normPresetSelect.value = p;
    normPresetSelect.dispatchEvent(new Event('change'));
  }));
  normPresetSelect.addEventListener('change', () => {
    const val = normPresetSelect.value;
    initAudio();
    if (!normalizationNode) { announce('Audio is not available'); return; }
    if (val !== 'off') saveState('normPresetLast', val);
    syncNormalizerUI();
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
      initAudio();
      _origSetNorm(on);
      if (on && normPresetSelect.value === 'off') { normPresetSelect.value = loadState('normPresetLast', 'medium'); normPresetSelect.dispatchEvent(new Event('change')); }
      if (!on) { normPresetSelect.value = 'off'; syncNormalizerUI(); }
    };
  }

  /* ====================================================================
     FEATURE PACK 4: Search, Keys, Time Toggle, Frame Advance, Sort, Boost, Media Session
     ==================================================================== */

  /* ------------------------------------------------- REMAINING TIME TOGGLE -- */

  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    timeDisplay.style.cursor = 'pointer';
    timeDisplay.setAttribute('role', 'button');
    timeDisplay.setAttribute('tabindex', '0');
    timeDisplay.setAttribute('aria-label', 'Click to toggle elapsed/remaining time');
    timeDisplay.addEventListener('click', () => {
      showRemainingTime = !showRemainingTime;
      updateProgressUI(false);
      timeDisplay.setAttribute('aria-label', `Showing ${showRemainingTime ? 'remaining' : 'elapsed'} time. Click to toggle.`);
      announce(`${showRemainingTime ? 'Remaining' : 'Elapsed'} time`);
    });
    timeDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); timeDisplay.click(); } });
  }

  /* ------------------------------------------------- PLAYLIST SORT -- */
  const sortWrap = ce('div', { style: 'display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid #333;' });
  const sortNameBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by name', text: 'Name', onclick: () => { sortPlaylist('name'); } });
  const sortDateBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by date modified, newest first', text: 'Date', onclick: () => { sortPlaylist('date'); } });
  const sortDurBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Sort by duration', text: 'Duration', onclick: () => { sortPlaylist('duration'); } });
  const sortRevBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Reverse order', text: 'Reverse', onclick: () => { sortPlaylist('reverse'); } });
  sortWrap.append(sortNameBtn, sortDateBtn, sortDurBtn, sortRevBtn);
  // Add sort buttons BELOW the search box, above playlist-items
  const playlistItemsEl = document.getElementById('playlist-items');
  if (playlistItemsEl && playlistItemsEl.parentElement) {
    playlistItemsEl.parentElement.insertBefore(sortWrap, playlistItemsEl);
  }
  async function sortPlaylist(mode) {
    if (!playlist.length) return;
    const currentFile = currentPlaylistIndex >= 0 ? playlist[currentPlaylistIndex] : null;
    if (mode === 'name') {
      playlist.sort((a, b) => getFileName(a).localeCompare(getFileName(b), undefined, { numeric: true, sensitivity: 'base' })); // "2" before "10"
    } else if (mode === 'date') {
      const times = await ipcRenderer.invoke('file-mtimes', playlist.filter(p => !isUrl(p)));
      playlist.sort((a, b) => (times[b] || 0) - (times[a] || 0));
    } else if (mode === 'reverse') {
      playlist.reverse();
    } else if (mode === 'duration') {
      // Known once a track has been played; unknown lengths go last
      const durs = loadState('durations', {});
      const len = (p) => { const d = durs[normalizePath(p)]; return typeof d === 'number' ? d : Infinity; };
      playlist.sort((a, b) => len(a) - len(b));
    }
    if (currentFile) currentPlaylistIndex = playlist.indexOf(currentFile);
    renderPlaylist();
    announce(`Playlist sorted by ${mode}`);
  }

  /* ------------------------------------------------- MEDIA SESSION API -- */
  if ('mediaSession' in navigator) {
    const updateMediaSession = () => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: getFileName(currentFilePath || ''),
        artist: 'Accessible Media Player',
        album: 'Accessible Media Player'
      });
    };
    mediaPlayer.addEventListener('loadedmetadata', updateMediaSession);
    mediaPlayer.addEventListener('play', () => { navigator.mediaSession.playbackState = 'playing'; });
    mediaPlayer.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });
    navigator.mediaSession.setActionHandler('play', () => { if (mediaPlayer.paused) togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => mediaPlayer.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => { if (typeof playPrev === 'function') playPrev(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { if (typeof playNext === 'function') playNext(); });
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
    const updatePosition = () => {
      if (isFinite(mediaPlayer.duration) && mediaPlayer.duration > 0) {
        navigator.mediaSession.setPositionState({ duration: mediaPlayer.duration, playbackRate: mediaPlayer.playbackRate, position: Math.min(mediaPlayer.currentTime, mediaPlayer.duration) });
      }
    };
    ['loadedmetadata', 'seeked', 'ratechange', 'play', 'pause'].forEach(ev => mediaPlayer.addEventListener(ev, updatePosition));
    navigator.mediaSession.setActionHandler('seekto', (details) => { if (details.seekTime != null) mediaPlayer.currentTime = details.seekTime; });
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

    { name: 'Sort Playlist A-Z', run: () => sortPlaylist('name') },
    { name: 'Reverse Playlist', run: () => sortPlaylist('reverse') },

    { name: 'Export Playlist M3U', run: exportPlaylistM3U },
    { name: 'Clear Playlist', run: () => clearPlaylistBtn.click() },

  );

  /* ==================================================================
     FEATURE PACK 5: Filter Presets, Export, Reset, Volume Presets,
     Stats, Background, Screenshot, Playlist Tools
     ================================================================== */

  /* ------------------------------------------------- EXPORT PLAYLIST TO M3U -- */
  function exportPlaylistM3U() {
    if (!playlist.length) { announce('Playlist empty'); return; }
    ipcRenderer.invoke('save-m3u', playlist).then(ok => announce(ok ? `Exported ${playlist.length} tracks as M3U` : 'Export cancelled'));
  }

  const genSettings2 = document.getElementById('general-settings');

  /* ==================================================================
     FEATURE PACK 6: Aspect Ratio, Balance, Wheel Volume, Sub Offset,
     Startup Volume, Import Folder, Recent Manager, Bookmark Search,
     Snapshot Gallery, Audio-Only Mode, Save/Load Playlist, Theater
     ================================================================== */

  /* ------------------------------------------------- STARTUP VOLUME -- */
  const startupVolSlider = ce('input', { type: 'range', id: 'startup-vol', min: '0', max: '100', value: String(loadState('startupVolume', 100)), 'aria-label': 'Startup volume', style: 'width:100%;' });
  const startupVolVal = ce('span', { style: 'font-size:0.8rem;color:#aaa;', text: `${loadState('startupVolume', 100)}%` });
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
  startupVolWrap.appendChild(ce('button', { class: 'action-btn-small', text: 'Start at Last Used Volume', onclick: () => {
    localStorage.removeItem('startupVolume');
    startupVolVal.textContent = 'Last used';
    announce('Will start at the last used volume');
  } }));
  if (loadState('startupVolume', null) === null) startupVolVal.textContent = 'Last used';
  if (genSettings2) genSettings2.appendChild(startupVolWrap);
  // Apply saved startup volume on boot
  (function applyStartupVol() {
    // A fixed startup volume wins; otherwise carry on at the last volume used
    const sv = loadState('startupVolume', null);
    const last = loadState('lastVolume', null);
    if (sv !== null && sv >= 0 && sv <= 100) mediaPlayer.volume = sv / 100;
    else if (typeof last === 'number' && last >= 0 && last <= 1) mediaPlayer.volume = last;
    updateVolumeUI();
  })();

  /* ------------------------------------------------- AUTOPLAY TOGGLE -- */
  const autoplayWrap = ce('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#ccc;margin-top:8px;padding:8px;background:#252525;border-radius:6px;border:1px solid #333;' }, [
    ce('input', { type: 'checkbox', id: 'autoplay-on-load-toggle', checked: loadState('autoplay', true) ? 'checked' : undefined }),
    ce('span', { text: 'Auto-play on file load' })
  ]);
  if (genSettings2) genSettings2.appendChild(autoplayWrap);
  autoplayWrap.querySelector('input').addEventListener('change', (e) => {
    saveState('autoplay', e.target.checked);
    announce(e.target.checked ? 'Auto-play enabled' : 'Auto-play disabled');
  });

  /* ------------------------------------------------- BOOKMARK SEARCH -- */
  const bmSearch = ce('input', { type: 'text', id: 'bm-search', placeholder: 'Filter bookmarks…', 'aria-label': 'Filter bookmarks', style: 'width:100%;padding:6px;margin:4px 0;background:#222;color:#fff;border:1px solid #333;border-radius:4px;box-sizing:border-box;font-size:0.8rem;' });
  sidebarAddBookmarkBtn.parentElement.insertBefore(bmSearch, sidebarAddBookmarkBtn.nextSibling);
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

  /* ------------------------------------------------- AUDIO-ONLY MODE -- */
  const audioOnlyBtn = ce('button', { class: 'action-btn-small', 'aria-label': 'Toggle audio-only mode', 'aria-pressed': String(_audioOnly), text: _audioOnly ? 'Audio Only: On' : 'Audio Only: Off', style: _audioOnly ? 'color:var(--focus-color);' : '', onclick: () => {
    _audioOnly = !_audioOnly;
    audioOnlyBtn.textContent = _audioOnly ? 'Audio Only: On' : 'Audio Only: Off';
    audioOnlyBtn.setAttribute('aria-pressed', String(_audioOnly));
    audioOnlyBtn.style.color = _audioOnly ? 'var(--focus-color)' : '';
    saveState('audioOnly', _audioOnly);
    applyAudioOnly();
    announce(`Audio-only mode ${_audioOnly ? 'on' : 'off'}`);
  } });
  mediaPlayer.addEventListener('loadedmetadata', applyAudioOnly);


  /* ------------------------------------------------- DRAG URL TO PLAY -- */
  document.addEventListener('drop', (e) => {
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      e.preventDefault();
      playPath(url.trim());
      hideHome();
    }
  });

  /* ------------------------------------------------- QUICK COMMANDS -- */
  COMMANDS.push(
    { name: 'Toggle Audio-Only Mode', run: () => audioOnlyBtn.click() },
    { name: 'Reset Subtitle Delay', run: () => subDelayReset.click() },
    { name: 'Reset Balance', run: () => { panSlider.value = '0'; panSlider.dispatchEvent(new Event('input')); announce('Balance reset'); } },

  );

  /* ------------------------------------------------- SURROUND & 8D AUDIO -- */
  const SOUND_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'surround', label: 'Virtual Surround' },
    { id: '8d', label: '8D (sound circles your head)' },
    { id: 'wide', label: 'Wide Stereo' },
    { id: 'hall', label: 'Concert Hall' },
    { id: 'crossfeed', label: 'Headphone Comfort' }
  ];
  const soundSelect = ce('select', { id: 'surround-mode', 'aria-label': 'Sound mode', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' },
    SOUND_MODES.map(m => ce('option', { value: m.id, text: m.label })));
  const soundAmount = ce('input', { type: 'range', id: 'surround-amount', min: '0', max: '100', value: '50', 'aria-label': 'Effect strength', 'aria-valuetext': '50 percent', style: 'flex:1;' });
  const soundSpeed = ce('input', { type: 'range', id: 'surround-speed', min: '3', max: '60', value: '15', 'aria-label': '8D rotation speed', style: 'flex:1;' });
  const soundSpeedRow = ce('div', { style: 'display:none;gap:8px;align-items:center;' }, [ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Rotation speed:' }), soundSpeed]);
  moScroll.appendChild(ce('div', { style: 'background:#252525;padding:12px;border-radius:6px;display:flex;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Surround & 8D Sound' }),
    ce('p', { style: 'margin:0;font-size:0.8rem;color:#bbb;', text: 'Best on headphones. Press Ctrl+D to switch modes.' }),
    soundSelect,
    ce('div', { style: 'display:flex;gap:8px;align-items:center;' }, [ce('span', { style: 'font-size:0.85rem;color:#ccc;', text: 'Strength:' }), soundAmount]),
    soundSpeedRow
  ]));

  let effectNodes = [], effectOscillators = [], effectSpeedParams = [];
  function buildAudioEffect() {
    effectOscillators.forEach(o => { try { o.stop(); } catch (e) {} });
    effectNodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
    effectNodes = []; effectOscillators = []; effectSpeedParams = [];
    effectInput.disconnect();

    const ctx = audioCtx, amount = parseFloat(soundAmount.value) / 100;
    const keep = (n) => { effectNodes.push(n); return n; };
    const gain = (v) => { const g = keep(ctx.createGain()); g.gain.value = v; return g; };
    const output = gain(1);
    output.connect(effectOutput);
    const impulse = (seconds, decay) => {
      const length = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
      return buffer;
    };
    const reverb = (seconds, decay, wet) => {
      const c = keep(ctx.createConvolver()); c.buffer = impulse(seconds, decay);
      const level = gain(wet); c.connect(level); level.connect(output);
      return c;
    };
    const hrtf = (x, z) => { // a point in space around the listener, at unit distance so level stays even
      const p = keep(ctx.createPanner());
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 1;
      p.positionX.value = x; p.positionY.value = 0; p.positionZ.value = z;
      return p;
    };
    const speaker = (degrees) => hrtf(Math.sin(degrees * Math.PI / 180), -Math.cos(degrees * Math.PI / 180));
    const split = () => { const s = keep(ctx.createChannelSplitter(2)); effectInput.connect(s); return s; };

    switch (soundSelect.value) {
      case 'surround': {
        // Stereo fed to virtual front speakers, with a delayed, softened copy from behind
        output.gain.value = 0.8;
        const s = split();
        const place = (channel, frontAngle, rearAngle) => {
          const front = speaker(frontAngle); s.connect(front, channel); front.connect(output);
          const delay = keep(ctx.createDelay(0.1)); delay.delayTime.value = 0.018;
          const soften = keep(ctx.createBiquadFilter()); soften.type = 'lowpass'; soften.frequency.value = 6000;
          const level = gain(0.25 + amount * 0.55);
          const rear = speaker(rearAngle);
          s.connect(delay, channel); delay.connect(soften); soften.connect(level); level.connect(rear); rear.connect(output);
        };
        place(0, -30, -110);
        place(1, 30, 110);
        effectInput.connect(reverb(0.5, 3, 0.1 + amount * 0.2));
        break;
      }
      case '8d': {
        // The whole mix travels in a circle: one oscillator drives left-right, a matching one front-back
        output.gain.value = 0.9;
        const orbit = hrtf(0, 0);
        const rate = parseFloat(soundSpeed.value) / 100;
        const cosine = ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true });
        const x = ctx.createOscillator(), z = ctx.createOscillator();
        x.type = 'sine'; z.setPeriodicWave(cosine);
        x.frequency.value = rate; z.frequency.value = rate;
        const startAt = ctx.currentTime + 0.02;
        x.connect(orbit.positionX); z.connect(orbit.positionZ);
        x.start(startAt); z.start(startAt);
        keep(x); keep(z);
        effectOscillators = [x, z];
        effectSpeedParams = [x.frequency, z.frequency];
        effectInput.connect(orbit); orbit.connect(output);
        orbit.connect(reverb(1.4, 2.5, 0.1 + amount * 0.3));
        const dry = gain(0.2 * (1 - amount)); effectInput.connect(dry); dry.connect(output);
        break;
      }
      case 'wide': {
        // More of the difference between the channels spreads the image without moving the centre
        const width = 1 + amount * 2, same = (1 + width) / 2, cross = (1 - width) / 2;
        output.gain.value = 1 / same;
        const s = split(), m = keep(ctx.createChannelMerger(2));
        [[0, 0, same], [1, 1, same], [1, 0, cross], [0, 1, cross]].forEach(([from, to, level]) => { const g = gain(level); s.connect(g, from); g.connect(m, 0, to); });
        m.connect(output);
        break;
      }
      case 'hall': {
        output.gain.value = 0.8;
        const dry = gain(1); effectInput.connect(dry); dry.connect(output);
        effectInput.connect(reverb(2.6, 3, 0.15 + amount * 0.5));
        break;
      }
      case 'crossfeed': {
        // Each ear hears a little of the other side, as with speakers, which eases long listening
        output.gain.value = 0.8;
        const s = split(), m = keep(ctx.createChannelMerger(2));
        [[0, 0], [1, 1]].forEach(([from, to]) => { const g = gain(1); s.connect(g, from); g.connect(m, 0, to); });
        [[0, 1], [1, 0]].forEach(([from, to]) => {
          const d = keep(ctx.createDelay(0.01)); d.delayTime.value = 0.0003;
          const f = keep(ctx.createBiquadFilter()); f.type = 'lowpass'; f.frequency.value = 700;
          const g = gain(0.2 + amount * 0.4);
          s.connect(d, from); d.connect(f); f.connect(g); g.connect(m, 0, to);
        });
        m.connect(output);
        break;
      }
      default:
        effectInput.connect(effectOutput);
    }
  }
  function applySoundMode() {
    initAudio();
    if (effectInput) buildAudioEffect();
    soundSpeedRow.style.display = soundSelect.value === '8d' ? 'flex' : 'none';
    saveState('soundMode', soundSelect.value);
  }
  soundSelect.addEventListener('change', () => {
    applySoundMode();
    announce(`Sound mode: ${soundSelect.options[soundSelect.selectedIndex].text}`);
    showOSD(soundSelect.options[soundSelect.selectedIndex].text);
  });
  let soundAmountTimer = null;
  soundAmount.addEventListener('input', () => {
    soundAmount.setAttribute('aria-valuetext', `${soundAmount.value} percent`);
    clearTimeout(soundAmountTimer); // rebuilding reverb is too heavy to do on every slider tick
    soundAmountTimer = setTimeout(() => { if (soundSelect.value !== 'off') applySoundMode(); }, 150);
  });
  soundSpeed.addEventListener('input', () => {
    const rate = parseFloat(soundSpeed.value) / 100;
    soundSpeed.setAttribute('aria-valuetext', `${Math.round(1 / rate)} seconds per circle`);
    effectSpeedParams.forEach(p => { p.value = rate; });
  });
  function cycleAudioEffect() {
    soundSelect.selectedIndex = (soundSelect.selectedIndex + 1) % soundSelect.options.length;
    soundSelect.dispatchEvent(new Event('change'));
  }
  COMMANDS.push(...SOUND_MODES.map(m => ({ name: `Sound Mode: ${m.label}`, run: () => { soundSelect.value = m.id; soundSelect.dispatchEvent(new Event('change')); } })));
  eqResetBtn.addEventListener('click', () => { if (soundSelect.value !== 'off') { soundSelect.value = 'off'; applySoundMode(); } });

  /* ---- Keep keyboard users inside panels when they click on empty space ---- */
  // Without a focusable target the focus falls to the page, where Escape and Tab stop working
  document.querySelectorAll('[role="dialog"], #playlist-sidebar, #bookmarks-sidebar, #more-options-sidebar').forEach(el => {
    el.setAttribute('tabindex', '-1');
    el.style.outline = 'none';
  });
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList && e.target.classList.contains('modal')) {
      e.preventDefault();
      const dialog = e.target.querySelector('[role="dialog"]');
      if (dialog) dialog.focus();
    }
  });
  ipcRenderer.on('request-help', () => { if (!isModalOpen()) openHelp(); });
  shuffleToggle.addEventListener('change', () => { shuffleHistory.length = 0; });

  /* ------------------------------------------------- CHAPTERS -- */
  let currentChapters = [];
  const chapterSelect = ce('select', { id: 'chapter-select', 'aria-label': 'Chapter', style: 'background:#333;color:#fff;border:1px solid #444;padding:5px;border-radius:4px;font-size:0.85rem;' });
  const chapterCard = ce('div', { style: 'display:none;background:#252525;padding:12px;border-radius:6px;flex-direction:column;gap:8px;border:1px solid #333;' }, [
    ce('h3', { style: 'margin:0;font-size:1rem;color:var(--focus-color);', text: 'Chapters' }), chapterSelect
  ]);
  moScroll.appendChild(chapterCard);
  function clearChapters() { currentChapters = []; chapterSelect.innerHTML = ''; chapterCard.style.display = 'none'; }
  async function loadChapters(fp) {
    if (isUrl(fp)) return;
    const list = await ipcRenderer.invoke('read-chapters', fp).catch(() => []);
    if (currentFilePath !== fp || !list.length) return;
    currentChapters = list;
    list.forEach((c, i) => chapterSelect.appendChild(ce('option', { value: i, text: `${c.title} (${formatTime(c.time)})` })));
    chapterCard.style.display = 'flex';
    announce(`${list.length} chapters available`);
  }
  function chapterIndexNow() {
    let at = -1;
    currentChapters.forEach((c, i) => { if (mediaPlayer.currentTime >= c.time - 0.5) at = i; });
    return at;
  }
  function goToChapter(i) {
    const chapter = currentChapters[i];
    if (!chapter) return announce(currentChapters.length ? 'No more chapters' : 'This file has no chapters');
    mediaPlayer.currentTime = chapter.time;
    chapterSelect.value = i;
    announce(`Chapter ${i + 1}: ${chapter.title}`);
  }
  chapterSelect.addEventListener('change', () => goToChapter(parseInt(chapterSelect.value, 10)));
  mediaPlayer.addEventListener('timeupdate', () => {
    const i = chapterIndexNow();
    if (i >= 0 && document.activeElement !== chapterSelect) chapterSelect.value = i;
  });

  /* ------------------------------------------------- SOUND CUES -- */
  const addA11yCheckbox = (parent, id, label, checked) => {
    const row = ce('label', { class: 'toggle-label', style: 'display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:15px;' }, [
      ce('input', { type: 'checkbox', id, style: 'width:18px;height:18px;' }), ce('span', { text: label })
    ]);
    document.getElementById(parent).appendChild(row);
    const box = row.querySelector('input');
    box.checked = !!checked;
    return box;
  };
  const cuesCb = addA11yCheckbox('access-settings', 'sound-cues-toggle', 'Play short sound cues (play, pause, end of queue, errors)', true);
  // Frequency, start offset and length, in a separate context so effects never colour them
  const CUES = {
    play: [[520, 0, 0.07], [780, 0.07, 0.09]],
    pause: [[620, 0, 0.07], [420, 0.07, 0.09]],
    end: [[660, 0, 0.1], [520, 0.11, 0.1], [390, 0.22, 0.18]],
    error: [[220, 0, 0.14], [180, 0.16, 0.2]],
    bookmark: [[880, 0, 0.06], [1100, 0.07, 0.06]]
  };
  let cueContext = null;
  window.ampCue = function (name) {
    if (!cuesCb.checked || bootSilent) return;
    cueContext = cueContext || new (window.AudioContext || window.webkitAudioContext)();
    if (cueContext.state === 'suspended') cueContext.resume();
    const start = cueContext.currentTime + 0.01;
    CUES[name].forEach(([frequency, offset, length]) => {
      const osc = cueContext.createOscillator(), level = cueContext.createGain();
      osc.frequency.value = frequency;
      level.gain.setValueAtTime(0.0001, start + offset);
      level.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.012);
      level.gain.exponentialRampToValueAtTime(0.0001, start + offset + length);
      osc.connect(level); level.connect(cueContext.destination);
      osc.start(start + offset);
      osc.stop(start + offset + length + 0.02);
    });
  };
  mediaPlayer.addEventListener('play', () => window.ampCue('play'));
  mediaPlayer.addEventListener('pause', () => { if (!mediaPlayer.ended && !mediaPlayer.seeking) window.ampCue('pause'); });
  mediaPlayer.addEventListener('error', () => window.ampCue('error'));

  /* ------------------------------------------------- SPEECH TOOLS -- */
  const duckCb = addA11yCheckbox('access-settings', 'duck-toggle', 'Lower the media while the player announces something', false);
  const speechCb = addA11yCheckbox('access-settings', 'speech-boost-toggle', 'Speech boost: make voices clearer', false);
  let duckTimer = null;
  // The player cannot see when a screen reader finishes talking, so this estimates it from the length
  function duckForSpeech(text) {
    if (!duckCb.checked || !duckNode || mediaPlayer.paused) return;
    const g = duckNode.gain, now = audioCtx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.3, now, 0.03);
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      g.cancelScheduledValues(audioCtx.currentTime);
      g.setTargetAtTime(1, audioCtx.currentTime, 0.15);
    }, Math.min(5000, 700 + text.length * 70));
  }
  const _announceBeforeDuck = announce;
  announce = function (message, forceCritical) {
    if (!bootSilent) duckForSpeech(message);
    _announceBeforeDuck(message, forceCritical);
  };
  function applySpeechBoost() {
    initAudio();
    if (!speechHighpass) return;
    const on = speechCb.checked;
    speechHighpass.frequency.value = on ? 120 : 20;
    speechPresence.gain.value = on ? 3 : 0;
    speechClarity.gain.value = on ? 6 : 0;
  }
  speechCb.addEventListener('change', () => { applySpeechBoost(); announce(`Speech boost ${speechCb.checked ? 'on' : 'off'}`); });
  function toggleSpeechBoost() { speechCb.checked = !speechCb.checked; speechCb.dispatchEvent(new Event('change')); }
  COMMANDS.push({ name: 'Toggle Speech Boost', run: toggleSpeechBoost });

  /* ------------------------------------------------- SKIP SILENCE -- */
  const skipSilenceCb = addA11yCheckbox('general-settings', 'skip-silence-toggle', 'Skip silence (speeds through quiet gaps)', false);
  const SILENCE_LEVEL = 0.004, SILENCE_WAIT_MS = 400, SILENCE_RATE = 4;
  let quietMs = 0, rateBeforeSkip = 1, skipEndedAt = 0, lastSilenceCheck = performance.now();
  function silenceSkipIsActive() { return skippingSilence || performance.now() - skipEndedAt < 300; }
  function endSilenceSkip() {
    if (!skippingSilence) return;
    skippingSilence = false;
    skipEndedAt = performance.now();
    mediaPlayer.playbackRate = rateBeforeSkip;
  }
  setInterval(() => {
    const nowMs = performance.now(), elapsed = Math.min(1000, nowMs - lastSilenceCheck);
    lastSilenceCheck = nowMs;
    if (!skipSilenceCb.checked || !silenceAnalyser || mediaPlayer.paused || !hasMedia()) { endSilenceSkip(); quietMs = 0; return; }
    const samples = new Float32Array(silenceAnalyser.fftSize);
    silenceAnalyser.getFloatTimeDomainData(samples);
    const level = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
    if (level >= SILENCE_LEVEL) { quietMs = 0; endSilenceSkip(); return; }
    quietMs += elapsed;
    if (!skippingSilence && quietMs >= SILENCE_WAIT_MS) {
      rateBeforeSkip = mediaPlayer.playbackRate;
      skippingSilence = true;
      mediaPlayer.playbackRate = SILENCE_RATE;
    }
  }, 100);
  skipSilenceCb.addEventListener('change', () => announce(`Skip silence ${skipSilenceCb.checked ? 'on' : 'off'}`));
  COMMANDS.push({ name: 'Toggle Skip Silence', run: () => { skipSilenceCb.checked = !skipSilenceCb.checked; skipSilenceCb.dispatchEvent(new Event('change')); } });

  /* ---- Updates ---- */
  const updatesCb = addA11yCheckbox('general-settings', 'auto-update-toggle', 'Check for updates when the player starts', true);
  COMMANDS.push({ name: 'Check for Updates', run: () => ipcRenderer.send('check-updates', true) });
  setTimeout(() => { if (updatesCb.checked) ipcRenderer.send('check-updates', false); }, 20000);

  /* ------------------------------------------------- READ SUBTITLES ALOUD -- */
  // Sends each subtitle to the screen reader, for foreign-language and described content
  const addCheckbox = (parent, id, label) => {
    const row = ce('label', { class: 'toggle-label', style: 'display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:15px;' }, [
      ce('input', { type: 'checkbox', id, style: 'width:18px;height:18px;' }), ce('span', { text: label })
    ]);
    document.getElementById(parent).appendChild(row);
    return row.querySelector('input');
  };
  const readSubsCb = addCheckbox('access-settings', 'read-subs-toggle', 'Read subtitles with my screen reader');
  addCheckbox('general-settings', 'notify-toggle', 'Show a desktop notification when the track changes');
  let spokenTrack = null;
  function speakCues() {
    if (!readSubsCb.checked || !this.activeCues || !this.activeCues.length) return;
    const spoken = Array.from(this.activeCues).map(c => c.text.replace(/<[^>]+>/g, '')).join(' ');
    duckForSpeech(spoken);
    politeRegion.textContent = spoken;
  }
  document.addEventListener('subtitles-changed', () => {
    const track = currentSubtitleTrack && currentSubtitleTrack.track;
    if (!track || track === spokenTrack) return;
    if (spokenTrack) spokenTrack.removeEventListener('cuechange', speakCues);
    track.addEventListener('cuechange', speakCues);
    spokenTrack = track;
  });

  /* ---- More Options in a sensible order, instead of the order features were added ---- */
  const cardOrder = ['Quick Actions', 'Quick Toggles', 'Transcript', 'Lyrics', 'Subtitle Customization', 'Subtitle Sync', 'Audio Track', 'Equalizer', 'Chapters', 'Surround', 'Audio Normalizer', 'Crossfade', 'Smart Pause', 'Playback Speed', 'A-B Loop', 'Sleep Timer'];
  const cardRank = (card) => {
    const h = card.querySelector('h3');
    const i = h ? cardOrder.findIndex(n => h.textContent.startsWith(n)) : -1;
    return i === -1 ? cardOrder.length : i;
  };
  Array.from(moScroll.children).sort((a, b) => cardRank(a) - cardRank(b)).forEach(c => moScroll.appendChild(c));

  /* ------------------------------------------------- REMEMBER SETTINGS -- */
  // Accessibility preferences especially must survive a restart.
  function persistControl(id, key, eventName) {
    const el = document.getElementById(id);
    if (!el) return;
    const isCheck = el.type === 'checkbox';
    const saved = loadState(key, null);
    if (saved !== null && saved !== (isCheck ? el.checked : el.value)) {
      if (isCheck) el.checked = saved; else el.value = saved;
      el.dispatchEvent(new Event(eventName));
    }
    el.addEventListener(eventName, () => saveState(key, isCheck ? el.checked : el.value));
  }
  [
    ['high-contrast-toggle', 'change'], ['large-text-toggle', 'change'], ['verbose-announce-toggle', 'change'],
    ['autoplay-toggle', 'change'], ['shuffle-toggle', 'change'], ['read-subs-toggle', 'change'], ['notify-toggle', 'change'],
    ['crossfade-toggle', 'change'], ['gapless-toggle', 'change'], ['smart-pause-toggle', 'change'], ['lyrics-toggle', 'change'],
    ['sub-size-select', 'change'], ['sub-color-select', 'change'], ['sub-bg-select', 'change'], ['sub-font-select', 'change'],
    ['boost-slider', 'input'], ['pan-slider', 'input'],
    ['crossfade-duration', 'input'], ['surround-amount', 'input'], ['surround-speed', 'input'],
    ['sound-cues-toggle', 'change'], ['duck-toggle', 'change'], ['speech-boost-toggle', 'change'], ['skip-silence-toggle', 'change'], ['auto-update-toggle', 'change']
  ].forEach(([id, eventName]) => persistControl(id, 'setting:' + id, eventName));

  const eqSliders = Array.from(document.querySelectorAll('.eq-slider'));
  const savedBands = loadState('eqBands', null);
  if (Array.isArray(savedBands)) eqSliders.forEach((s, i) => { if (typeof savedBands[i] === 'number') { s.value = savedBands[i]; s.dispatchEvent(new Event('input')); } });
  eqSliders.forEach(s => s.addEventListener('input', () => saveState('eqBands', eqSliders.map(x => parseFloat(x.value)))));

  const _origSetRepeat = setRepeatMode;
  setRepeatMode = function (mode) { _origSetRepeat(mode); saveState('repeatMode', mode); };
  const savedRepeat = loadState('repeatMode', 'off');
  if (savedRepeat === 'one' || savedRepeat === 'all') setRepeatMode(savedRepeat);

  const savedSound = loadState('soundMode', 'off');
  if (savedSound !== 'off' && SOUND_MODES.some(m => m.id === savedSound)) { soundSelect.value = savedSound; applySoundMode(); }

  const savedNorm = loadState('normPreset', 'off');
  if (savedNorm !== 'off' && Array.from(normPresetSelect.options).some(o => o.value === savedNorm)) {
    normPresetSelect.value = savedNorm;
    normPresetSelect.dispatchEvent(new Event('change'));
  }

  // Quick Toggles reflect changes made elsewhere (keyboard, settings) when opened
  const _origToggleMore = toggleMoreOptionsSidebar;
  toggleMoreOptionsSidebar = function () {
    _origToggleMore();
    togglesPanel.querySelectorAll('button').forEach(b => { if (b._upd) b._upd(); });
  };
  moreOptionsToggleBtn.addEventListener('click', () => togglesPanel.querySelectorAll('button').forEach(b => { if (b._upd) b._upd(); }));

  bootSilent = false;
  console.log('[features.js] loaded');
})();
