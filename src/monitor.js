// -----------------------------------------------------------------------------
// The monitor: reads the NHC every `refresh_interval` minutes (the active
// storms, then the feed of each followed basin), publishes the states of the
// devices, fires the scene triggers and serves the widget and the actions.
//
// Distances are measured from the home (the coordinates of the configuration,
// or the first located house of Gladys) to the centre of each storm, in the
// container: the location is never sent anywhere nor logged.
//
// Triggers, per storm (ATCF id), compared with what was seen before:
//   - new_storm        the storm gets a name (tropical or subtropical storm,
//                      hurricane), or appears with one;
//   - storm_nearby     its centre enters the radius (leaves it 10 % beyond,
//                      so a storm on the edge does not fire at every cycle);
//   - category_raised  its Saffir-Simpson category goes up;
//   - watch_warning    its latest public advisory lists a kind of coastal
//                      watch or warning it did not list before.
// The storms there at the first start, or when the configuration changes,
// fire nothing: they are not news. What was seen is kept under /data, so a
// restart fires nothing either.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. Nothing is published while the NHC has never answered.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { BASINS } from './config.js';
import { UNIT_OF, basinIds, buildDevices, nearestIds } from './device.js';
import { KM_PER_MILE, bearing, distanceKm, kmIn, windIn } from './geo.js';
import {
  BASIN_NAMES,
  CLASSIFICATION_NAMES,
  PHRASES,
  STATUS,
  WATCH_NAMES,
  describe,
  join,
  movementText,
  render,
  stormTitle,
} from './messages.js';
import { NHC_SITE, WATCH_KINDS, fetchFeed, fetchStorms } from './nhc.js';

const logger = createLogger({ name: 'nhc' });

export const WIDGET_KEY = 'storms';
export const TRIGGERS = {
  NEW: 'new_storm',
  NEARBY: 'storm_nearby',
  CATEGORY: 'category_raised',
  WATCH: 'watch_warning',
};
export const MILESTONES = ['hurricane', 'major_hurricane', 'stronger'];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // A storm no longer listed for this long is forgotten.
  forgetAfterMs: 3 * DAY,
  // The outlook is issued 4 times a day in season; older than this, the
  // season is over (or the feed stuck): its chances are not published.
  outlookMaxAgeMs: 24 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
  // The houses of Gladys are read again this often (no update event).
  housesMaxAgeMs: HOUR,
};

// A storm inside the radius leaves it only this far beyond.
const LEAVE_FACTOR = 1.1;
// Scene events fired by one cycle at most (the core takes 300 a minute).
export const MAX_EVENTS_PER_CYCLE = 20;

/** Strongest first: category, then wind; then nearest. */
export const byStrength = (a, b) =>
  b.category - a.category ||
  (b.windKt ?? 0) - (a.windKt ?? 0) ||
  (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // The storms of the followed basins at the last successful cycle, strongest first.
    this.storms = [];
    // Per basin: { outlook, advisories } of its last good feed, or absent.
    this.feeds = {};
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    // The next cycle takes the storms as known, firing nothing.
    this.seedNext = false;
    this.house = undefined;
    this.houseReadAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.signature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    // First start ever: the storms there now are the starting point, not news.
    this.seedNext = !this.data.seeded;
    await this.publishDiscovered();
    this.warnAboutConfig();
    logger.info(`Started: NHC storms read every ${config.refreshMinutes} min`);
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.houseReadAt = -Infinity;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration, whole.
    await this.running;
    this.config = config;
    this.houseReadAt = -Infinity;
    // A wider radius or another basin brings storms that are not news.
    this.seedNext = true;
    logger.info('Configuration saved');
    this.warnAboutConfig();
    // Names (language) or units may have changed: "Update" in the Discover tab.
    await this.publishDiscovered();
    this.gladys.forgetPublishedStates?.();
    this.schedule();
    await this.runCycle();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    if (this.config.invalidCenter) {
      logger.warn('The coordinates of the configuration are not valid: the house is used');
    }
    if (this.config.basins.length === 0) {
      logger.warn('No basin selected: nothing is followed');
    }
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(buildDevices(this.gladys, this.config));
  }

  /** External ids of the devices added in Gladys. */
  createdIds() {
    return new Set((this.gladys.devices ?? []).map((device) => device.external_id));
  }

  // --- Home ------------------------------------------------------------------

  /** The home: the configured coordinates, else the first located house. */
  async center() {
    if (this.config.center) {
      return this.config.center;
    }
    if (this.now() - this.houseReadAt >= this.timings.housesMaxAgeMs) {
      try {
        const houses = await this.gladys.getHouses();
        this.house =
          houses.find(
            (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
          ) ?? null;
        this.houseReadAt = this.now();
        this.recovered('houses', 'The houses of Gladys are readable again');
      } catch (err) {
        this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      }
    }
    return this.house ? { latitude: this.house.latitude, longitude: this.house.longitude } : null;
  }

  hasCenter() {
    return Boolean(this.config.center || this.house);
  }

  radiusKm() {
    return this.config.units === 'metric' ? this.config.radius : this.config.radius * KM_PER_MILE;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    let storms;
    try {
      storms = await fetchStorms(this.fetch);
      this.recovered('nhc', 'The National Hurricane Center answers again');
    } catch (err) {
      this.failed('nhc', 'warn', `National Hurricane Center unreachable: ${err.message}`);
      await this.updateConnectionStatus();
      return;
    }
    await this.readFeeds();
    const center = await this.center();
    const followed = storms
      .filter((storm) => this.config.basins.includes(storm.basin))
      .map((storm) => this.locate(storm, center))
      .sort(byStrength);
    logger.debug(`Refresh cycle: ${storms.length} active storm(s), ${followed.length} followed`);
    await this.detectChanges(followed);
    this.storms = followed;
    this.lastSuccessAt = this.now();
    this.recovered('cycle', 'Refresh cycles work again');
    await this.publishStates();
    await this.updateConnectionStatus();
    const signature = JSON.stringify([
      followed.map((s) => [s.id, s.classification, s.windKt, s.updatedAt]),
      this.config.basins.map((basin) => this.outlook(basin)),
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.requestRefresh();
    }
  }

  /** The feed of each followed basin; a failed one keeps its last good reading. */
  async readFeeds() {
    const basins = BASINS.filter((basin) => this.config.basins.includes(basin.key));
    const results = await Promise.allSettled(basins.map((basin) => fetchFeed(this.fetch, basin)));
    results.forEach((result, index) => {
      const basin = basins[index];
      if (result.status === 'fulfilled') {
        this.feeds[basin.key] = result.value;
        this.recovered(`feed-${basin.key}`, `The NHC feed index-${basin.feed}.xml answers again`);
      } else {
        this.failed(
          `feed-${basin.key}`,
          'warn',
          `NHC feed index-${basin.feed}.xml unreachable: ${result.reason.message}`,
        );
      }
    });
  }

  /** A storm with its distance and bearing from the home, and its watches. */
  locate(storm, center) {
    const located = { ...storm, distanceKm: null, bearing: null };
    if (center) {
      located.distanceKm = distanceKm(
        center.latitude,
        center.longitude,
        storm.latitude,
        storm.longitude,
      );
      located.bearing = bearing(center.latitude, center.longitude, storm.latitude, storm.longitude);
    }
    // undefined: no advisory in the feed; null: an advisory without the section.
    located.watches = this.feeds[storm.basin]?.advisories[storm.id]?.watches ?? null;
    return located;
  }

  /** The outlook of a basin, if fresh: `{ chance48h, chance7d, areas, issuedAt }` or null. */
  outlook(basin) {
    const outlook = this.feeds[basin]?.outlook;
    if (!outlook || outlook.issuedAt === null) {
      return null;
    }
    return this.now() - outlook.issuedAt <= this.timings.outlookMaxAgeMs ? outlook : null;
  }

  /** The followed basin with the highest formation chance in 7 days, or null. */
  bestOutlook() {
    let best = null;
    for (const basin of this.config.basins) {
      const outlook = this.outlook(basin);
      if (outlook && (best === null || outlook.chance7d > best.chance7d)) {
        best = { ...outlook, basin };
      }
    }
    return best;
  }

  /** Fire the scene triggers, and remember what was seen. */
  async detectChanges(storms) {
    const now = this.now();
    const known = this.data.known;
    const seed = this.seedNext;
    this.seedNext = false;
    const radius = this.radiusKm();
    const fired = [];
    for (const storm of storms) {
      const before = known[storm.id];
      const limit = before?.inside ? radius * LEAVE_FACTOR : radius;
      const inside = storm.distanceKm !== null && storm.distanceKm <= limit;
      const inScope = this.config.triggerScope === 'basins' || inside;
      const kinds = storm.watches ? WATCH_KINDS.filter((kind) => storm.watches[kind]) : null;
      if (inScope && storm.named && !before?.named) {
        fired.push({ key: TRIGGERS.NEW, storm });
      }
      if (inside && !before?.inside) {
        fired.push({ key: TRIGGERS.NEARBY, storm });
      }
      if (inScope && before && storm.category > (before.category ?? 0)) {
        const previous = before.category ?? 0;
        const milestone =
          storm.category >= 3 && previous < 3
            ? 'major_hurricane'
            : previous === 0
              ? 'hurricane'
              : 'stronger';
        fired.push({ key: TRIGGERS.CATEGORY, storm, previous, milestone });
      }
      // Kinds unknown before (feed down when the storm was first seen): a
      // baseline, not news. A storm never seen before brings its watches as news.
      if (inScope && kinds && (!before || Array.isArray(before.kinds))) {
        for (const kind of kinds.filter((k) => !(before?.kinds ?? []).includes(k))) {
          fired.push({ key: TRIGGERS.WATCH, storm, kind });
        }
      }
      known[storm.id] = {
        named: Boolean(before?.named || storm.named),
        inside,
        category: storm.category,
        // An advisory not read this time keeps the kinds already known.
        // Unknown at seeding (feed down): null until an advisory is read, then a
        // baseline.
        kinds: kinds ?? (before ? before.kinds : seed ? null : []),
        seenAt: now,
      };
    }
    for (const [id, entry] of Object.entries(known)) {
      if (now - entry.seenAt > this.timings.forgetAfterMs) {
        delete known[id];
      }
    }
    this.data.seeded = true;
    this.store.save(this.data);
    if (seed) {
      logger.debug(`${storms.length} storm(s) taken as known, no trigger fired`);
      return;
    }
    for (const [index, change] of fired.entries()) {
      if (index >= MAX_EVENTS_PER_CYCLE) {
        logger.debug(`${fired.length - index} more event(s) not sent to the scenes`);
        break;
      }
      await this.fire(change);
    }
  }

  async fire(change) {
    const { key, storm } = change;
    const title = stormTitle(storm, 'en');
    const line = {
      [TRIGGERS.NEW]: () => `New named storm: ${title}`,
      [TRIGGERS.NEARBY]: () => `${title} is within the radius`,
      [TRIGGERS.CATEGORY]: () =>
        `${title} raised from category ${change.previous} to ${storm.category}`,
      [TRIGGERS.WATCH]: () => `${title}: ${WATCH_NAMES.en[change.kind].toLowerCase()} in effect`,
    }[key]();
    logger.info(line);
    try {
      await this.gladys.publishSceneEvent(key, this.eventData(change));
      this.recovered('scene', 'Scene triggers work again');
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData({ key, storm, previous, milestone, kind }) {
    const { language, units } = this.config;
    const names = CLASSIFICATION_NAMES[language];
    const data = {
      basin: storm.basin,
      storm_id: storm.id,
      name: storm.name,
      classification: storm.classification,
      classification_name: names[storm.classification] ?? names.other,
      basin_name: BASIN_NAMES[language][storm.basin],
      category: storm.category,
      wind: storm.windKt === null ? null : windIn(storm.windKt, units),
      distance: storm.distanceKm === null ? null : Math.round(kmIn(storm.distanceKm, units)),
      summary: describe(storm, language, units),
      url: storm.advisoryUrl ?? NHC_SITE,
    };
    if (key === TRIGGERS.CATEGORY) {
      data.milestone = milestone;
      data.previous_category = previous;
    }
    if (key === TRIGGERS.WATCH) {
      data.kind = kind;
      data.kind_name = WATCH_NAMES[language][kind];
      data.areas = clip(storm.watches[kind].join('; '), 300);
    }
    return data;
  }

  // --- States ------------------------------------------------------------------

  statesOf() {
    if (this.lastSuccessAt === null) {
      return [];
    }
    const { language, units } = this.config;
    const states = [];
    const state = (id, value) => states.push({ device_feature_external_id: id, state: value });
    const text = (id, value) => states.push({ device_feature_external_id: id, text: value });

    for (const basin of this.config.basins) {
      const ids = basinIds(this.gladys, basin);
      const storms = this.storms.filter((storm) => storm.basin === basin);
      const strongest = storms[0];
      state(ids.active_systems, storms.length);
      text(ids.strongest, strongest ? stormTitle(strongest, language) : PHRASES[language].none);
      state(ids.max_category, strongest?.category ?? 0);
      state(ids.max_wind, strongest?.windKt == null ? 0 : windIn(strongest.windKt, units));
      // Out of season (no fresh outlook), nothing rather than a false 0 %.
      const outlook = this.outlook(basin);
      if (outlook) {
        state(ids.formation_48h, outlook.chance48h);
        state(ids.formation_7d, outlook.chance7d);
      }
    }

    // Without a home there is no nearest storm: nothing rather than a false one.
    if (this.hasCenter()) {
      const ids = nearestIds(this.gladys);
      const nearest = this.nearest();
      if (nearest) {
        text(ids.storm, stormTitle(nearest, language));
        state(ids.category, nearest.category);
        if (nearest.windKt !== null) {
          state(ids.wind, windIn(nearest.windKt, units));
        }
        state(ids.distance, Math.round(kmIn(nearest.distanceKm, units) * 10) / 10);
        state(ids.bearing, nearest.bearing);
        const movement = movementText(nearest, language, units);
        if (movement) {
          text(ids.movement, movement);
        }
      } else {
        // The direction keeps its last value: no angle means "no storm".
        text(ids.storm, PHRASES[language].none);
        state(ids.category, 0);
        state(ids.wind, 0);
        state(ids.distance, UNIT_OF[units].noStorm);
        text(ids.movement, PHRASES[language].none);
      }
    }
    return states;
  }

  /** The followed storm nearest to the home, or null. */
  nearest() {
    return this.storms
      .filter((storm) => storm.distanceKm !== null)
      .reduce(
        (best, storm) => (best === null || storm.distanceKm < best.distanceKm ? storm : best),
        null,
      );
  }

  async publishStates() {
    const created = this.createdIds();
    const prefixes = [...created].map((id) => `${id}:`);
    const states = this.statesOf().filter((s) =>
      prefixes.some((prefix) => s.device_feature_external_id.startsWith(prefix)),
    );
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.failing.has('nhc')) {
      parts.push(render(STATUS, 'nhcDown'));
    }
    if (this.config.basins.length === 0) {
      parts.push(render(STATUS, 'noBasin'));
    }
    if (!this.hasCenter()) {
      parts.push(render(STATUS, 'noCenter'));
    } else if (this.config.invalidCenter) {
      parts.push(render(STATUS, 'invalidCenter'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('nhc') && this.lastSuccessAt !== null;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  isOurs(device) {
    return buildDevices(this.gladys, this.config).some(
      (d) => d.external_id === device?.external_id,
    );
  }

  async onDeviceCreated(device) {
    if (!this.isOurs(device)) {
      return;
    }
    if (this.lastSuccessAt === null) {
      await this.runCycle();
    }
    // The SDK forgot the states of the device: they are published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.isOurs(device)) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The followed storms, read again if the last cycle is older than one interval. */
  async fresh() {
    if (this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    } else {
      await this.running;
    }
    return { storms: this.storms, ok: this.lastSuccessAt !== null };
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

function emptyData() {
  return { version: 1, seeded: false, known: {} };
}

const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
