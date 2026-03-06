# Timeline App - TODO

## Setup (before testing)
- [ ] Place Excel file at `data/events.xlsx` (columns: Datum, Haendelse, Viktighet)
- [ ] Create venv: `python3 -m venv venv && source venv/bin/activate && pip install openpyxl`

## Test Plan
- [ ] Run `python3 convert.py` - verify JSON output in `data/events.json`
  - Check event count and date range in summary
  - Verify importance distribution looks correct
  - Spot-check a few events in the JSON for correct date parsing
- [ ] Start `python3 -m http.server 8000` and open `http://localhost:8000`
- [ ] Verify timeline renders with events visible
- [ ] Test zoom in/out (ctrl+scroll / pinch) - events should fade in/out by importance
- [ ] Test scroll/pan (normal scroll) - should be smooth and responsive
- [ ] Check overlap handling at dense date periods (e.g. WWII years)
- [ ] Verify year markers appear and update with zoom level
- [ ] Verify HUD shows correct zoom level, date, and event count
- [ ] Test trackpad gestures (pinch zoom, two-finger scroll)
- [ ] Check that importance-based typography is correct (size, weight, opacity)
- [ ] Verify date display matches granularity ("1945" vs "jul 1969" vs "20 jul 1969")

## Polish (after initial testing)
- [ ] Fine-tune zoom thresholds if needed
- [ ] Adjust overlap spacing if cards stack poorly
- [ ] Performance check with full ~2000 events
- [ ] Run Ruff on convert.py after any changes
