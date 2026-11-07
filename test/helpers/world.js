// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake NHC serving the
// responses recorded on 7/11/2026 (test/fixtures/nhc), editable storm by storm,
// a manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Pacific/Honolulu';

export const text = (name) =>
  readFileSync(new URL(`../fixtures/nhc/${name}`, import.meta.url), 'utf8');
export const json = (name) => JSON.parse(text(name));

// The responses were recorded on 7/11/2026 around 18:30 UTC.
export const START = Date.parse('2026-11-07T18:40:00Z');

// A house in Hilo, Hawaii (public coordinates of the town centre): Tropical
// Storm Pena (cp042026) is about 940 km (585 miles) south-south-east.
export const HOUSE = {
  id: 'house-1',
  name: 'Home',
  selector: 'home',
  latitude: 19.7241,
  longitude: -155.0868,
};
export const PENA = 'cp042026';

// Kingston, Jamaica: Hurricane Melissa (al132025, advisory 25 of 27/10/2025)
// was 230 km south-west of it.
export const KINGSTON = { latitude: '17.9714', longitude: '-76.7931' };
export const MELISSA = 'al132025';
export const MELISSA_ADVISORY = text('melissa-al132025-public-025.txt');

const FEEDS = { at: 'index-at', ep: 'index-ep', cp: 'index-cp' };

/** The RSS item of a public advisory, shaped like the real ones. */
function advisoryItem({ title, published, body }) {
  return `    <item>
      <title>${title}</title>
      <description>Issued <![CDATA[<pre>${body}</pre>]]></description>
      <pubDate>${new Date(published).toUTCString()}</pubDate>
      <link>https://www.nhc.noaa.gov/</link>
    </item>
`;
}

/**
 * Fake NHC. `api.down`: 'network' (connection refused), a status (503) or
 * false, for CurrentStorms.json; `api.feedDown`, the same for the basin feeds.
 */
export function createApi() {
  const recorded = json('CurrentStorms-2026-11-07.json');
  const api = {
    storms: structuredClone(recorded.activeStorms),
    feeds: Object.fromEntries(
      Object.entries(FEEDS).map(([key, name]) => [key, text(`${name}-2026-11-07.xml`)]),
    ),
    // Extra items per feed (advisories added by the tests).
    items: { at: [], ep: [], cp: [] },
    down: false,
    feedDown: false,
    requests: [],

    storm(id) {
      return api.storms.find((storm) => storm.id === id);
    },

    /** A new active storm, copied from Pena, with its own id and values. */
    addStorm({ id, name, classification = 'TS', intensity = 45, latitude, longitude }) {
      const storm = structuredClone(recorded.activeStorms[0]);
      Object.assign(storm, {
        id,
        name,
        classification,
        intensity: String(intensity),
        latitudeNumeric: latitude,
        longitudeNumeric: longitude,
      });
      api.storms.push(storm);
      return id;
    },

    /** Change a storm: classification, intensity (kt), position. */
    setStorm(id, { classification, intensity, latitude, longitude }) {
      const storm = api.storm(id);
      if (classification) {
        storm.classification = classification;
      }
      if (intensity !== undefined) {
        storm.intensity = String(intensity);
      }
      if (latitude !== undefined) {
        storm.latitudeNumeric = latitude;
        storm.longitudeNumeric = longitude;
      }
    },

    end(id) {
      api.storms = api.storms.filter((storm) => storm.id !== id);
    },

    /** A public advisory of a storm in the feed of its basin. */
    addAdvisory(feed, body, { title = 'Hurricane Melissa Public Advisory Number 25', published }) {
      api.items[feed].push(advisoryItem({ title, published, body }));
    },

    feed(key) {
      return api.feeds[key].replace('</channel>', `${api.items[key].join('')}  </channel>`);
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      const feed = /^\/index-(at|ep|cp)\.xml$/.exec(url.pathname);
      const down = feed ? api.feedDown : api.down;
      if (down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (down) {
        return { status: down, text: async () => 'Service Unavailable' };
      }
      if (feed) {
        return { status: 200, text: async () => api.feed(feed[1]) };
      }
      if (url.pathname === '/CurrentStorms.json') {
        return {
          status: 200,
          text: async () => JSON.stringify({ activeStorms: api.storms }),
        };
      }
      return { status: 404, text: async () => 'Not Found' };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-nhc-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, { store, fetch: api.fetch, timers, now: clock.now });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
  return world.fake.discoveredDevices;
}

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 15) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/** The last published value of a feature (`state` or `text`), by its key. */
export function lastValue(world, deviceExternalId, key) {
  const id = `${deviceExternalId}:${key}`;
  const states = world.fake.states.filter((s) => s.device_feature_external_id === id);
  const last = states.at(-1);
  return last === undefined ? undefined : (last.text ?? last.state);
}

export const sceneKeys = (world) => world.fake.sceneEvents.map((event) => event.key);

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const line = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(line);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text: line });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
