/**
 * DOM rendering: viewport culling, card creation/recycling, overlap handling, year markers.
 */

import { formatDate } from './data.js';

const MARGIN = 300; // px outside viewport to keep rendered
const CARD_MIN_HEIGHT = 50; // estimated minimum card height for overlap

export class Renderer {
  constructor(timeline, track, leftCol, rightCol, yearMarkersEl) {
    this.timeline = timeline;
    this.track = track;
    this.leftCol = leftCol;
    this.rightCol = rightCol;
    this.yearMarkersEl = yearMarkersEl;

    /** @type {Map<number, HTMLElement>} */
    this.activeCards = new Map();
    this.activeYearMarkers = new Map();
    this.visibleCount = 0;
  }

  /** Full render pass. */
  render() {
    const tl = this.timeline;
    const { topDays, bottomDays } = tl.getViewportDays();
    const marginDays = MARGIN / tl.pixelsPerDay;
    const viewTop = topDays - marginDays;
    const viewBottom = bottomDays + marginDays;
    const maxImp = tl.visibleImportance;

    // Position the track
    this.track.style.transform = `translateX(-50%) translateY(${-tl.scrollY}px)`;

    // Track which cards should exist
    const shouldExist = new Set();
    let visibleCount = 0;

    // Overlap stacks per side
    const leftStack = [];
    const rightStack = [];

    for (const event of tl.events) {
      // Skip if outside viewport or filtered by importance
      if (event.days < viewTop || event.days > viewBottom) continue;
      if (event.importance > maxImp) continue;

      shouldExist.add(event.id);
      visibleCount++;

      const baseY = tl.dateToY(event.days);
      const side = event.id % 2 === 0 ? 'left' : 'right';
      const stack = side === 'left' ? leftStack : rightStack;

      // Overlap: push down if collides with previous card on same side
      let y = baseY;
      for (let i = stack.length - 1; i >= 0; i--) {
        const prev = stack[i];
        if (y < prev.bottom) {
          y = prev.bottom + 6;
        } else {
          break;
        }
      }

      // Get or create card
      let card = this.activeCards.get(event.id);
      if (!card) {
        card = this.createCard(event);
        this.activeCards.set(event.id, card);
        const col = side === 'left' ? this.leftCol : this.rightCol;
        col.appendChild(card);
        // Trigger reflow for animation
        card.offsetHeight;
      }

      card.style.top = `${y}px`;

      // Animate in
      if (!card.classList.contains('visible')) {
        card.classList.add('visible');
      }

      // Estimate card height (use actual if available)
      const cardHeight = card.offsetHeight || CARD_MIN_HEIGHT;
      stack.push({ bottom: y + cardHeight });

      // Trim stack: remove entries far above current Y
      while (stack.length > 1 && stack[0].bottom < y - 200) {
        stack.shift();
      }
    }

    this.visibleCount = visibleCount;

    // Remove cards no longer needed
    for (const [id, card] of this.activeCards) {
      if (!shouldExist.has(id)) {
        card.classList.remove('visible');
        // Remove from DOM after transition
        setTimeout(() => {
          if (!card.classList.contains('visible')) {
            card.remove();
            this.activeCards.delete(id);
          }
        }, 350);
      }
    }

    // Render year markers
    this.renderYearMarkers(viewTop, viewBottom);
  }

  /** Create an event card element. */
  createCard(event) {
    const card = document.createElement('div');
    card.className = `event-card importance-${event.importance}`;
    if (event.dateGranularity === 'year') {
      card.classList.add('granularity-year');
    }
    card.dataset.id = event.id;

    const dateEl = document.createElement('div');
    dateEl.className = 'event-date';
    dateEl.textContent = formatDate(event.date, event.dateGranularity);

    const textEl = document.createElement('div');
    textEl.className = 'event-text';
    textEl.textContent = event.text;

    card.appendChild(dateEl);
    card.appendChild(textEl);
    return card;
  }

  /** Render year markers along the timeline. */
  renderYearMarkers(viewTopDays, viewBottomDays) {
    const tl = this.timeline;
    const epoch = new Date(1940, 0, 1);

    // Determine year interval based on zoom
    let yearInterval = 10;
    if (tl.pixelsPerDay > 0.05) yearInterval = 5;
    if (tl.pixelsPerDay > 0.2) yearInterval = 1;

    const startYear = Math.floor((epoch.getFullYear() + viewTopDays / 365.25) / yearInterval) * yearInterval;
    const endYear = Math.ceil((epoch.getFullYear() + viewBottomDays / 365.25) / yearInterval) * yearInterval;

    const shouldExist = new Set();

    for (let year = startYear; year <= endYear; year += yearInterval) {
      if (year < 1940) continue;
      shouldExist.add(year);

      const yearDate = new Date(year, 0, 1);
      const days = Math.floor((yearDate - epoch) / 86400000);
      const y = tl.dateToY(days);

      let marker = this.activeYearMarkers.get(year);
      if (!marker) {
        marker = document.createElement('div');
        marker.className = 'year-marker';
        marker.textContent = year;
        this.yearMarkersEl.appendChild(marker);
        this.activeYearMarkers.set(year, marker);
      }
      marker.style.top = `${y}px`;
    }

    // Remove old markers
    for (const [year, marker] of this.activeYearMarkers) {
      if (!shouldExist.has(year)) {
        marker.remove();
        this.activeYearMarkers.delete(year);
      }
    }
  }
}
