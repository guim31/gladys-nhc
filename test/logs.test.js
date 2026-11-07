// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a scene trigger, the NHC lost and back, a user action), never
// one line per refresh cycle; a failure that repeats at every cycle is logged
// once, plus one line when it is over. Never the coordinates of the home: its
// location is the sensitive data here.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE,
  PENA,
  captureLogs,
  createAll,
  createApi,
  createWorld,
  cycle,
} from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), ['[INFO] [nhc] Started: NHC storms read every 15 min']);
});

test('normal refresh cycles write nothing at info', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  await createAll(w);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    api.setStorm(PENA, { intensity: 45 + i * 2 });
    await cycle(w);
  }
  assert.deepEqual(lines, []);
});

test('a scene trigger is one info line, without the distance', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  const lines = captureLogs(t, 'info');
  api.setStorm(PENA, { classification: 'HU', intensity: 70 });
  await cycle(w);
  await cycle(w);
  assert.deepEqual(lines.map(strip), ['[INFO] [nhc] Hurricane Pena raised from category 0 to 1']);
});

test('LOG_LEVEL=debug shows the cycles, never the coordinates of the home', async (t) => {
  const lines = captureLogs(t, 'debug');
  const w = await world(t);
  await cycle(w);
  const configured = await world(t, { latitude: '25.7617', longitude: '-80.1918' });
  await cycle(configured);
  assert.ok(lines.some((line) => /Refresh cycle: 1 active storm\(s\), 1 followed/.test(line.text)));
  const all = lines.map((line) => line.text).join('\n');
  for (const value of [HOUSE.latitude, HOUSE.longitude, 25.7617, -80.1918]) {
    assert.doesNotMatch(all, new RegExp(String(value).replace('.', '\\.')));
  }
});

test('the NHC down at every cycle: one warning, then one line at recovery', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  const lines = captureLogs(t, 'info');
  api.down = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[nhc] National Hurricane Center unreachable: /CurrentStorms.json: HTTP 503']],
  );
  api.down = false;
  await cycle(w);
  assert.deepEqual(lines.slice(1).map(strip), [
    '[INFO] [nhc] The National Hurricane Center answers again',
  ]);
});

test('states refused at every cycle: one warning, then one line at recovery', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(w.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.ok(publish.mock.callCount() >= 3);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[nhc] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await cycle(w);
  assert.match(lines.at(-1).text, /\[INFO\].*Publishing the states works again/);
});

test('a configuration problem is said once, at the start', async (t) => {
  const lines = captureLogs(t, 'info');
  const w = await world(t, { latitude: 'abc', longitude: '2', basins: [] });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines.map(strip), [
    '[WARN] [nhc] The coordinates of the configuration are not valid: the house is used',
    '[WARN] [nhc] No basin selected: nothing is followed',
    '[INFO] [nhc] Started: NHC storms read every 15 min',
  ]);
});
