/**
 * Main application: init, event listeners, render loop.
 */

import { loadEvents } from './data.js';
import { Timeline }   from './timeline.js';
import { Renderer }   from './renderer.js';

let timeline;
let renderer;

let velocity    = 0;
const FRICTION  = 0.88;
const MAX_VEL   = 80;

const container       = document.getElementById('timeline-container');
const track           = document.getElementById('timeline-track');
const eventsContainer = document.getElementById('events-container');
const yearMarkersEl   = document.getElementById('year-markers');
const yearSegmentsEl  = document.getElementById('year-segments');
const loading        = document.getElementById('loading');
const hudZoom        = document.getElementById('hud-zoom-value');
const hudDate        = document.getElementById('hud-date-value');
const hudVisible     = document.getElementById('hud-visible-value');

async function init() {
  try {
    const data = await loadEvents();
    console.log(`Loaded ${data.metadata.totalEvents} events`);

    timeline = new Timeline(data.events, window.innerWidth);
    renderer = new Renderer(timeline, track, eventsContainer, yearMarkersEl, yearSegmentsEl);

    setupEventListeners();
    setupImportanceCheckboxes();
    timeline.markDirty();
    requestAnimationFrame(renderLoop);

    loading.classList.add('hidden');

    // Hide scroll hint after first interaction
    let hintHidden = false;
    container.addEventListener('wheel', () => {
      if (!hintHidden) {
        container.classList.add('scrolled');
        hintHidden = true;
      }
    }, { once: true });

  } catch (err) {
    loading.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

function setupEventListeners() {
  // Wheel: horizontal pan or zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom on trackpad or ctrl+scroll
      velocity = 0; // cancel momentum on zoom
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      timeline.zoom(factor, e.clientX);
    } else {
      // Accumulate into velocity for momentum scrolling
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      velocity += delta;
      velocity = Math.max(-MAX_VEL, Math.min(MAX_VEL, velocity));
    }
  }, { passive: false });

  // Touch: swipe to pan, pinch to zoom
  let lastTouchX    = null;
  let lastPinchDist = null;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      lastPinchDist = getPinchDist(e.touches);
      lastTouchX    = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }
  });

  container.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && lastTouchX !== null) {
      const deltaX = lastTouchX - e.touches[0].clientX;
      timeline.pan(deltaX);
      lastTouchX = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      const dist = getPinchDist(e.touches);
      if (lastPinchDist !== null) {
        const factor = dist / lastPinchDist;
        const focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        timeline.zoom(factor, focalX);
      }
      lastPinchDist = dist;
      lastTouchX    = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    lastTouchX    = null;
    lastPinchDist = null;
  });

  // Resize
  window.addEventListener('resize', () => {
    timeline.containerWidth = window.innerWidth;
    timeline.markDirty();
  });
}

function setupImportanceCheckboxes() {
  const checkboxes = document.querySelectorAll('.imp-cb');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const levels = new Set();
      checkboxes.forEach(c => {
        if (c.checked) levels.add(Number(c.value));
      });
      timeline.manualLevels = levels;
      timeline.markDirty();
    });
  });
}

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function renderLoop() {
  // Always re-schedule first so the loop survives any render error
  requestAnimationFrame(renderLoop);

  // Apply momentum scroll
  if (Math.abs(velocity) > 0.3) {
    timeline.pan(velocity);
    velocity *= FRICTION;
  }

  if (timeline.consumeDirty()) {
    try {
      renderer.render();
      updateHUD();
    } catch (err) {
      console.error('Render error:', err);
    }
  }
}

function updateHUD() {
  const ppd = timeline.pixelsPerDay;
  let zoomLabel;
  if      (ppd < 0.02) zoomLabel = 'Overview';
  else if (ppd < 0.08) zoomLabel = 'Decades';
  else if (ppd < 0.3)  zoomLabel = 'Years';
  else if (ppd < 1.5)  zoomLabel = 'Months';
  else                  zoomLabel = 'Days';

  hudZoom.textContent    = `${zoomLabel} (${ppd.toFixed(3)})`;
  hudDate.textContent    = timeline.getViewportCenterDate();
  hudVisible.textContent = `${renderer.visibleCount} events visible`;
}

init();
