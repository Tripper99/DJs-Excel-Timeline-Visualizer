/**
 * Horizontal zoom/pan engine.
 * Manages pixelsPerDay, scrollX, and coordinate transforms.
 */

const MIN_PPD = 0.005;
const MAX_PPD = 20.0;

// Zoom thresholds: [minPPD, maxPPD, maxImportance]
const ZOOM_THRESHOLDS = [
  [0.005, 0.08,  1],  // up to 0.08: importance 1 only
  [0.08,  0.3,   2],
  [0.3,   1.0,   3],
  [1.0,   4.0,   4],
  [4.0,   20.0,  5],
];

const EPOCH = new Date(1900, 0, 1);

export class Timeline {
  constructor(events, containerWidth) {
    this.events = events;
    this.containerWidth = containerWidth;
    this._dirty = true;

    if (events.length > 0) {
      this.minDays = events[0].days;
      this.maxDays = events[events.length - 1].days;
    } else {
      this.minDays = 0;
      this.maxDays = 1;
    }

    const range = this.maxDays - this.minDays;
    this.pixelsPerDay = 0.075;  // starting zoom: shows importance 1 only
    this.manualLevels = new Set([1, 2, 3, 4, 5]); // checkbox override (all on by default)

    // Start scrolled so the timeline is centered
    const totalWidth = range * this.pixelsPerDay;
    this.scrollX = this.minDays * this.pixelsPerDay - (containerWidth - totalWidth) / 2;
    this.clampScroll();
  }

  /** Convert days-since-epoch to X pixel position (track space). */
  dateToX(days) {
    return days * this.pixelsPerDay;
  }

  /** Convert X pixel position to days-since-epoch. */
  xToDays(x) {
    return x / this.pixelsPerDay;
  }

  /** Total width of the timeline track in pixels. */
  get trackWidth() {
    return (this.maxDays + 365) * this.pixelsPerDay;
  }

  /** Get the max importance level visible at current zoom. */
  get visibleImportance() {
    for (const [minPPD, maxPPD, maxImp] of ZOOM_THRESHOLDS) {
      if (this.pixelsPerDay >= minPPD && this.pixelsPerDay < maxPPD) {
        return maxImp;
      }
    }
    return 5;
  }

  /** Get viewport bounds in days. */
  getViewportDays() {
    const leftDays  = this.xToDays(this.scrollX);
    const rightDays = this.xToDays(this.scrollX + this.containerWidth);
    return { leftDays, rightDays };
  }

  /** Get the center date of viewport as a readable string. */
  getViewportCenterDate() {
    const centerDays = this.xToDays(this.scrollX + this.containerWidth / 2);
    const d = new Date(EPOCH.getTime() + centerDays * 86400000);
    return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
  }

  /** Zoom centered on a focal X point (in viewport coords). */
  zoom(factor, focalViewportX) {
    const focalTrackX = this.scrollX + focalViewportX;
    const focalDays   = this.xToDays(focalTrackX);

    const newPPD = Math.max(MIN_PPD, Math.min(MAX_PPD, this.pixelsPerDay * factor));
    if (newPPD === this.pixelsPerDay) return;

    this.pixelsPerDay = newPPD;
    this.scrollX = focalDays * this.pixelsPerDay - focalViewportX;

    this.clampScroll();
    this._dirty = true;
  }

  /** Pan by delta pixels (horizontal). */
  pan(deltaX) {
    this.scrollX += deltaX;
    this.clampScroll();
    this._dirty = true;
  }

  /** Clamp scroll so we don't go past data bounds. */
  clampScroll() {
    const minScroll = this.minDays * this.pixelsPerDay - this.containerWidth * 0.15;
    const maxScroll = this.maxDays * this.pixelsPerDay - this.containerWidth * 0.5;
    this.scrollX = Math.max(minScroll, Math.min(maxScroll, this.scrollX));
  }

  consumeDirty() {
    if (this._dirty) {
      this._dirty = false;
      return true;
    }
    return false;
  }

  markDirty() {
    this._dirty = true;
  }
}
