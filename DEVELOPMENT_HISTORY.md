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
