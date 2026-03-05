/**
 * Zoom/pan engine. Manages pixelsPerDay, scrollY, and coordinate transforms.
 */

const MIN_PPD = 0.005;
const MAX_PPD = 20.0;

// Zoom thresholds: [minPPD, maxPPD, maxImportance]
const ZOOM_THRESHOLDS = [
  [0.005, 0.02, 1],
  [0.02, 0.08, 2],
  [0.08, 0.3, 3],
  [0.3, 1.5, 4],
  [1.5, 20.0, 5],
];

export class Timeline {
  constructor(events, containerHeight) {
    this.events = events;
    this.containerHeight = containerHeight;
    this.pixelsPerDay = 0.02; // Start zoomed out
    this.scrollY = 0;
    this._dirty = true;

    // Compute data bounds
    if (events.length > 0) {
      this.minDays = events[0].days;
      this.maxDays = events[events.length - 1].days;
    } else {
      this.minDays = 0;
      this.maxDays = 1;
    }
  }

  /** Convert days-since-epoch to Y pixel position (in track space). */
  dateToY(days) {
    return days * this.pixelsPerDay;
  }

  /** Convert Y pixel position to days-since-epoch. */
  yToDays(y) {
    return y / this.pixelsPerDay;
  }

  /** Total height of the timeline track in pixels. */
  get trackHeight() {
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

  /** Check if an event should be visible at current zoom. */
  isVisible(event) {
    return event.importance <= this.visibleImportance;
  }

  /** Get viewport bounds in days. */
  getViewportDays() {
    const topDays = this.yToDays(this.scrollY);
    const bottomDays = this.yToDays(this.scrollY + this.containerHeight);
    return { topDays, bottomDays };
  }

  /** Get the center date of viewport as a readable string. */
  getViewportCenterDate() {
    const centerDays = this.yToDays(this.scrollY + this.containerHeight / 2);
    const epoch = new Date(1940, 0, 1);
    const d = new Date(epoch.getTime() + centerDays * 86400000);
    return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
  }

  /** Zoom centered on a focal Y point (in viewport coords). */
  zoom(factor, focalViewportY) {
    const focalTrackY = this.scrollY + focalViewportY;
    const focalDays = this.yToDays(focalTrackY);

    const newPPD = Math.max(MIN_PPD, Math.min(MAX_PPD, this.pixelsPerDay * factor));
    if (newPPD === this.pixelsPerDay) return;

    this.pixelsPerDay = newPPD;

    // Keep focal point stationary
    const newFocalTrackY = focalDays * this.pixelsPerDay;
    this.scrollY = newFocalTrackY - focalViewportY;

    this.clampScroll();
    this._dirty = true;
  }

  /** Pan by delta pixels. */
  pan(deltaY) {
    this.scrollY += deltaY;
    this.clampScroll();
    this._dirty = true;
  }

  /** Clamp scroll so we don't go past data bounds. */
  clampScroll() {
    const minScroll = this.minDays * this.pixelsPerDay - this.containerHeight * 0.1;
    const maxScroll = this.maxDays * this.pixelsPerDay - this.containerHeight * 0.5;
    this.scrollY = Math.max(minScroll, Math.min(maxScroll, this.scrollY));
  }

  /** Check and reset dirty flag. */
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
