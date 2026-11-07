// -----------------------------------------------------------------------------
// The monitor against the fake NHC: devices, states, scene triggers, the
// first start and the restarts, the NHC down, the outlook out of season, the
// units, and the container's own refresh timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basinIds, nearestIds } from '../src/device.js';
import { TRIGGERS } from '../src/monitor.js';
import {
  KINGSTON,
  MELISSA,
  MELISSA_ADVISORY,
  PENA,
  START,
  createAll,
  createApi,
  createWorld,
  cycle,
  lastValue,
  sceneKeys,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const NO_WATCH = MELISSA_ADVISORY.replace(
  /SUMMARY OF WATCHES[\s\S]*?(?=\nDISCUSSION AND OUTLOOK)/,
  'There are no coastal watches or warnings in effect.\n',
);

test('one device per followed basin, plus the nearest storm', async (t) => {
  const w = await world(t, { config: { basins: ['atlantic', 'central_pacific'] } });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.external_id),
    [
      basinIds(w.gladys, 'atlantic').device,
      basinIds(w.gladys, 'central_pacific').device,
      nearestIds(w.gladys).device,
    ],
  );
  for (const device of w.fake.discoveredDevices) {
    assert.equal(device.should_poll, false);
  }
});

test('nothing is published before the devices are created, everything after', async (t) => {
  const w = await world(t);
  assert.deepEqual(w.fake.states, []);
  await createAll(w);
  const cp = basinIds(w.gladys, 'central_pacific').device;
  const at = basinIds(w.gladys, 'atlantic').device;
  const ep = basinIds(w.gladys, 'eastern_pacific').device;
  const near = nearestIds(w.gladys).device;
  assert.equal(lastValue(w, cp, 'active_systems'), 1);
  assert.equal(lastValue(w, cp, 'strongest'), 'Tempête tropicale Pena');
  assert.equal(lastValue(w, cp, 'max_category'), 0);
  assert.equal(lastValue(w, cp, 'max_wind'), 50);
  assert.equal(lastValue(w, cp, 'formation_7d'), 0);
  assert.equal(lastValue(w, at, 'active_systems'), 0);
  assert.equal(lastValue(w, at, 'strongest'), 'Aucun système actif');
  assert.equal(lastValue(w, at, 'formation_48h'), 10);
  assert.equal(lastValue(w, ep, 'formation_7d'), 20);
  assert.equal(lastValue(w, near, 'storm'), 'Tempête tropicale Pena');
  assert.equal(lastValue(w, near, 'wind'), 50);
  const miles = lastValue(w, near, 'distance');
  assert.ok(miles > 570 && miles < 600, `${miles}`);
  const degrees = lastValue(w, near, 'bearing');
  assert.ok(degrees > 150 && degrees < 180, `${degrees}`);
  assert.equal(lastValue(w, near, 'movement'), 'Cap O à 13 mph');
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
});

test('metric units: km/h and km, and English names', async (t) => {
  const w = await world(t, { config: { units: 'metric', language: 'en' } });
  await createAll(w);
  const near = nearestIds(w.gladys).device;
  assert.equal(lastValue(w, near, 'wind'), 85);
  const km = lastValue(w, near, 'distance');
  assert.ok(km > 920 && km < 960, `${km}`);
  assert.equal(lastValue(w, near, 'movement'), 'W at 21 km/h');
  const nearest = w.fake.discoveredDevices.at(-1);
  assert.equal(nearest.name, 'Nearest hurricane');
  assert.equal(
    nearest.features.find((f) => f.external_id.endsWith(':wind')).unit,
    'kilometer-per-hour',
  );
  assert.equal(nearest.features.find((f) => f.external_id.endsWith(':distance')).unit, 'km');
});

test('no storm: the nearest is "none", far away; no home: no nearest at all', async (t) => {
  const api = createApi();
  api.end(PENA);
  const w = await world(t, { api });
  await createAll(w);
  const near = nearestIds(w.gladys).device;
  assert.equal(lastValue(w, near, 'storm'), 'Aucun système actif');
  assert.equal(lastValue(w, near, 'distance'), 12451);
  assert.equal(lastValue(w, near, 'bearing'), undefined);

  const homeless = await world(t, { houses: [] });
  await createAll(homeless);
  const id = nearestIds(homeless.gladys).device;
  assert.equal(lastValue(homeless, id, 'storm'), undefined);
  assert.equal(
    lastValue(homeless, basinIds(homeless.gladys, 'central_pacific').device, 'active_systems'),
    1,
  );
  assert.match(homeless.fake.connectionStatus.message.en, /No home location/);
});

test('the first start fires nothing: the storms already there are not news', async (t) => {
  const w = await world(t);
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('new named storm: a depression getting its name, in a followed basin only', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { basins: ['atlantic', 'central_pacific'] } });
  api.addStorm({
    id: 'al222026',
    name: 'Twenty-Two',
    classification: 'TD',
    intensity: 30,
    latitude: 15,
    longitude: -60,
  });
  api.addStorm({
    id: 'ep182026',
    name: 'Xina',
    classification: 'TS',
    latitude: 15,
    longitude: -110,
  });
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
  api.setStorm('al222026', { classification: 'TS', intensity: 40 });
  // The NHC names the depression.
  api.storm('al222026').name = 'Tanya';
  await cycle(w);
  assert.deepEqual(sceneKeys(w), [TRIGGERS.NEW]);
  const { data } = w.fake.sceneEvents[0];
  assert.equal(data.basin, 'atlantic');
  assert.equal(data.name, 'Tanya');
  assert.equal(data.classification_name, 'Tempête tropicale');
  assert.equal(data.wind, 45);
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 1);
});

test('storm within the radius: once when it enters, again only after leaving', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { radius: '300' } });
  // Hilo is at 19.72N 155.09W; one degree of latitude is 69 miles.
  api.setStorm(PENA, { latitude: 14.5, longitude: -155.1 }); // ~360 mi
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
  api.setStorm(PENA, { latitude: 15.6, longitude: -155.1 }); // ~285 mi
  await cycle(w);
  assert.deepEqual(sceneKeys(w), [TRIGGERS.NEARBY]);
  assert.equal(w.fake.sceneEvents[0].data.distance, 285);
  api.setStorm(PENA, { latitude: 15.2, longitude: -155.1 }); // ~312 mi: within the 10 % margin
  await cycle(w);
  api.setStorm(PENA, { latitude: 15.7, longitude: -155.1 });
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 1);
  api.setStorm(PENA, { latitude: 14, longitude: -155.1 }); // ~395 mi: out
  await cycle(w);
  api.setStorm(PENA, { latitude: 15.6, longitude: -155.1 });
  await cycle(w);
  assert.deepEqual(sceneKeys(w), [TRIGGERS.NEARBY, TRIGGERS.NEARBY]);
});

test('category raised: hurricane, major hurricane, then stronger', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  api.setStorm(PENA, { classification: 'HU', intensity: 65 });
  await cycle(w);
  api.setStorm(PENA, { intensity: 100 });
  await cycle(w);
  api.setStorm(PENA, { intensity: 115 });
  await cycle(w);
  // Weakening fires nothing.
  api.setStorm(PENA, { intensity: 90 });
  await cycle(w);
  const raised = w.fake.sceneEvents.filter((event) => event.key === TRIGGERS.CATEGORY);
  assert.deepEqual(
    raised.map((event) => [
      event.data.milestone,
      event.data.previous_category,
      event.data.category,
    ]),
    [
      ['hurricane', 0, 1],
      ['major_hurricane', 1, 3],
      ['stronger', 3, 4],
    ],
  );
  assert.deepEqual(sceneKeys(w), [TRIGGERS.CATEGORY, TRIGGERS.CATEGORY, TRIGGERS.CATEGORY]);
});

test('trigger scope "radius": far storms fire nothing but the radius itself', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { trigger_scope: 'radius', radius: '100' } });
  api.setStorm(PENA, { classification: 'HU', intensity: 120 });
  api.addStorm({ id: 'cp052026', name: 'Ulu', latitude: 12, longitude: -170 });
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('coastal watches and warnings: each new kind once, from the public advisory', async (t) => {
  const api = createApi();
  api.addStorm({
    id: MELISSA,
    name: 'Melissa',
    classification: 'HU',
    intensity: 145,
    latitude: 16.4,
    longitude: -78.2,
  });
  api.addAdvisory('at', NO_WATCH, { published: START - 3600000 });
  const w = await world(t, { api, config: { ...KINGSTON, units: 'metric', language: 'en' } });
  assert.deepEqual(w.monitor.storms.find((s) => s.id === MELISSA).watches, {});
  api.addAdvisory('at', MELISSA_ADVISORY, { published: START + 60000 });
  await cycle(w);
  const watches = w.fake.sceneEvents.filter((event) => event.key === TRIGGERS.WATCH);
  assert.deepEqual(
    watches.map((event) => event.data.kind),
    ['hurricane_warning', 'hurricane_watch', 'tropical_storm_warning'],
  );
  const warning = watches[0].data;
  assert.equal(warning.kind_name, 'Hurricane warning');
  assert.equal(
    warning.areas,
    'Jamaica; Cuban provinces of Granma, Santiago de Cuba, Guantanamo, and Holguin',
  );
  assert.equal(warning.category, 5);
  assert.equal(warning.wind, 270);
  assert.ok(Math.abs(warning.distance - 230) < 10);
  assert.match(warning.summary, /^Hurricane Melissa, category 5, 270 km\/h, 2\d\d km SW of home$/);
  // The same advisory again: nothing new.
  await cycle(w);
  assert.equal(w.fake.sceneEvents.filter((event) => event.key === TRIGGERS.WATCH).length, 3);
});

test('a restart fires nothing again: what was seen is kept under /data', async (t) => {
  const api = createApi();
  const first = await world(t, { api });
  api.setStorm(PENA, { classification: 'HU', intensity: 70 });
  await cycle(first);
  assert.deepEqual(sceneKeys(first), [TRIGGERS.CATEGORY]);
  await first.app.stop();
  const again = await world(t, { api, dataDir: first.dataDir });
  await cycle(again);
  assert.deepEqual(again.fake.sceneEvents, []);
});

test('a configuration change takes the storms as known', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { basins: ['atlantic'] } });
  await w.fake.configUpdated({ basins: ['atlantic', 'central_pacific'] });
  assert.equal(w.fake.discoveredDevices.length, 3);
  assert.deepEqual(w.fake.sceneEvents, []);
  assert.equal(w.monitor.storms.length, 1);
});

test('the NHC down: no false value, one status, then back', async (t) => {
  const api = createApi();
  api.down = 503;
  const w = await world(t, { api });
  await createAll(w);
  assert.deepEqual(w.fake.states, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /National Hurricane Center ne répond pas/);
  assert.deepEqual(Object.keys(w.fake.connectionStatus.message), ['en', 'fr', 'de', 'es']);
  api.down = false;
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(lastValue(w, basinIds(w.gladys, 'central_pacific').device, 'active_systems'), 1);
});

test('a basin feed down keeps its last outlook; an old outlook is not published', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  await createAll(w);
  const at = basinIds(w.gladys, 'atlantic').device;
  api.feedDown = 'network';
  await cycle(w);
  assert.equal(w.monitor.outlook('atlantic').chance7d, 10);
  // Two days later, still no new outlook: the season is over for Gladys.
  const before = w.fake.states.length;
  w.clock.advance(2 * 24 * 3600 * 1000);
  w.gladys.forgetPublishedStates();
  await cycle(w);
  assert.equal(w.monitor.outlook('atlantic'), null);
  const published = w.fake.states.slice(before).map((s) => s.device_feature_external_id);
  assert.ok(published.includes(`${at}:active_systems`));
  assert.ok(!published.includes(`${at}:formation_7d`));
});

test('the container refreshes on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const api = createApi();
  const w = await world(t, { api, timers: true });
  await createAll(w);
  const before = api.requests.length;
  api.setStorm(PENA, { intensity: 55 });
  w.clock.advance(15 * 60 * 1000);
  t.mock.timers.tick(15 * 60 * 1000);
  await w.monitor.running;
  assert.ok(api.requests.length > before);
  assert.equal(lastValue(w, basinIds(w.gladys, 'central_pacific').device, 'max_wind'), 65);
});
