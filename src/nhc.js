// -----------------------------------------------------------------------------
// National Hurricane Center client: public products of NOAA, without key.
//
//   - https://www.nhc.noaa.gov/CurrentStorms.json: every active storm of the
//     three basins (classification, intensity in knots, pressure, position,
//     movement in mph, links to the advisories). `{ "activeStorms": [] }`
//     without storm;
//   - https://www.nhc.noaa.gov/index-{at,ep,cp}.xml: the RSS feed of one basin.
//     Its first item is the Tropical Weather Outlook (formation chance of each
//     disturbance through 48 hours and 7 days, as text lines), then, per
//     storm, the latest public advisory, whose "WATCHES AND WARNINGS" section
//     lists the coastal watches and warnings in effect.
//
// The gtwo_*.xml feeds of the outlook alone answer an HTML page (7/11/2026):
// the basin feed is the stable source. The XML is read with a few regular
// expressions on its fixed shape: no dependency for 3 tags.
// -----------------------------------------------------------------------------

import { BASINS } from './config.js';

export const NHC_SITE = 'https://www.nhc.noaa.gov';
export const STORMS_URL = `${NHC_SITE}/CurrentStorms.json`;
export const feedUrl = (basin) => `${NHC_SITE}/index-${basin.feed}.xml`;

// NOAA asks API clients to say who they are.
const HEADERS = { 'User-Agent': 'gladys-nhc (https://github.com/guim31/gladys-nhc)' };
const TIMEOUT_MS = 20000;

// Classifications of CurrentStorms.json. Only these three carry a name given
// from the list of the season; depressions and potential cyclones are numbered.
export const NAMED = ['TS', 'STS', 'HU'];

// Saffir-Simpson hurricane wind scale, lower bound of each category in knots.
const CATEGORY_KT = [64, 83, 96, 113, 137];

/** Saffir-Simpson category (1-5) of a hurricane, 0 below hurricane strength. */
export function categoryOf(classification, windKt) {
  if (classification !== 'HU' || !Number.isFinite(windKt)) {
    return 0;
  }
  return CATEGORY_KT.filter((kt) => windKt >= kt).length;
}

export class NhcError extends Error {}

async function get(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new NhcError(`${new URL(url).pathname}: ${err.message}`);
  }
  if (response.status !== 200) {
    throw new NhcError(`${new URL(url).pathname}: HTTP ${response.status}`);
  }
  return response.text();
}

const number = (value) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};
const time = (value) => {
  const t = Date.parse(value ?? '');
  return Number.isFinite(t) ? t : null;
};

/** One storm of CurrentStorms.json, normalized; null if it cannot be placed. */
export function parseStorm(raw) {
  const id = String(raw?.id ?? '').toLowerCase();
  const basin = BASINS.find((b) => id.startsWith(b.prefix));
  const latitude = number(raw?.latitudeNumeric);
  const longitude = number(raw?.longitudeNumeric);
  if (!/^[a-z]{2}\d{6}$/.test(id) || !basin || latitude === null || longitude === null) {
    return null;
  }
  const classification = String(raw.classification ?? '').toUpperCase();
  const windKt = number(raw.intensity);
  return {
    id,
    basin: basin.key,
    name: String(raw.name ?? '').trim() || id.toUpperCase(),
    classification,
    named: NAMED.includes(classification),
    windKt,
    category: categoryOf(classification, windKt),
    pressureMb: number(raw.pressure),
    latitude,
    longitude,
    movementDir: number(raw.movementDir),
    movementMph: number(raw.movementSpeed),
    updatedAt: time(raw.lastUpdate),
    advisoryNumber: String(raw.publicAdvisory?.advNum ?? '').replace(/^0+(?=\d)/, '') || null,
    advisoryUrl: raw.publicAdvisory?.url || null,
    graphicsUrl: raw.forecastGraphics?.url || null,
  };
}

/** The active storms of the three basins. */
export async function fetchStorms(fetchImpl) {
  const text = await get(fetchImpl, STORMS_URL);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new NhcError('CurrentStorms.json: not JSON');
  }
  if (!Array.isArray(body?.activeStorms)) {
    throw new NhcError('CurrentStorms.json: no activeStorms list');
  }
  return body.activeStorms.map(parseStorm).filter(Boolean);
}

// --- Basin feed --------------------------------------------------------------

const tag = (xml, name) => {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? match[1] : null;
};
const unwrap = (text) =>
  (text ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?pre>/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** Formation chances of an outlook text, the highest of its disturbances. */
export function parseOutlook(text) {
  const chances = (period) =>
    [
      ...text.matchAll(
        new RegExp(`Formation chance through ${period}\\.+\\w+\\.+(\\d+)\\s*percent`, 'gi'),
      ),
    ].map((match) => Number(match[1]));
  const in48h = chances('48 hours');
  const in7d = chances('7 days');
  return {
    // No disturbance ("Tropical cyclone formation is not expected"): 0 %.
    chance48h: Math.max(0, ...in48h),
    chance7d: Math.max(0, ...in7d),
    areas: Math.max(in48h.length, in7d.length),
  };
}

// Watches and warnings, strongest first.
export const WATCH_KINDS = [
  'hurricane_warning',
  'storm_surge_warning',
  'hurricane_watch',
  'storm_surge_watch',
  'tropical_storm_warning',
  'tropical_storm_watch',
];

/**
 * The watches and warnings in effect of a public advisory, as
 * `{ kind: [areas] }`; null when the advisory has no such section (unknown,
 * which fires nothing), `{}` when it says there is none.
 */
export function parseWatches(text) {
  const start = text.search(/^WATCHES AND WARNINGS\s*$/m);
  if (start < 0) {
    return null;
  }
  const end = text.slice(start).search(/^DISCUSSION AND OUTLOOK\s*$/m);
  const section = end < 0 ? text.slice(start) : text.slice(start, start + end);
  const lines = section.split('\n').map((line) => line.trim());
  const found = {};
  for (let i = 0; i < lines.length; i += 1) {
    const match =
      /^An? (Hurricane|Storm Surge|Tropical Storm) (Watch|Warning) is in effect for/i.exec(
        lines[i],
      );
    if (!match) {
      continue;
    }
    const kind = `${match[1]}_${match[2]}`.toLowerCase().replace(/ /g, '_');
    const areas = found[kind] ?? [];
    for (i += 1; i < lines.length && lines[i] !== ''; i += 1) {
      if (lines[i].startsWith('*')) {
        areas.push(lines[i].replace(/^\*\s*/, ''));
      } else if (areas.length > 0) {
        // A long area name wraps on the next line, without its star.
        areas[areas.length - 1] += ` ${lines[i]}`;
      }
    }
    found[kind] = areas.map((area) => area.replace(/\.$/, ''));
  }
  return found;
}

/** Outlook and latest public advisory per storm of one basin feed. */
export function parseFeed(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => ({
    title: unwrap(tag(match[1], 'title')).trim(),
    published: time(tag(match[1], 'pubDate')),
    text: unwrap(tag(match[1], 'description')),
  }));
  let outlook = null;
  const advisories = {};
  for (const item of items) {
    if (/Tropical Weather Outlook$/i.test(item.title)) {
      // A special outlook may sit next to the regular one: the newest wins.
      if (!outlook || (item.published ?? 0) > (outlook.issuedAt ?? 0)) {
        outlook = { issuedAt: item.published, ...parseOutlook(item.text) };
      }
      continue;
    }
    // "Public Advisory", "Intermediate Advisory", and the plain "Advisory" of a
    // Potential Tropical Cyclone; never the "Forecast Advisory" (no watch section).
    if (!/Advisory Number/i.test(item.title) || /Forecast Advisory/i.test(item.title)) {
      continue;
    }
    const id = /\b(AL|EP|CP)(\d{2})(\d{4})\b/.exec(item.text);
    if (!id) {
      continue;
    }
    const key = id[0].toLowerCase();
    if (!advisories[key] || (item.published ?? 0) > (advisories[key].issuedAt ?? 0)) {
      advisories[key] = { issuedAt: item.published, watches: parseWatches(item.text) };
    }
  }
  return { outlook, advisories };
}

/** The feed of one basin. */
export async function fetchFeed(fetchImpl, basin) {
  const xml = await get(fetchImpl, feedUrl(basin));
  if (!/<rss[\s>]/.test(xml)) {
    throw new NhcError(`index-${basin.feed}.xml: not an RSS feed`);
  }
  return parseFeed(xml);
}
