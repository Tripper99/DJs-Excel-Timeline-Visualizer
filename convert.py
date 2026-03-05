"""Convert Excel timeline data to JSON format."""

import json
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl


def parse_date(value):
    """Parse a date value from Excel into (date_string, granularity).

    Returns (None, None) if unparseable.
    """
    if value is None:
        return None, None

    # datetime or date object from Excel
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d"), "day"
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d"), "day"

    # Integer year (e.g. 1945)
    if isinstance(value, (int, float)):
        year = int(value)
        if 1000 <= year <= 2100:
            return f"{year}-07-01", "year"
        return None, None

    # String parsing
    s = str(value).strip()
    if not s:
        return None, None

    # Try YYYY-MM-DD
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d"), "day"
    except ValueError:
        pass

    # Try YYYY-MM
    try:
        dt = datetime.strptime(s, "%Y-%m")
        return dt.strftime("%Y-%m-15"), "month"
    except ValueError:
        pass

    # Try YYYY
    try:
        year = int(s)
        if 1000 <= year <= 2100:
            return f"{year}-07-01", "year"
    except ValueError:
        pass

    return None, None


def clamp_importance(value):
    """Return importance clamped to 1-5, default 3."""
    if value is None:
        return 3
    try:
        v = int(value)
        return max(1, min(5, v))
    except (ValueError, TypeError):
        return 3


def convert(input_path="data/events.xlsx", output_path="data/events.json"):
    """Read Excel and write JSON."""
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        print(f"Error: {input_path} not found.")
        sys.exit(1)

    wb = openpyxl.load_workbook(input_path, read_only=True)
    ws = wb.active

    events = []
    skipped = 0
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    for row in rows:
        if len(row) < 2:
            skipped += 1
            continue

        raw_date = row[0]
        text = row[1]
        importance = row[2] if len(row) > 2 else None

        if not text or not str(text).strip():
            skipped += 1
            continue

        date_str, granularity = parse_date(raw_date)
        if date_str is None:
            skipped += 1
            continue

        events.append({
            "date": date_str,
            "dateGranularity": granularity,
            "text": str(text).strip(),
            "importance": clamp_importance(importance),
        })

    wb.close()

    # Sort chronologically
    events.sort(key=lambda e: e["date"])

    # Assign IDs
    for i, event in enumerate(events):
        event["id"] = i

    # Build output
    output = {
        "metadata": {
            "totalEvents": len(events),
            "dateRange": {
                "start": events[0]["date"] if events else "",
                "end": events[-1]["date"] if events else "",
            },
        },
        "events": events,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Summary
    print(f"Converted {len(events)} events ({skipped} rows skipped)")
    print(f"Date range: {output['metadata']['dateRange']['start']} to {output['metadata']['dateRange']['end']}")

    importance_counts = {}
    for e in events:
        imp = e["importance"]
        importance_counts[imp] = importance_counts.get(imp, 0) + 1
    for imp in sorted(importance_counts):
        print(f"  Importance {imp}: {importance_counts[imp]} events")

    print(f"Output: {output_path}")


if __name__ == "__main__":
    convert()
