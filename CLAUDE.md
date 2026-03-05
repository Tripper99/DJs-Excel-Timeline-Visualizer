# Timeline App

## Project Overview
A local, web-based timeline app that visualizes ~2000 historical events (1940-2020) from an Excel file. Vertical scrollable timeline with zoom functionality where event importance (1-5) controls visibility at different zoom levels.

## Version
0.1.0

## Architecture
- **convert.py**: Python Excel-to-JSON converter (openpyxl)
- **index.html**: Entry point
- **js/data.js**: Load and preprocess JSON data
- **js/timeline.js**: Zoom/pan engine, position calculations
- **js/renderer.js**: DOM management, viewport culling, overlap handling
- **js/app.js**: Init, event listeners, rAF loop
- **css/style.css**: All styling

## Running
1. Convert Excel: `python3 convert.py`
2. Serve: `python3 -m http.server 8000`
3. Open: `http://localhost:8000`

## Key Design Decisions
- Epoch: 1940-01-01 (all dates stored as daysSinceEpoch)
- Zoom via `pixelsPerDay` (range 0.005-20.0)
- Importance filtering tied to zoom level
- Viewport culling for performance
- Events alternate left/right of center timeline
