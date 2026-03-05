/**
 * Main application: init, event listeners, render loop.
 */

import { loadEvents } from './data.js';
import { Timeline } from './timeline.js';
import { Renderer } from './renderer.js';

let timeline;
let renderer;

// DOM elements
const container = document.getElementById('timeline-container');
const track = document.getElementById('timeline-track');
const leftCol = document.getElementById('events-left');
const rightCol = document.getElementById('events-right');
const yearMarkersEl = document.getElementById('year-markers');
const loading = document.getElementById('loading');
const hudZoom = document.getElementById('hud-zoom-value');
const hudDate = document.getElementById('hud-date-value');
const hudVisible = document.getElementById('hud-visible-value');

async function init() {
  try {
    const data = await loadEvents();
    console.log(`Loaded ${data.metadata.totalEvents} events`);

    timeline = new Timeline(data.events, window.innerHeight);
    renderer = new Renderer(timeline, track, leftCol, rightCol, yearMarkersEl);

    setupEventListeners();
    timeline.markDirty();
    requestAnimationFrame(renderLoop);

    // Hide loading
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
  // Wheel: pan (normal scroll) or zoom (ctrl/meta + scroll)
  container.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      timeline.zoom(zoomFactor, e.clientY);
    } else {
      // Pan
      timeline.pan(e.deltaY);
    }
  }, { passive: false });

  // Touch support
  let lastTouchY = null;
  let lastPinchDist = null;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      lastPinchDist = getPinchDist(e.touches);
      lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  });

  container.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && lastTouchY !== null) {
      const deltaY = lastTouchY - e.touches[0].clientY;
      timeline.pan(deltaY);
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dist = getPinchDist(e.touches);
      if (lastPinchDist !== null) {
        const factor = dist / lastPinchDist;
        const focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        timeline.zoom(factor, focalY);
      }
      lastPinchDist = dist;
      lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    lastTouchY = null;
    lastPinchDist = null;
  });

  // Resize
  window.addEventListener('resize', () => {
    timeline.containerHeight = window.innerHeight;
    timeline.markDirty();
  });
}

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function renderLoop() {
  if (timeline.consumeDirty()) {
    renderer.render();
    updateHUD();
  }
  requestAnimationFrame(renderLoop);
}

function updateHUD() {
  const ppd = timeline.pixelsPerDay;
  let zoomLabel;
  if (ppd < 0.02) zoomLabel = 'Overview (decades)';
  else if (ppd < 0.08) zoomLabel = 'Decades';
  else if (ppd < 0.3) zoomLabel = 'Years';
  else if (ppd < 1.5) zoomLabel = 'Months';
  else zoomLabel = 'Days';

  hudZoom.textContent = zoomLabel;
  hudDate.textContent = timeline.getViewportCenterDate();
  hudVisible.textContent = `${renderer.visibleCount} visible (importance 1-${timeline.visibleImportance})`;
}

init();
