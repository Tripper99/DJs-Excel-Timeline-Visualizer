/**
 * Load and preprocess timeline event data.
 */

const EPOCH = new Date(1940, 0, 1); // 1940-01-01
const MS_PER_DAY = 86400000;

/**
 * Convert a date string (YYYY-MM-DD) to days since epoch.
 */
function dateToDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Math.floor((dt - EPOCH) / MS_PER_DAY);
}

/**
 * Format a date string based on granularity.
 */
export function formatDate(dateStr, granularity) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);

  if (granularity === 'year') {
    return `${y}`;
  }
  if (granularity === 'month') {
    return dt.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
  }
  return dt.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Fetch and preprocess events.json.
 * Adds `days` (days since epoch) to each event.
 */
export async function loadEvents() {
  const resp = await fetch('data/events.json');
  if (!resp.ok) {
    throw new Error(`Failed to load events.json: ${resp.status}`);
  }
  const data = await resp.json();

  for (const event of data.events) {
    event.days = dateToDays(event.date);
  }

  return data;
}
