'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const COMUNI_PMTILES = 'https://gbvitrano.github.io/ANNCSU/dati/comuni.pmtiles';
const DATA_URL       = 'dati/sicilia.csv';

// Color scale: 20 steps × 5% from 0 to 100 (red → yellow → green)
const COLOR_STEPS = [
  [5,   '#7f0000'],
  [10,  '#a50000'],
  [15,  '#cc0000'],
  [20,  '#dd2200'],
  [25,  '#ee4400'],
  [30,  '#f06600'],
  [35,  '#f08800'],
  [40,  '#f0aa00'],
  [45,  '#f0cc00'],
  [50,  '#f0ee00'],
  [55,  '#ccdd00'],
  [60,  '#a8cc00'],
  [65,  '#84bb00'],  // ← 65% = soglia legge
  [70,  '#60aa00'],
  [75,  '#3c9900'],
  [80,  '#1e8800'],
  [85,  '#007700'],
  [90,  '#005f00'],
  [95,  '#004700'],
  [100, '#003000'],
];

const NO_DATA_COLOR  = '#555566';
const DEFAULT_FILL   = 'rgba(80,80,100,0.2)';
const HOVER_OUTLINE  = '#ffffff';
const SELECT_OUTLINE = '#ffffff';

const SICILIA_CENTER  = [14.0, 37.6];
const SICILIA_ZOOM    = 7.2;

// Province bounding boxes [sw, ne]
const PROVINCE_BOUNDS = {
  'Trapani':       [[12.23, 37.56], [13.08, 38.22]],
  'Palermo':       [[12.95, 37.58], [14.15, 38.25]],
  'Messina':       [[14.33, 37.83], [15.66, 38.30]],
  'Agrigento':     [[12.88, 37.07], [13.88, 37.68]],
  'Caltanissetta': [[13.70, 37.28], [14.40, 37.70]],
  'Enna':          [[14.08, 37.44], [14.75, 37.96]],
  'Catania':       [[14.49, 37.18], [15.32, 37.88]],
  'Ragusa':        [[14.32, 36.68], [14.92, 37.12]],
  'Siracusa':      [[14.88, 36.63], [15.55, 37.30]],
};

const YEARS = ['2010','2011','2012','2013','2014','2015',
               '2016','2017','2018','2019','2020','2021',
               '2022','2023','2024'];

// ── STATE ─────────────────────────────────────────────────────────────────────

let map;
let allData    = {};   // { anno: { istat: rowObj } }
let allByIstat = {};   // { istat: { anno: rowObj } }  (for trends)
let currentAnno = '2024';
let currentProvincia = '';
let hoveredId   = null;
let selectedIstat = null;
let trendChart  = null;

// ── BOOT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setLoading(true, 'Caricamento dati…');
  await loadData();
  initMap();
  setupControls();
  buildLegend();
  computeStats();
});

// ── DATA ──────────────────────────────────────────────────────────────────────

async function loadData() {
  const resp = await fetch(DATA_URL);
  const text = await resp.text();
  parseCSV(text);
}

function parseCSV(text) {
  const lines = text.split('\n');
  // skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const pctMatch = line.match(/"(\d+),(\d+)%"|"(\d+)%"/);
    let pct = null;
    if (pctMatch) {
      pct = pctMatch[3]
        ? parseFloat(pctMatch[3])
        : parseFloat(pctMatch[1] + '.' + pctMatch[2]);
    }

    // First 7 fields are safe text/numbers (no comma-decimal issues)
    const parts = line.split(',');
    if (parts.length < 7) continue;

    const row = {
      anno:       parts[0].trim(),
      istat:      parts[1].trim().padStart(6, '0'),
      regione:    parts[2].trim(),
      provincia:  parts[3].trim(),
      comune:     parts[4].trim(),
      popolazione: parseInt(parts[5]) || 0,
      dato:       parts[6].trim(),
      percentuale: pct,
    };

    if (!row.anno || !row.istat) continue;

    // Index by anno
    if (!allData[row.anno]) allData[row.anno] = {};
    if (!allData[row.anno][row.istat]) {
      allData[row.anno][row.istat] = row;
    }

    // Index by istat (for trend chart)
    if (!allByIstat[row.istat]) allByIstat[row.istat] = {};
    if (!allByIstat[row.istat][row.anno]) {
      allByIstat[row.istat][row.anno] = row;
    }
  }
}

// ── MAP ───────────────────────────────────────────────────────────────────────

function initMap() {
  const isDark = document.body.dataset.theme !== 'light';

  // PMTiles protocol
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'carto-bg': {
          type: 'raster',
          tiles: isDark
            ? ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png']
            : ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap © CARTO',
        },
        'carto-labels': {
          type: 'raster',
          tiles: isDark
            ? ['https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png']
            : ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'],
          tileSize: 256,
        },
      },
      layers: [
        { id: 'bg', type: 'raster', source: 'carto-bg' },
      ],
      glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    },
    center: SICILIA_CENTER,
    zoom: SICILIA_ZOOM,
    minZoom: 5,
    maxZoom: 15,
  });

  map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    // Comuni source (PMTiles)
    map.addSource('comuni', {
      type: 'vector',
      url: `pmtiles://${COMUNI_PMTILES}`,
      attribution: 'Confini: ISTAT via confini-amministrativi.it',
    });

    // Fill layer – choropleth
    map.addLayer({
      id: 'comuni-fill',
      type: 'fill',
      source: 'comuni',
      'source-layer': 'comuni',
      paint: {
        'fill-color': buildColorExpression(),
        'fill-opacity': 0.85,
      },
    });

    // Outline layer
    map.addLayer({
      id: 'comuni-outline',
      type: 'line',
      source: 'comuni',
      'source-layer': 'comuni',
      paint: {
        'line-color': isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
        'line-width': 0.5,
      },
      filter: ['has', 'pro_com_t'],
    });

    // Hover outline
    map.addLayer({
      id: 'comuni-hover',
      type: 'line',
      source: 'comuni',
      'source-layer': 'comuni',
      paint: {
        'line-color': HOVER_OUTLINE,
        'line-width': 2,
      },
      filter: ['==', 'pro_com_t', ''],
    });

    // Selected outline
    map.addLayer({
      id: 'comuni-selected',
      type: 'line',
      source: 'comuni',
      'source-layer': 'comuni',
      paint: {
        'line-color': SELECT_OUTLINE,
        'line-width': 3,
      },
      filter: ['==', 'pro_com_t', ''],
    });

    // Labels on top
    map.addLayer({
      id: 'labels',
      type: 'raster',
      source: 'carto-labels',
    });

    setupMapInteractions();
    setLoading(false);
    updateMap();
  });
}

// ── MAP INTERACTIONS ──────────────────────────────────────────────────────────

const tooltip = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  className: 'map-tooltip',
  maxWidth: '220px',
});

function setupMapInteractions() {
  map.on('mousemove', 'comuni-fill', (e) => {
    if (!e.features.length) return;
    const feat  = e.features[0];
    const istat = feat.properties.pro_com_t;
    if (!istat) return;

    const row = allData[currentAnno]?.[istat];
    if (!row) return;

    map.setFilter('comuni-hover', ['==', 'pro_com_t', istat]);
    map.getCanvas().style.cursor = 'pointer';

    const pctStr = row.percentuale !== null
      ? `<span class="tooltip-pct" style="color:${pctToColor(row.percentuale)}">${formatPct(row.percentuale)}%</span>`
      : '<span class="tooltip-sub">dato n.d.</span>';

    tooltip.setLngLat(e.lngLat).setHTML(`
      <div class="tooltip-name">${row.comune}</div>
      <div class="tooltip-sub">${row.provincia}</div>
      ${pctStr}
      <div class="tooltip-sub">RD ${currentAnno}</div>
    `).addTo(map);
  });

  map.on('mouseleave', 'comuni-fill', () => {
    map.setFilter('comuni-hover', ['==', 'pro_com_t', '']);
    map.getCanvas().style.cursor = '';
    tooltip.remove();
  });

  map.on('click', 'comuni-fill', (e) => {
    if (!e.features.length) return;
    const istat = e.features[0].properties.pro_com_t;
    if (!istat) return;
    const row = allData[currentAnno]?.[istat];
    if (!row) return;
    selectComune(istat, row);
  });
}

function selectComune(istat, row) {
  selectedIstat = istat;
  map.setFilter('comuni-selected', ['==', 'pro_com_t', istat]);
  showInfoPanel(istat, row);
}

// ── COLOR LOGIC ───────────────────────────────────────────────────────────────

function pctToColor(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return NO_DATA_COLOR;
  for (const [max, color] of COLOR_STEPS) {
    if (pct <= max) return color;
  }
  return COLOR_STEPS[COLOR_STEPS.length - 1][1];
}

function buildColorExpression() {
  const annoData = allData[currentAnno] || {};
  const matchExpr = ['match', ['get', 'pro_com_t']];

  for (const [istat, row] of Object.entries(annoData)) {
    const color = pctToColor(row.percentuale);
    // Apply province filter: dim non-selected province
    if (currentProvincia && row.provincia !== currentProvincia) {
      matchExpr.push(istat, 'rgba(80,80,100,0.15)');
    } else {
      matchExpr.push(istat, color);
    }
  }

  // Default: transparent for non-Sicilian comuni
  matchExpr.push('rgba(0,0,0,0)');
  return matchExpr;
}

function updateMap() {
  if (!map.isStyleLoaded()) return;
  map.setPaintProperty('comuni-fill', 'fill-color', buildColorExpression());
}

// ── INFO PANEL ────────────────────────────────────────────────────────────────

function showInfoPanel(istat, row) {
  const panel = document.getElementById('info-panel');
  const savedW = panel.style.width;
  const pct   = row.percentuale;
  const color = pctToColor(pct);

  const legalNote = pct !== null
    ? (pct >= 65
        ? '✓ Sopra il 65% (obiettivo di legge)'
        : `${(65 - pct).toFixed(1)}% sotto l'obiettivo di legge`)
    : '';

  panel.innerHTML = `
    <div id="sidebar-resize-handle"></div>
    <button id="info-panel-close" onclick="closeInfoPanel()">✕</button>
    <h2>${row.comune}</h2>
    <div class="info-provincia">${row.provincia} · Sicilia</div>

    <div class="info-pct-badge" style="background:${color}">
      <div>
        <div class="info-pct-value">${pct !== null ? formatPct(pct) + '%' : 'N/D'}</div>
        <div class="info-pct-label">Raccolta Differenziata ${currentAnno}</div>
        ${legalNote ? `<div class="info-legal-note">${legalNote}</div>` : ''}
      </div>
    </div>

    <div class="info-grid">
      <div class="info-cell">
        <div class="info-cell-label">Popolazione</div>
        <div class="info-cell-value">${row.popolazione.toLocaleString('it-IT')}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Anno dati</div>
        <div class="info-cell-value">${currentAnno}</div>
      </div>
    </div>

    <div class="chart-section">
      <h3>Trend 2010–2024</h3>
      <canvas id="trend-chart"></canvas>
    </div>
  `;

  if (savedW) panel.style.width = savedW;
  panel.classList.remove('hidden');
  renderTrendChart(istat);
  setupSidebarResize();
}

function closeInfoPanel() {
  document.getElementById('info-panel').classList.add('hidden');
  selectedIstat = null;
  if (map) map.setFilter('comuni-selected', ['==', 'pro_com_t', '']);
}

function renderTrendChart(istat) {
  if (trendChart) { trendChart.destroy(); trendChart = null; }

  const byYear = allByIstat[istat] || {};
  const labels = YEARS;
  const values = YEARS.map(y => byYear[y]?.percentuale ?? null);

  const isDark = document.body.dataset.theme !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textColor = isDark ? '#a0a8b8' : '#4a5568';

  const pointColors = values.map(v => v !== null ? pctToColor(v) : 'transparent');

  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#e94560',
        borderWidth: 2,
        pointBackgroundColor: pointColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
        backgroundColor: 'rgba(233,69,96,0.08)',
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y !== null ? `${formatPct(ctx.parsed.y)}%` : 'N/D',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 9 }, maxRotation: 45 },
          grid:  { color: gridColor },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: textColor,
            font: { size: 9 },
            callback: v => v + '%',
          },
          grid: { color: gridColor },
        },
      },
    },
  });
}

// ── LEGEND ────────────────────────────────────────────────────────────────────

function buildLegend() {
  const container = document.getElementById('legend-scale');
  container.innerHTML = '';

  COLOR_STEPS.forEach(([max, color], i) => {
    const min = i === 0 ? 0 : COLOR_STEPS[i - 1][0];
    const isTarget = min === 60; // step che include il 65%

    const row = document.createElement('div');
    row.className = 'legend-row' + (isTarget ? ' legend-65' : '');
    row.innerHTML = `
      <div class="legend-swatch" style="background:${color}"></div>
      <span class="legend-label">${min}–${max}%${isTarget ? ' ← obiettivo' : ''}</span>
    `;
    container.appendChild(row);
  });
}

// ── CONTROLS ──────────────────────────────────────────────────────────────────

function setupControls() {
  // Year slider
  const slider  = document.getElementById('year-slider');
  const display = document.getElementById('year-display');

  slider.min   = YEARS[0];
  slider.max   = YEARS[YEARS.length - 1];
  slider.value = currentAnno;
  display.textContent = currentAnno;

  slider.addEventListener('input', () => {
    currentAnno = slider.value;
    display.textContent = currentAnno;
    updateMap();
    computeStats();
    if (selectedIstat) {
      const row = allData[currentAnno]?.[selectedIstat];
      if (row) showInfoPanel(selectedIstat, row);
    }
  });

  // Province filter
  const sel = document.getElementById('province-select');
  const provinces = ['', ...Object.keys(PROVINCE_BOUNDS)];
  provinces.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p || 'Tutte le province';
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    currentProvincia = sel.value;
    // Reset comune selection
    document.getElementById('comune-select').value = '';
    selectedIstat = null;
    if (map) map.setFilter('comuni-selected', ['==', 'pro_com_t', '']);
    closeInfoPanel();
    populateComuneSelect();
    updateMap();
    if (currentProvincia && PROVINCE_BOUNDS[currentProvincia]) {
      const [[w, s], [e, n]] = PROVINCE_BOUNDS[currentProvincia];
      map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 800 });
    } else if (!currentProvincia) {
      map.flyTo({ center: SICILIA_CENTER, zoom: SICILIA_ZOOM, duration: 800 });
    }
  });

  // Comune select
  populateComuneSelect();
  document.getElementById('comune-select').addEventListener('change', (e) => {
    const istat = e.target.value;
    if (!istat) {
      closeInfoPanel();
      selectedIstat = null;
      if (map) map.setFilter('comuni-selected', ['==', 'pro_com_t', '']);
      return;
    }
    const row = allData[currentAnno]?.[istat];
    if (!row) return;
    selectComune(istat, row);
    zoomToComune(istat, row.provincia);
  });

  // Theme toggle
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  // Info modal
  document.getElementById('btn-info').addEventListener('click', () => {
    document.getElementById('info-modal').classList.remove('hidden');
  });
  document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('info-modal').classList.add('hidden');
  });
  document.getElementById('info-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
}

// ── COMUNE SELECT ─────────────────────────────────────────────────────────────

function populateComuneSelect() {
  const sel = document.getElementById('comune-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Tutti —</option>';

  const annoData = allData[currentAnno] || {};
  // Raccoglie comuni unici (usa l'anno corrente)
  const rows = Object.values(annoData)
    .filter(r => !currentProvincia || r.provincia === currentProvincia)
    .sort((a, b) => a.comune.localeCompare(b.comune, 'it'));

  if (!currentProvincia) {
    // Raggruppa per provincia
    const byProv = {};
    rows.forEach(r => {
      if (!byProv[r.provincia]) byProv[r.provincia] = [];
      byProv[r.provincia].push(r);
    });
    Object.keys(byProv).sort().forEach(prov => {
      const grp = document.createElement('optgroup');
      grp.label = prov;
      byProv[prov].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.istat;
        opt.textContent = r.comune;
        grp.appendChild(opt);
      });
      sel.appendChild(grp);
    });
  } else {
    rows.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.istat;
      opt.textContent = r.comune;
      sel.appendChild(opt);
    });
  }

  // Ripristina selezione precedente se ancora valida
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function zoomToComune(istat, provincia) {
  // Step 1: zoom alla provincia per caricare i tile
  if (provincia && PROVINCE_BOUNDS[provincia]) {
    const [[w, s], [e, n]] = PROVINCE_BOUNDS[provincia];
    map.fitBounds([[w, s], [e, n]], { padding: 20, duration: 500, maxZoom: 11 });
  }

  // Step 2: dopo idle, trova la feature e fit ai suoi bounds
  map.once('idle', () => {
    const features = map.querySourceFeatures('comuni', {
      sourceLayer: 'comuni',
      filter: ['==', 'pro_com_t', istat],
    });
    if (!features.length) return;
    const bounds = featureBounds(features[0]);
    if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 700 });
  });
}

function featureBounds(feature) {
  const pts = [];
  const collect = (arr, depth) => {
    if (depth === 0) { pts.push(arr); return; }
    arr.forEach(a => collect(a, depth - 1));
  };
  const depth = feature.geometry.type === 'Polygon' ? 2 : 3;
  collect(feature.geometry.coordinates, depth);
  if (!pts.length) return null;
  const lngs = pts.map(p => p[0]);
  const lats  = pts.map(p => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

function toggleTheme() {
  const isDark = document.body.dataset.theme !== 'light';
  document.body.dataset.theme = isDark ? 'light' : 'dark';
  document.getElementById('btn-theme').textContent = isDark ? '🌙' : '☀';

  if (!map) return;

  // Update basemap tiles
  const tiles = isDark
    ? ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png']
    : ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png'];
  const labelTiles = isDark
    ? ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png']
    : ['https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png'];

  map.getSource('carto-bg')?.setTiles(tiles);
  map.getSource('carto-labels')?.setTiles(labelTiles);

  // Update outline color
  const outlineColor = isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)';
  map.setPaintProperty('comuni-outline', 'line-color', outlineColor);

  // Re-render trend chart with updated colors
  if (selectedIstat) renderTrendChart(selectedIstat);
}

// ── STATS ─────────────────────────────────────────────────────────────────────

function computeStats() {
  const annoData = allData[currentAnno] || {};
  const rows = Object.values(annoData).filter(r => r.percentuale !== null);
  if (!rows.length) return;

  const values = rows.map(r => r.percentuale);
  const avg    = values.reduce((a, b) => a + b, 0) / values.length;
  const above65 = values.filter(v => v >= 65).length;
  const pct65   = (above65 / values.length * 100).toFixed(0);

  document.getElementById('stat-comuni').textContent = rows.length;
  document.getElementById('stat-avg').textContent    = formatPct(avg) + '%';
  document.getElementById('stat-above65').textContent = pct65 + '%';
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function formatPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return v.toFixed(1);
}

// ── SIDEBAR RESIZE ────────────────────────────────────────────────────────────

function setupSidebarResize() {
  const handle = document.getElementById('sidebar-resize-handle');
  const panel  = document.getElementById('info-panel');
  if (!handle || !panel) return;

  let startX, startW;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    function onMove(e) {
      const delta = startX - e.clientX;
      const newW  = Math.min(
        Math.max(startW + delta, 240),
        Math.min(520, window.innerWidth - 32)
      );
      panel.style.width = newW + 'px';
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (trendChart) trendChart.resize();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function setLoading(show, msg = '') {
  const el = document.getElementById('loading');
  el.classList.toggle('hidden', !show);
  if (msg) document.getElementById('loading-text').textContent = msg;
}
