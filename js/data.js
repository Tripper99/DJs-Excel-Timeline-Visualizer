/**
 * Load and preprocess timeline event data.
 */

const EPOCH = new Date(1900, 0, 1); // 1900-01-01
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

const START_DATE = new Date(1965, 0, 1);   // 1965-01-01
const END_DATE   = new Date(2020, 11, 31);  // 2020-12-31
const START_DAYS = Math.floor((START_DATE - EPOCH) / MS_PER_DAY);
const END_DAYS   = Math.floor((END_DATE   - EPOCH) / MS_PER_DAY);

/**
 * Fetch and preprocess events.json.
 * Adds `days` (days since 1900-01-01) to each event.
 * Filters events to 1965-01-01 – 2020-12-31.
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

  data.events = data.events.filter(e => e.days >= START_DAYS && e.days <= END_DAYS);
  data.metadata.totalEvents = data.events.length;

  return data;
}
