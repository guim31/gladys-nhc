// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The three basins of the National Hurricane Center (Miami, and Honolulu for
// the central Pacific). `key` is the stable word of the manifest, the device
// and the scene triggers; `feed` the suffix of its RSS feed (index-at.xml);
// `prefix` the start of the ATCF id of its storms (al132025, cp042026).
export const BASINS = [
  { key: 'atlantic', feed: 'at', prefix: 'al' },
  { key: 'eastern_pacific', feed: 'ep', prefix: 'ep' },
  { key: 'central_pacific', feed: 'cp', prefix: 'cp' },
];
export const BASIN_KEYS = BASINS.map((basin) => basin.key);

// Radius around the home, in the chosen unit (miles or kilometres). A
// tropical storm wind field is often 300 miles wide: no small radius.
export const RADII = ['100', '200', '300', '500', '1000'];

// Which storms the triggers "new named storm", "category raised" and "watch or
// warning" speak about: every storm of the followed basins, or only those
// within the radius.
export const TRIGGER_SCOPES = ['basins', 'radius'];

export const UNITS = ['imperial', 'metric'];

// Minutes between two readings. The NHC issues an advisory every 6 hours
// (every 3 hours when coastal watches are up) and its outlook 4 times a day:
// faster would only ask the same thing again.
export const REFRESH_INTERVALS = ['10', '15', '30', '60'];

export const DEFAULT_CONFIG = {
  latitude: '',
  longitude: '',
  basins: BASIN_KEYS,
  radius: '300',
  trigger_scope: 'basins',
  units: 'imperial',
  refresh_interval: '15',
  language: 'fr',
};

/** A coordinate typed by the user (decimal comma accepted), null if blank or invalid. */
export function parseCoordinate(value, limit) {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

function basins(value) {
  // A multi_select is stored as an array; an unset field keeps the default.
  if (!Array.isArray(value)) {
    return [...BASIN_KEYS];
  }
  return BASIN_KEYS.filter((key) => value.includes(key));
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const latitude = parseCoordinate(source.latitude, 90);
  const longitude = parseCoordinate(source.longitude, 180);
  // Both or none: half a centre falls back on the house.
  const center = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const typed = String(source.latitude ?? '').trim() + String(source.longitude ?? '').trim();
  return {
    center,
    // Something was typed but is not a pair of coordinates: said once in the logs.
    invalidCenter: center === null && typed !== '',
    basins: basins(source.basins),
    radius: pick(source.radius, RADII, DEFAULT_CONFIG.radius),
    triggerScope: TRIGGER_SCOPES.includes(source.trigger_scope)
      ? source.trigger_scope
      : DEFAULT_CONFIG.trigger_scope,
    units: UNITS.includes(source.units) ? source.units : DEFAULT_CONFIG.units,
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
