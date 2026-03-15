# Development History - Timeline App

## v0.1.0 (2026-03-06)

### Initial project scaffold
Created complete project structure with all core files:

**Python converter (`convert.py`)**
- Reads Excel via openpyxl with columns: Datum, Haendelse, Viktighet
- Handles multiple date formats: datetime objects, YYYY-MM-DD strings, YYYY-MM strings, YYYY strings, integer years
- Assigns `dateGranularity` ("day"/"month"/"year") per event
- Year-only dates get midpoint July 1, month-only get day 15
- Validates and clamps importance to 1-5 (default 3), skips rows without date/text
- Outputs sorted JSON to `data/events.json` with metadata

**HTML/CSS (`index.html`, `css/style.css`)**
- Vertical timeline centered on page with 2px line
- Event cards alternate left/right with connector dots on the line
- Importance-based typography: 1 (18px bold) through 5 (13px light, 0.7 opacity)
- Year-only events get dashed border styling
- Fade-in/slide-in CSS transitions (0.3s)
- HUD overlay showing zoom level, current date, and visible event count
- Scroll hint at bottom of screen

**Data loading (`js/data.js`)**
- Fetches `data/events.json`
- Converts dates to `daysSinceEpoch` (epoch = 1940-01-01)
- Formats dates based on granularity for display

**Zoom/pan engine (`js/timeline.js`)**
- State managed via `pixelsPerDay` (range 0.005-20.0) and `scrollY`
- Focal-point zoom: date under cursor stays stationary during zoom
- Importance filtering tied to zoom thresholds:
  - 0.005-0.02 ppd: only importance 1
  - 0.02-0.08: importance 1-2
  - 0.08-0.3: importance 1-3
  - 0.3-1.5: importance 1-4
  - 1.5-20.0: all events
- Scroll clamping to prevent scrolling past data bounds

**Renderer (`js/renderer.js`)**
- Viewport culling with 300px margin
- Card creation/recycling via Map<id, HTMLElement>
- Per-side overlap handling (pushes colliding cards down)
- Year markers with dynamic interval (10/5/1 year) based on zoom
- Cards animate out and get removed from DOM after transition

**App init (`js/app.js`)**
- Loads data, creates Timeline and Renderer instances
- Wheel event: normal scroll = pan, ctrl+scroll = zoom
- Touch support: single finger pan, pinch zoom
- requestAnimationFrame render loop (only renders on state change)
- HUD updates with zoom level label, center date, visible count

**Project config**
- `.gitignore`: excludes `__pycache__`, `.DS_Store`, `data/events.xlsx`
- `requirements.txt`: openpyxl
- Ruff check passed clean on `convert.py`
- Ruff installed via Homebrew during setup

### Status
All code written, not yet tested with real Excel data. See `TODO.md` for test plan.

---

## v0.2.0–v0.3.0 (2026-03-06)

- Switched from vertical to horizontal timeline layout
- Events placed in 6 rows (3 above, 3 below the center line)
- Color-coded event cards by importance level
- Adjusted starting zoom and importance thresholds

---

## v0.4.0 (2026-03-15)

### GitHub repo, Excel column changes, HUD redesign, importance checkboxes

**GitHub**
- Created public repo: `Tripper99/DJs-Excel-Timeline-Visualizer`
- `.gitignore` updated to exclude entire `data/` folder and `.claude/`

**`convert.py`**
- Switched from hardcoded column indices to header-based lookup (reads row 1)
- Added `Event_short` column → output field `shortText` in JSON
- Rows with `Viktighet == 0` are now skipped (previously clamped to 1)

**`js/renderer.js`**
- Cards display `event.shortText` (falls back to `event.text` if empty)
- Added manual importance filter: `!tl.manualLevels.has(event.importance)`

**`js/timeline.js`**
- Added `manualLevels = new Set([1,2,3,4,5])` — checkbox override, all on by default

**`index.html` / `css/style.css`**
- HUD redesigned as full-width single-line bar pinned to top of screen
- Added 5 importance checkboxes (1–5) with per-importance colors
- Checkboxes AND zoom rules both apply (AND logic): unchecking hides a level even if zoom allows it

**`js/app.js`**
- `setupImportanceCheckboxes()` wires checkbox changes to `timeline.manualLevels`

---

## v0.5.0 (2026-03-15)

### Momentum scrolling (velocity + friction)
- Added `velocity` variable; wheel events accumulate into it
- rAF loop applies velocity then multiplies by `FRICTION=0.88` each frame
- Zoom resets velocity to 0

*Note: Still moved in discrete ticks — replaced in v0.7.0*

---

## v0.6.0 (2026-03-15)

### Thicker timeline line with decade-colored segments
- `#timeline-line` replaced by `#year-segments` container
- 56 individual divs (1965–2020), each 8px tall, colored by decade
- Segments built once in constructor, position updated each render frame

---

## v0.7.0 (2026-03-15)

### Lerp-based smooth scrolling (replaces velocity/friction)
- Root cause of ticking: velocity was applied as a full-size jump each frame
- Fix: `targetScrollX` accumulates wheel deltas; actual `scrollX` eases 12% of remaining distance per frame
- Zoom syncs `targetScrollX` to prevent lerp fighting new zoom position
- Boundary wall detection: if scroll hits clamp, `targetScrollX` is snapped to current position
- Tuning constant: `EASE = 0.12` (lower = floatier, higher = snappier)

---

## v0.8.0 (2026-03-15)

### Zoom-scaled line thickness + alternating year colors
- Line thickness scales log-linearly: 8px (min zoom) → 40px (max zoom), updated every frame
- Decade colors removed; replaced with two alternating colors by `year % 2`:
  - Even years: `#5b8db8` (steel blue)
  - Odd years: `#b8885b` (warm amber)
- No two adjacent year segments share a color

---

## v0.9.0 (2026-03-15)

### Swedish month markers + clickable dots to bring cards to front

**Month markers (`renderer.js`, `style.css`, `index.html`)**
- Added `#month-markers` container div to `index.html`
- New `renderMonthMarkers()` method in Renderer, called from `render()`
- Appears when `pixelsPerDay >= 1.5` (the "Days" HUD level); clears on zoom out
- Swedish abbreviated names: jan, feb, mar, apr, maj, jun, jul, aug, sep, okt, nov, dec
- Positioned 14px below centerY (below the timeline line)
- Styled as italic to visually distinguish from bold year markers

**Clickable connector dots (`renderer.js`, `style.css`)**
- Replaced `::after` pseudo-element dot with real `<div class="connector-dot">`
- Dot is clickable: calls `bringToFront(event.id)` on click
- `bringToFront()`: sets `z-index: 20` + `.pinned` class on clicked card; unpins previous
- Clicking same dot again toggles off (unpins)
- `.event-card.pinned`: stronger box-shadow + colored outline to signal elevated card
- Dot hover: `scale(1.5)` + subtle ring for discoverability

**Gap increase (`renderer.js`)**
- `NEAR_GAP` increased from 24px → 54px for more breathing room between cards and timeline

---

## v0.9.2 (2026-03-15)

### Category-based card colors

**`convert.py`**
- Reads two new columns: `Kategori` and `Underkategori`
- Outputs `kategori` and `underkategori` string fields in each event JSON object
- Warns (non-fatal) if either column is missing in the spreadsheet

**`js/renderer.js`**
- `createCard()` checks category fields with case-insensitive substring match
- `underkategori` containing "vallning" → class `card-vallning` (overrides all)
- `kategori` containing "förhör" → class `card-forhor`

**`css/style.css`**
- `.card-forhor`: pale yellow background (`#fff9c4`), amber border + date color
- `.card-vallning`: dark green background (`#1b5e20`), white text on date and body

---

## v0.9.3 (2026-03-15)

### Month marker visibility improvement
- Font size 9px → 12px, weight 400 → 600, color `#aaa` → `#555`
- Added semi-transparent background pill (`rgba(240,237,232,0.85)`) with padding and border-radius
- Markers now clearly legible over the colored timeline segments
