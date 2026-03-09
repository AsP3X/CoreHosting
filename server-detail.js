/* ===== SERVER DETAIL — CHARTS & LIVE UPDATES ===== */
(function () {
  'use strict';

  /* ---------- CONFIG ---------- */
  const MAX_RAM     = 8;    // GB
  const MAX_STORAGE = 50;   // GB
  const MAX_PLAYERS = 64;

  /* Point counts per timeframe */
  const TF_POINTS = { '1h': 60, '6h': 72, '24h': 96, '7d': 84 };
  /* Update interval in ms */
  const UPDATE_INTERVAL = 3000;

  /* Chart color palette (line + fill alpha) */
  const CHART_COLORS = {
    cpu:     { stroke: '#00e87b', fill: 'rgba(0,232,123,0.12)' },
    ram:     { stroke: '#00b4d8', fill: 'rgba(0,180,216,0.12)' },
    storage: { stroke: '#a855f7', fill: 'rgba(168,85,247,0.12)' },
    players: { stroke: '#f97316', fill: 'rgba(249,115,22,0.12)' },
  };

  /* ---------- STATE ---------- */
  let currentTf = '6h';
  let series = { cpu: [], ram: [], storage: [], players: [] };
  let animFrames = {};   // active RAF handles per chart
  let tweens = {};       // in-progress tween state per chart
  let updateTimer = null;
  let uptimeSeconds = 3 * 86400 + 14 * 3600 + 22 * 60;

  /* ---------- DATA HELPERS ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function gaussRand() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function randomWalk(prev, target, min, max, sigma) {
    const drift = (target - prev) * 0.08;
    return clamp(prev + drift + gaussRand() * sigma, min, max);
  }

  function generateSeries(n, seedVal, min, max, sigma, target) {
    const arr = [seedVal];
    for (let i = 1; i < n; i++) {
      arr.push(randomWalk(arr[i - 1], target, min, max, sigma));
    }
    return arr;
  }

  function buildInitialSeries(tf) {
    const n = TF_POINTS[tf];
    series.cpu     = generateSeries(n, 42, 5, 95, 6, 45);
    series.ram     = generateSeries(n, 3.2, 0.5, MAX_RAM - 0.2, 0.3, 3.5);
    series.storage = generateSeries(n, 22, 18, MAX_STORAGE - 1, 0.05, 22);
    series.players = generateSeries(n, 10, 0, MAX_PLAYERS, 3, 18).map(Math.round);
  }

  function appendNewPoints() {
    ['cpu', 'ram', 'storage', 'players'].forEach(key => {
      const s = series[key];
      const last = s[s.length - 1];
      const n = TF_POINTS[currentTf];
      let next;
      if (key === 'cpu')     next = randomWalk(last, 45, 5, 95, 6);
      if (key === 'ram')     next = randomWalk(last, 3.5, 0.5, MAX_RAM - 0.2, 0.3);
      if (key === 'storage') next = randomWalk(last, 22, 18, MAX_STORAGE - 1, 0.05);
      if (key === 'players') next = Math.round(randomWalk(last, 18, 0, MAX_PLAYERS, 3));
      s.push(next);
      if (s.length > n) s.shift();
    });
  }

  /* ---------- CANVAS CHARTS ---------- */
  function getCanvas(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    if (el.width !== Math.round(rect.width * dpr) || !el._sized) {
      el.width  = Math.round(rect.width * dpr);
      el.height = Math.round(160 * dpr);
      el.style.height = '160px';
      el._sized = true;
    }
    return el;
  }

  /**
   * Draw a smooth area + line chart onto a canvas.
   * @param {string} canvasId
   * @param {number[]} data        - raw data array
   * @param {number[]} prevData    - previous data (for tween), null = no tween
   * @param {number}   t           - tween progress 0..1
   * @param {number}   minVal
   * @param {number}   maxVal
   * @param {object}   colors      - { stroke, fill }
   * @param {string}   labelFn     - function(v) -> label string
   */
  function drawChart(canvasId, data, prevData, t, minVal, maxVal, colors, labelFn) {
    const el = getCanvas(canvasId);
    if (!el) return;
    const ctx  = el.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;
    const W    = el.width;
    const H    = el.height;
    const PAD  = { top: 14 * dpr, right: 12 * dpr, bottom: 28 * dpr, left: 44 * dpr };
    const cW   = W - PAD.left - PAD.right;
    const cH   = H - PAD.top  - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    const tweened = data.map((v, i) => {
      if (!prevData) return v;
      const p = prevData[i] !== undefined ? prevData[i] : v;
      return p + (v - p) * t;
    });

    const n    = tweened.length;
    const step = cW / Math.max(n - 1, 1);

    function xOf(i) { return PAD.left + i * step; }
    function yOf(v) { return PAD.top + cH - ((v - minVal) / (maxVal - minVal)) * cH; }

    /* Grid lines + Y labels */
    const gridCount = 4;
    ctx.save();
    ctx.font = `${11 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridCount; i++) {
      const val = minVal + (maxVal - minVal) * (i / gridCount);
      const y   = yOf(val);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(labelFn(val), PAD.left - 6 * dpr, y);
    }
    ctx.restore();

    /* Gradient fill */
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0, colors.fill.replace('0.12', '0.22'));
    grad.addColorStop(1, colors.fill.replace('0.12', '0.01'));

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(tweened[0]));
    for (let i = 1; i < n; i++) {
      const cpx = (xOf(i - 1) + xOf(i)) / 2;
      ctx.bezierCurveTo(cpx, yOf(tweened[i - 1]), cpx, yOf(tweened[i]), xOf(i), yOf(tweened[i]));
    }
    ctx.lineTo(xOf(n - 1), PAD.top + cH);
    ctx.lineTo(xOf(0), PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* Stroke line */
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(tweened[0]));
    for (let i = 1; i < n; i++) {
      const cpx = (xOf(i - 1) + xOf(i)) / 2;
      ctx.bezierCurveTo(cpx, yOf(tweened[i - 1]), cpx, yOf(tweened[i]), xOf(i), yOf(tweened[i]));
    }
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth   = 1.5 * dpr;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    /* Current value dot */
    const lastY = yOf(tweened[n - 1]);
    const lastX = xOf(n - 1);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = colors.stroke;
    ctx.fill();

    /* X-axis time labels (just a few) */
    ctx.save();
    ctx.font      = `${10 * dpr}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelPositions = [0, Math.floor(n / 2), n - 1];
    labelPositions.forEach(i => {
      ctx.fillText(timeLabel(i, n, currentTf), xOf(i), PAD.top + cH + 6 * dpr);
    });
    ctx.restore();
  }

  function timeLabel(idx, total, tf) {
    const now = new Date();
    let msBack;
    if (tf === '1h')  msBack = (1  * 3600e3) * ((total - 1 - idx) / (total - 1));
    if (tf === '6h')  msBack = (6  * 3600e3) * ((total - 1 - idx) / (total - 1));
    if (tf === '24h') msBack = (24 * 3600e3) * ((total - 1 - idx) / (total - 1));
    if (tf === '7d')  msBack = (7  * 86400e3) * ((total - 1 - idx) / (total - 1));
    const d = new Date(now.getTime() - msBack);
    if (tf === '7d') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /* ---------- ANIMATE CHART (smooth transition) ---------- */
  function animateChart(key, canvasId, prevSnap, newData, minVal, maxVal, colors, labelFn) {
    if (animFrames[key]) cancelAnimationFrame(animFrames[key]);
    const duration = 700;
    const start    = performance.now();
    function step(now) {
      const raw = (now - start) / duration;
      const t   = raw >= 1 ? 1 : 1 - Math.pow(1 - raw, 3); // ease-out cubic
      drawChart(canvasId, newData, prevSnap, t, minVal, maxVal, colors, labelFn);
      if (raw < 1) {
        animFrames[key] = requestAnimationFrame(step);
      }
    }
    animFrames[key] = requestAnimationFrame(step);
  }

  function drawAll(prevSeries) {
    animateChart('cpu',     'chartCpu',     prevSeries?.cpu,     series.cpu,     0, 100, CHART_COLORS.cpu,     v => Math.round(v) + '%');
    animateChart('ram',     'chartRam',     prevSeries?.ram,     series.ram,     0, MAX_RAM, CHART_COLORS.ram, v => v.toFixed(1));
    animateChart('storage', 'chartStorage', prevSeries?.storage, series.storage, 15, MAX_STORAGE, CHART_COLORS.storage, v => Math.round(v) + '');
    animateChart('players', 'chartPlayers', prevSeries?.players, series.players, 0, MAX_PLAYERS, CHART_COLORS.players, v => Math.round(v) + '');
  }

  /* ---------- METRIC BARS & VALUES ---------- */
  function updateMetrics() {
    const cpu  = series.cpu.at(-1);
    const ram  = series.ram.at(-1);
    const stor = series.storage.at(-1);
    const pl   = series.players.at(-1);

    setText('metricCpu',     Math.round(cpu) + '%');
    setText('metricRam',     ram.toFixed(2) + ' / ' + MAX_RAM + ' GB');
    setText('metricStorage', stor.toFixed(1) + ' / ' + MAX_STORAGE + ' GB');
    setText('metricPlayers', pl + ' / ' + MAX_PLAYERS);
    setText('chipPlayers',   pl + ' / ' + MAX_PLAYERS);

    setBarWidth('barCpu',     (cpu / 100) * 100);
    setBarWidth('barRam',     (ram / MAX_RAM) * 100);
    setBarWidth('barStorage', (stor / MAX_STORAGE) * 100);
    setBarWidth('barPlayers', (pl / MAX_PLAYERS) * 100);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = clamp(pct, 0, 100).toFixed(1) + '%';
  }

  /* ---------- UPTIME COUNTER ---------- */
  function updateUptime() {
    uptimeSeconds++;
    const d = Math.floor(uptimeSeconds / 86400);
    const h = Math.floor((uptimeSeconds % 86400) / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    setText('chipUptime', d + 'd ' + h + 'h ' + m + 'm');
  }

  /* ---------- TIMEFRAME SWITCHING ---------- */
  document.querySelectorAll('.detail-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tf-btn').forEach(b => b.classList.remove('detail-tf-btn--active'));
      btn.classList.add('detail-tf-btn--active');
      currentTf = btn.dataset.tf;
      const prev = deepCopy(series);
      buildInitialSeries(currentTf);
      drawAll(prev);
      updateMetrics();
    });
  });

  /* ---------- LIVE CONSOLE ---------- */
  const CONSOLE_LINES = [
    ['console-join',  'DragonKnight joined the game'],
    ['console-join',  'PixelFarmer99 joined the game'],
    ['console-leave', 'NightOwl42 left the game'],
    ['',              'Saving the world...'],
    ['',              'Saved the game'],
    ['console-join',  'CreeperSlayer99 joined the game'],
    ['console-warn',  '[WARN] Moved too quickly! PossibleHack@PlayerOne'],
    ['',              'Time: 23:40, rain: false'],
  ];
  let consoleLine = 0;

  function scrollConsoleToBottom() {
    const output = document.getElementById('consoleOutput');
    const autoScroll = document.getElementById('consoleAutoScroll');
    if (output && autoScroll && autoScroll.checked) {
      output.scrollTop = output.scrollHeight;
    }
  }

  function appendConsoleLine() {
    const output = document.getElementById('consoleOutput');
    if (!output) return;
    const [cls, text] = CONSOLE_LINES[consoleLine % CONSOLE_LINES.length];
    consoleLine++;
    const ts  = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const p   = document.createElement('p');
    const tsSpan = document.createElement('span');
    tsSpan.className = 'console-ts';
    tsSpan.textContent = '[' + ts + '] ';
    p.appendChild(tsSpan);
    if (cls) {
      const msg = document.createElement('span');
      msg.className = cls;
      msg.textContent = text;
      p.appendChild(msg);
    } else {
      p.appendChild(document.createTextNode(text));
    }
    output.appendChild(p);
    scrollConsoleToBottom();
    /* Keep max 100 lines */
    while (output.childElementCount > 100) output.removeChild(output.firstElementChild);
  }

  /* Console input form */
  const consoleForm = document.getElementById('consoleForm');
  const consoleInput = document.getElementById('consoleInput');
  if (consoleForm && consoleInput) {
    consoleForm.addEventListener('submit', e => {
      e.preventDefault();
      const cmd = consoleInput.value.trim();
      if (!cmd) return;
      const output = document.getElementById('consoleOutput');
      const p = document.createElement('p');
      const tsSpan = document.createElement('span');
      tsSpan.className = 'console-ts';
      const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      tsSpan.textContent = '[' + ts + '] ';
      const msg = document.createElement('span');
      msg.className = 'console-cmd';
      msg.textContent = '> ' + cmd;
      p.appendChild(tsSpan);
      p.appendChild(msg);
      if (output) {
        output.appendChild(p);
        scrollConsoleToBottom();
      }
      consoleInput.value = '';
    });
  }

  /* Clear console */
  const clearBtn = document.getElementById('clearConsole');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const output = document.getElementById('consoleOutput');
      if (output) output.innerHTML = '<p id="consoleLive"></p>';
    });
  }

  /* Copy IP on click */
  document.querySelectorAll('.detail-ip').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard?.writeText(el.textContent.trim()).then(() => {
        const orig = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(() => { el.textContent = orig; }, 1400);
      });
    });
  });

  /* ---------- RESTART / STOP BUTTONS ---------- */
  const btnRestart = document.getElementById('btnRestart');
  const btnStop    = document.getElementById('btnStop');

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      btnRestart.disabled = true;
      btnRestart.textContent = 'Restarting…';
      const output = document.getElementById('consoleOutput');
      const addLine = (cls, text) => {
        const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const p  = document.createElement('p');
        p.innerHTML = `<span class="console-ts">[${ts}]</span> <span class="${cls}">${text}</span>`;
        if (output) { output.appendChild(p); scrollConsoleToBottom(); }
      };
      addLine('console-warn', 'Server restart initiated by John.');
      setTimeout(() => addLine('', 'Stopping server...'), 800);
      setTimeout(() => addLine('', 'Server stopped.'), 2000);
      setTimeout(() => addLine('console-info', 'Server started on port 25565'), 3500);
      setTimeout(() => {
        addLine('', 'Done (2.841s)! For help, type "help"');
        btnRestart.disabled = false;
        btnRestart.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 116 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 8V4.5M2 8H5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Restart';
      }, 4200);
    });
  }

  if (btnStop) {
    btnStop.addEventListener('click', () => {
      if (btnStop.dataset.state === 'stopped') {
        btnStop.dataset.state = 'running';
        btnStop.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/></svg> Stop';
        const badge = document.querySelector('.detail-header-title-row .dashboard-badge');
        if (badge) { badge.className = 'dashboard-badge dashboard-badge--success'; badge.textContent = 'Online'; }
      } else {
        btnStop.dataset.state = 'stopped';
        btnStop.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="5,3 13,8 5,13" fill="currentColor"/></svg> Start';
        const badge = document.querySelector('.detail-header-title-row .dashboard-badge');
        if (badge) { badge.className = 'dashboard-badge'; badge.style.cssText = 'background:rgba(239,68,68,.12);color:#f87171;'; badge.textContent = 'Offline'; }
      }
    });
  }

  /* ---------- HELPERS ---------- */
  function deepCopy(obj) {
    return { cpu: [...obj.cpu], ram: [...obj.ram], storage: [...obj.storage], players: [...obj.players] };
  }

  /* ---------- RESIZE HANDLER ---------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ['chartCpu','chartRam','chartStorage','chartPlayers'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el._sized = false;
      });
      drawAll(null);
    }, 150);
  });

  /* ---------- TAB SWITCHING ---------- */
  const tabButtons = document.querySelectorAll('.detail-tab-btn');
  const panels = document.querySelectorAll('.detail-tab-panel');

  function switchDetailTab(panelId) {
    tabButtons.forEach(btn => {
      const isActive = btn.dataset.panel === panelId;
      btn.classList.toggle('detail-tab-btn--active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    panels.forEach(panel => {
      const isActive = panel.id === panelId;
      panel.classList.toggle('detail-tab-panel--active', isActive);
      panel.hidden = !isActive;
    });
    /* Resize charts when Performance panel becomes visible so canvas gets correct size */
    if (panelId === 'panelPerformance') {
      ['chartCpu', 'chartRam', 'chartStorage', 'chartPlayers'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el._sized = false;
      });
      requestAnimationFrame(() => drawAll(null));
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchDetailTab(btn.dataset.panel));
  });

  /* ---------- INIT ---------- */
  function init() {
    buildInitialSeries(currentTf);
    drawAll(null);
    updateMetrics();

    /* Live updates */
    updateTimer = setInterval(() => {
      const prev = deepCopy(series);
      appendNewPoints();
      drawAll(prev);
      updateMetrics();
    }, UPDATE_INTERVAL);

    /* Uptime tick every second */
    setInterval(updateUptime, 1000);

    /* Console random lines */
    setInterval(appendConsoleLine, 7000);
  }

  /* Wait for layout to settle so canvas gets correct width */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(init));
  } else {
    requestAnimationFrame(init);
  }

})();
