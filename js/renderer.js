/**
 * Horizontal timeline renderer.
 * Four event rows (2 above, 2 below), connector lines, color-coded by importance.
 */

import { formatDate } from './data.js';

const MARGIN       = 400;   // px outside viewport to keep rendered
const CARD_WIDTH   = 180;   // fixed card width in px
const CARD_HEIGHT  = 85;    // fixed card height in px
const NEAR_GAP     = 54;    // px from timeline to nearest row card edge
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

const YEAR_COLORS   = ['#5b8db8', '#b8885b']; // alternating: even / odd year
const LOG_MIN_PPD   = Math.log(0.005);
const LOG_MAX_PPD   = Math.log(20.0);
const MIN_THICKNESS = 8;
const MAX_THICKNESS = 40;

const SEGMENT_START_YEAR = 1965;
const SEGMENT_END_YEAR   = 2020;

const MONTH_THRESHOLD = 1.5; // pixelsPerDay at which month labels appear
const SWEDISH_MONTHS  = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];

export class Renderer {
  constructor(timeline, track, eventsContainer, yearMarkersEl, monthMarkersEl, yearSegmentsEl) {
    this.timeline        = timeline;
    this.track           = track;
    this.eventsContainer = eventsContainer;
    this.yearMarkersEl   = yearMarkersEl;
    this.monthMarkersEl  = monthMarkersEl;
    this.yearSegmentsEl  = yearSegmentsEl;

    /** @type {Map<number, HTMLElement>} */
    this.activeCards        = new Map();
    this.activeYearMarkers  = new Map();
    this.activeMonthMarkers = new Map(); // key: "YYYY-MM"
    this.yearSegments       = new Map(); // year → segment div (created once)
    this.visibleCount       = 0;

    this.pinnedCardId = null; // id of card brought to front by dot click

    this._buildYearSegments();
  }

  _buildYearSegments() {
    for (let year = SEGMENT_START_YEAR; year <= SEGMENT_END_YEAR; year++) {
      const seg = document.createElement('div');
      seg.className = 'year-segment';
      seg.style.backgroundColor = YEAR_COLORS[year % 2];
      this.yearSegmentsEl.appendChild(seg);
      this.yearSegments.set(year, seg);
    }
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

      // Re-apply pinned state if this is the pinned card
      if (event.id === this.pinnedCardId) {
        card.classList.add('pinned');
        card.style.zIndex = '20';
      }

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

    this.renderYearSegments(centerY);
    this.renderYearMarkers(viewLeft, viewRight, centerY);
    this.renderMonthMarkers(viewLeft, viewRight, centerY);
  }

  renderYearSegments(centerY) {
    const tl    = this.timeline;
    const EPOCH = new Date(1900, 0, 1);

    // Thickness scales log-linearly from MIN_THICKNESS (min zoom) to MAX_THICKNESS (max zoom)
    const t         = (Math.log(tl.pixelsPerDay) - LOG_MIN_PPD) / (LOG_MAX_PPD - LOG_MIN_PPD);
    const thickness = Math.round(MIN_THICKNESS + Math.max(0, Math.min(1, t)) * (MAX_THICKNESS - MIN_THICKNESS));
    const top       = centerY - thickness / 2;

    for (let year = SEGMENT_START_YEAR; year <= SEGMENT_END_YEAR; year++) {
      const seg      = this.yearSegments.get(year);
      const days     = Math.floor((new Date(year,     0, 1) - EPOCH) / 86400000);
      const nextDays = Math.floor((new Date(year + 1, 0, 1) - EPOCH) / 86400000);
      const x        = tl.dateToX(days);
      const width    = tl.dateToX(nextDays) - x;

      seg.style.left   = `${x}px`;
      seg.style.width  = `${width}px`;
      seg.style.top    = `${top}px`;
      seg.style.height = `${thickness}px`;
    }
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

    // Clickable dot at the timeline end of the connector
    const dot = document.createElement('div');
    dot.className = 'connector-dot';
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bringToFront(event.id);
    });
    conn.appendChild(dot);

    card.appendChild(dateEl);
    card.appendChild(textEl);
    card.appendChild(conn);

    return card;
  }

  bringToFront(id) {
    // Clear previous pinned card
    if (this.pinnedCardId !== null && this.pinnedCardId !== id) {
      const prev = this.activeCards.get(this.pinnedCardId);
      if (prev) {
        prev.classList.remove('pinned');
        prev.style.zIndex = '';
      }
    }

    // Toggle off if clicking the same dot again
    if (this.pinnedCardId === id) {
      const card = this.activeCards.get(id);
      if (card) {
        card.classList.remove('pinned');
        card.style.zIndex = '';
      }
      this.pinnedCardId = null;
      return;
    }

    const card = this.activeCards.get(id);
    if (card) {
      card.classList.add('pinned');
      card.style.zIndex = '20';
    }
    this.pinnedCardId = id;
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

  renderMonthMarkers(viewLeftDays, viewRightDays, centerY) {
    const tl    = this.timeline;
    const EPOCH = new Date(1900, 0, 1);

    // Remove all month markers when below threshold
    if (tl.pixelsPerDay < MONTH_THRESHOLD) {
      for (const [, marker] of this.activeMonthMarkers) {
        marker.remove();
      }
      this.activeMonthMarkers.clear();
      return;
    }

    // Convert day bounds to Date objects to find visible year/month range
    const dateLeft  = new Date(EPOCH.getTime() + viewLeftDays  * 86400000);
    const dateRight = new Date(EPOCH.getTime() + viewRightDays * 86400000);

    const startYear  = dateLeft.getFullYear();
    const startMonth = dateLeft.getMonth();      // 0-based
    const endYear    = dateRight.getFullYear();
    const endMonth   = dateRight.getMonth();

    const shouldExist = new Set();

    for (let y = startYear; y <= endYear; y++) {
      const mStart = (y === startYear) ? startMonth : 0;
      const mEnd   = (y === endYear)   ? endMonth   : 11;

      for (let m = mStart; m <= mEnd; m++) {
        if (y < 1965 || y > 2020) continue;

        const key  = `${y}-${m}`;
        shouldExist.add(key);

        const monthDate = new Date(y, m, 1);
        const days      = Math.floor((monthDate - EPOCH) / 86400000);
        const x         = tl.dateToX(days);

        let marker = this.activeMonthMarkers.get(key);
        if (!marker) {
          marker = document.createElement('div');
          marker.className   = 'month-marker';
          marker.textContent = SWEDISH_MONTHS[m];
          this.monthMarkersEl.appendChild(marker);
          this.activeMonthMarkers.set(key, marker);
        }
        marker.style.left = `${x}px`;
        marker.style.top  = `${centerY + 14}px`; // below the timeline line
      }
    }

    // Remove out-of-view markers
    for (const [key, marker] of this.activeMonthMarkers) {
      if (!shouldExist.has(key)) {
        marker.remove();
        this.activeMonthMarkers.delete(key);
      }
    }
  }
}
