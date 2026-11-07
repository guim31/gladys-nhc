// -----------------------------------------------------------------------------
// The NHC client on the responses recorded on 7/11/2026 (Tropical Storm Pena
// in the central Pacific, two disturbances in the outlooks) and on the public
// advisory 25 of Hurricane Melissa (27/10/2025, coastal warnings in effect).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { bearing, distanceKm, ktToKmh, ktToMph } from '../src/geo.js';
import {
  categoryOf,
  fetchFeed,
  fetchStorms,
  parseFeed,
  parseStorm,
  parseWatches,
} from '../src/nhc.js';
import { MELISSA_ADVISORY, PENA, json, text } from './helpers/world.js';

const fakeFetch = (status, body) => async () => ({ status, text: async () => body });

test('a storm of CurrentStorms.json is normalized', () => {
  const pena = parseStorm(json('CurrentStorms-2026-11-07.json').activeStorms[0]);
  assert.deepEqual(
    {
      id: pena.id,
      basin: pena.basin,
      name: pena.name,
      classification: pena.classification,
      named: pena.named,
      windKt: pena.windKt,
      category: pena.category,
      pressureMb: pena.pressureMb,
      latitude: pena.latitude,
      longitude: pena.longitude,
      movementDir: pena.movementDir,
      movementMph: pena.movementMph,
      advisoryNumber: pena.advisoryNumber,
    },
    {
      id: PENA,
      basin: 'central_pacific',
      name: 'Pena',
      classification: 'TS',
      named: true,
      windKt: 45,
      category: 0,
      pressureMb: 998,
      latitude: 11.4,
      longitude: -153.3,
      movementDir: 275,
      movementMph: 13,
      advisoryNumber: '4',
    },
  );
  assert.equal(pena.updatedAt, Date.parse('2026-11-07T15:00:00Z'));
  assert.equal(parseStorm({ id: 'xx012026', latitudeNumeric: 1, longitudeNumeric: 1 }), null);
  assert.equal(parseStorm({ id: 'al012026' }), null);
});

test('Saffir-Simpson categories, for hurricanes only', () => {
  assert.equal(categoryOf('TS', 60), 0);
  assert.equal(categoryOf('HU', 64), 1);
  assert.equal(categoryOf('HU', 82), 1);
  assert.equal(categoryOf('HU', 83), 2);
  assert.equal(categoryOf('HU', 96), 3);
  assert.equal(categoryOf('HU', 113), 4);
  assert.equal(categoryOf('HU', 137), 5);
  assert.equal(categoryOf('HU', 160), 5);
  assert.equal(categoryOf('HU', null), 0);
});

test('winds are rounded to 5 like the NHC advisories', () => {
  // Pena, 45 kt: "50 MPH...85 KM/H". Melissa, 145 kt: "165 MPH...270 KM/H".
  assert.equal(ktToMph(45), 50);
  assert.equal(ktToKmh(45), 85);
  assert.equal(ktToMph(145), 165);
  assert.equal(ktToKmh(145), 270);
});

test('distance and bearing: Melissa 230 km south-west of Kingston', () => {
  // Advisory 25: "ABOUT 145 MI...230 KM SW OF KINGSTON JAMAICA".
  const km = distanceKm(17.9714, -76.7931, 16.4, -78.2);
  assert.ok(Math.abs(km - 230) < 10, `${km}`);
  const degrees = bearing(17.9714, -76.7931, 16.4, -78.2);
  assert.ok(degrees > 200 && degrees < 240, `${degrees}`);
});

test('the outlook of each basin: the highest formation chance of its disturbances', () => {
  const at = parseFeed(text('index-at-2026-11-07.xml'));
  assert.deepEqual(
    { ...at.outlook, issuedAt: undefined },
    { issuedAt: undefined, chance48h: 10, chance7d: 10, areas: 1 },
  );
  assert.equal(at.outlook.issuedAt, Date.parse('2026-11-07T17:25:39Z'));
  assert.deepEqual(at.advisories, {});
  const ep = parseFeed(text('index-ep-2026-11-07.xml'));
  assert.equal(ep.outlook.chance48h, 20);
  assert.equal(ep.outlook.chance7d, 20);
  // Central Pacific: Pena only, no other disturbance.
  const cp = parseFeed(text('index-cp-2026-11-07.xml'));
  assert.equal(cp.outlook.chance7d, 0);
  assert.equal(cp.outlook.areas, 0);
  assert.deepEqual(cp.advisories[PENA].watches, {});
  assert.equal(cp.advisories[PENA].issuedAt, Date.parse('2026-11-07T14:36:08Z'));
});

test('the coastal watches and warnings of a public advisory', () => {
  assert.deepEqual(parseWatches(MELISSA_ADVISORY), {
    hurricane_warning: [
      'Jamaica',
      'Cuban provinces of Granma, Santiago de Cuba, Guantanamo, and Holguin',
    ],
    hurricane_watch: ['Southeastern and central Bahamas', 'Turks and Caicos Islands'],
    tropical_storm_warning: ['Haiti', 'Cuban province of Las Tunas'],
  });
  // An advisory without the section: unknown, not "none".
  assert.equal(parseWatches('BULLETIN\nNo section here\n'), null);
});

test('fetching: HTTP errors, broken bodies and an empty season', async () => {
  await assert.rejects(fetchStorms(fakeFetch(503, 'x')), /HTTP 503/);
  await assert.rejects(fetchStorms(fakeFetch(200, '<html>')), /not JSON/);
  await assert.rejects(fetchStorms(fakeFetch(200, '{}')), /no activeStorms/);
  await assert.rejects(
    fetchStorms(async () => {
      throw new TypeError('fetch failed');
    }),
    /fetch failed/,
  );
  assert.deepEqual(await fetchStorms(fakeFetch(200, text('CurrentStorms-none.json'))), []);
  await assert.rejects(
    fetchFeed(fakeFetch(200, '<html></html>'), { key: 'atlantic', feed: 'at' }),
    /not an RSS feed/,
  );
});

test('the configuration is normalized', () => {
  const defaults = normalizeConfig({});
  assert.deepEqual(defaults, {
    center: null,
    invalidCenter: false,
    basins: ['atlantic', 'eastern_pacific', 'central_pacific'],
    radius: 300,
    triggerScope: 'basins',
    units: 'imperial',
    refreshMinutes: 15,
    language: 'fr',
  });
  const custom = normalizeConfig({
    latitude: '25,76',
    longitude: '-80.19',
    basins: ['atlantic', 'nope'],
    radius: '500',
    trigger_scope: 'radius',
    units: 'metric',
    refresh_interval: '7',
    language: 'xx',
  });
  assert.deepEqual(custom.center, { latitude: 25.76, longitude: -80.19 });
  assert.deepEqual(custom.basins, ['atlantic']);
  assert.equal(custom.radius, 500);
  assert.equal(custom.triggerScope, 'radius');
  assert.equal(custom.units, 'metric');
  assert.equal(custom.refreshMinutes, 15);
  assert.equal(custom.language, 'fr');
  assert.equal(normalizeConfig({ latitude: '95', longitude: '0' }).invalidCenter, true);
  assert.deepEqual(normalizeConfig({ basins: [] }).basins, []);
});

test('a Potential Tropical Cyclone advisory counts, a forecast advisory does not', () => {
  const ptc = MELISSA_ADVISORY.replace(/AL132025/g, 'AL092026');
  const item = (title, body, date) =>
    `<item><title>${title}</title><description><![CDATA[<pre>${body}</pre>]]></description><pubDate>${date}</pubDate></item>`;
  const feed = `<rss><channel>${[
    item('Potential Tropical Cyclone Nine Advisory Number 1', ptc, 'Sat, 07 Nov 2026 15:00:00 GMT'),
    item(
      'Potential Tropical Cyclone Nine Forecast Advisory Number 1',
      'AL092026 no watches',
      'Sat, 07 Nov 2026 16:00:00 GMT',
    ),
    item(
      'Atlantic Tropical Weather Outlook',
      '* Formation chance through 7 days...low...10 percent.',
      'Sat, 07 Nov 2026 12:00:00 GMT',
    ),
    item(
      'Special Atlantic Tropical Weather Outlook',
      '* Formation chance through 7 days...high...70 percent.',
      'Sat, 07 Nov 2026 14:00:00 GMT',
    ),
  ].join('')}</channel></rss>`;
  const parsed = parseFeed(feed);
  assert.deepEqual(Object.keys(parsed.advisories.al092026.watches).length, 3);
  assert.equal(parsed.outlook.chance7d, 70);
});
