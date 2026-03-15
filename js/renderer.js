/**
 * Horizontal timeline renderer.
 * Four event rows (2 above, 2 below), connector lines, color-coded by importance.
 */

import { formatDate } from './data.js';

const MARGIN       = 400;   // px outside viewport to keep rendered
const CARD_WIDTH   = 180;   // fixed card width in px
const CARD_HEIGHT  = 85;    // fixed card height in px
const NEAR_GAP     = 24;    // px from timeline to nearest row card edge
const BETWEEN_GAP  = 12;    // px gap between near and far rows
const CONN_LEFT    = 14;    // x offset of connector from card left edge
const MIN_CARD_GAP = 6;     // minimum horizontal gap between cards in same row

// Row definitions (index 0-5):
//   0 = above-near, 1 = above-mid, 2 = above-far
//   3 = below-near, 4 = below-mid, 5 = below-far
// topOffset is relative to centerY (the timeline line Y)
// connLen is the distance from card edge to the timeline line
const ROW_CONFIGS = [
  { topOffset: -(NEAR_GAP + CARD_HEIGHT),                                   connLen: NEAR_GAP,                              above: true  },
  { topOffset: -(NEAR_GAP + 2*CARD_HEIGHT +   BETWEEN_GAP),                 connLen: NEAR_GAP + CARD_HEIGHT + BETWEEN_GAP,  above: true  },
  { topOffset: -(NEAR_GAP + 3*CARD_HEIGHT + 2*BETWEEN_GAP),                 connLen: NEAR_GAP + 2*(CARD_HEIGHT+BETWEEN_GAP),above: true  },
  { topOffset:  NEAR_GAP,                                                   connLen: NEAR_GAP,                              above: false },
  { topOffset:  NEAR_GAP + CARD_HEIGHT +   BETWEEN_GAP,                     connLen: NEAR_GAP + CARD_HEIGHT + BETWEEN_GAP,  above: false },
  { topOffset:  NEAR_GAP + 2*CARD_HEIGHT + 2*BETWEEN_GAP,                   connLen: NEAR_GAP + 2*(CARD_HEIGHT+BETWEEN_GAP),above: false },
];

const IMPORTANCE_COLORS = {
  1: '#b71c1c',  // deep red    – most important
  2: '#e65100',  // deep orange
  3: '#1b5e20',  // dark green
  4: '#0d47a1',  // dark blue
  5: '#616161',  // gray        – least important
};

export class Renderer {
  constructor(timeline, track, eventsContainer, yearMarkersEl) {
    this.timeline        = timeline;
    this.track           = track;
    this.eventsContainer = eventsContainer;
    this.yearMarkersEl   = yearMarkersEl;

    /** @type {Map<number, HTMLElement>} */
    this.activeCards       = new Map();
    this.activeYearMarkers = new Map();
    this.visibleCount      = 0;
  }

  render() {
    const tl      = this.timeline;
    const centerY = window.innerHeight / 2;

    const { leftDays, rightDays } = tl.getViewportDays();
    const marginDays = MARGIN / tl.pixelsPerDay;
    const viewLeft   = leftDays  - marginDays;
    const viewRight  = rightDays + marginDays;
    const maxImp     = tl.visibleImportance;

    // Update track dimensions and position
    this.track.style.width     = `${tl.trackWidth}px`;
    this.track.style.transform = `translateX(${-tl.scrollX}px)`;

    // Collect visible events (sorted by date – events array is already sorted)
    const visibleEvents = [];
    for (const event of tl.events) {
      if (event.days < viewLeft)  continue;
      if (event.days > viewRight) break;
      if (event.importance > maxImp) continue;              // zoom filter
      if (!tl.manualLevels.has(event.importance)) continue; // checkbox filter
      visibleEvents.push(event);
    }

    // Greedy row assignment: for each event (in date order) pick the first
    // row where the card doesn't overlap with the previous card in that row.
    const rowRightEdge = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
    for (const event of visibleEvents) {
      const x = tl.dateToX(event.days);
      let row = -1;
      for (let r = 0; r < 6; r++) {
        if (x >= rowRightEdge[r] + MIN_CARD_GAP) {
          row = r;
          break;
        }
      }
      if (row === -1) row = 0; // fallback: accept overlap in row 0
      rowRightEdge[row] = x + CARD_WIDTH;
      event._row = row;
    }

    // Which card IDs should be in DOM
    const shouldExist = new Set();

    for (const event of visibleEvents) {
      shouldExist.add(event.id);
      const x      = tl.dateToX(event.days);
      const cfg    = ROW_CONFIGS[event._row];
      const rowTop = centerY + cfg.topOffset;

      let card = this.activeCards.get(event.id);

      // Re-create card if row changed (connector length differs)
      if (card && parseInt(card.dataset.row) !== event._row) {
        card.remove();
        card = null;
      }

      if (!card) {
        card = this.createCard(event, cfg);
        this.activeCards.set(event.id, card);
        this.eventsContainer.appendChild(card);
        card.offsetHeight; // trigger reflow for transition
      }

      card.style.left = `${x}px`;
      card.style.top  = `${rowTop}px`;

      if (!card.classList.contains('visible')) {
        card.classList.add('visible');
      }
    }

    this.visibleCount = visibleEvents.length;

    // Remove cards no longer in view
    for (const [id, card] of this.activeCards) {
      if (!shouldExist.has(id)) {
        card.remove();
        this.activeCards.delete(id);
      }
    }

    this.renderYearMarkers(viewLeft, viewRight, centerY);
  }

  createCard(event, cfg) {
    const color = IMPORTANCE_COLORS[event.importance];

    const card = document.createElement('div');
    card.className = `event-card importance-${event.importance}`;
    card.dataset.id  = event.id;
    card.dataset.row = event._row;
    card.style.setProperty('--imp-color', color);

    // Date label
    const dateEl = document.createElement('div');
    dateEl.className   = 'event-date';
    dateEl.textContent = formatDate(event.date, event.dateGranularity);

    // Text
    const textEl = document.createElement('div');
    textEl.className   = 'event-text';
    textEl.textContent = event.shortText || event.text;

    // Connector line from card edge to timeline
    const conn = document.createElement('div');
    conn.className = cfg.above ? 'connector connector-above' : 'connector connector-below';
    conn.style.height = `${cfg.connLen}px`;
    conn.style.left   = `${CONN_LEFT}px`;

    card.appendChild(dateEl);
    card.appendChild(textEl);
    card.appendChild(conn);

    return card;
  }

  renderYearMarkers(viewLeftDays, viewRightDays, centerY) {
    const tl    = this.timeline;
    const EPOCH = new Date(1900, 0, 1);

    // Choose year interval based on zoom
    let yearInterval = 10;
    if (tl.pixelsPerDay > 0.05) yearInterval = 5;
    if (tl.pixelsPerDay > 0.2)  yearInterval = 1;

    const startYear = Math.floor((1900 + viewLeftDays  / 365.25) / yearInterval) * yearInterval;
    const endYear   = Math.ceil( (1900 + viewRightDays / 365.25) / yearInterval) * yearInterval;

    const shouldExist = new Set();

    for (let year = startYear; year <= endYear; year += yearInterval) {
      if (year < 1965 || year > 2020) continue;
      shouldExist.add(year);

      const yearDate = new Date(year, 0, 1);
      const days     = Math.floor((yearDate - EPOCH) / 86400000);
      const x        = tl.dateToX(days);

      let marker = this.activeYearMarkers.get(year);
      if (!marker) {
        marker = document.createElement('div');
        marker.className   = 'year-marker';
        marker.textContent = year;
        this.yearMarkersEl.appendChild(marker);
        this.activeYearMarkers.set(year, marker);
      }
      marker.style.left = `${x}px`;
      marker.style.top  = `${centerY - 9}px`; // centered on 18px line
    }

    // Remove out-of-range markers
    for (const [year, marker] of this.activeYearMarkers) {
      if (!shouldExist.has(year)) {
        marker.remove();
        this.activeYearMarkers.delete(year);
      }
    }
  }
}
