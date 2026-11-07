// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on the device discovered from realistic
// inputs (the recorded NHC storms, every configuration shape), in every
// feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { createAll, createApi, createWorld } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const CONFIGS = [
  {},
  { units: 'metric', basins: ['atlantic'], radius: '1000', trigger_scope: 'radius' },
  { latitude: '16,9', longitude: '-153.3', units: 'metric' },
];

// A strong hurricane next to Pena too: the upper bounds of the features hold.
function stormyApi() {
  const api = createApi();
  api.addStorm({
    id: 'cp052026',
    name: 'Ulu',
    classification: 'HU',
    intensity: 160,
    latitude: 17,
    longitude: -153,
  });
  api.addStorm({
    id: 'al132026',
    name: 'Wendy',
    classification: 'HU',
    intensity: 150,
    latitude: 20,
    longitude: -70,
  });
  return api;
}

for (const language of LANGUAGES) {
  for (const [index, config] of CONFIGS.entries()) {
    test(`the discovered device follows the Gladys rules (${language} names, config ${index})`, async (t) => {
      const world = await createWorld({ config: { ...config, language }, api: stormyApi() });
      t.after(() => world.app.stop());
      const devices = world.fake.discoveredDevices;
      assert.equal(devices.length, (config.basins?.length ?? 3) + 1);
      await createAll(world);
      assert.ok(world.fake.states.length > 0);
      for (const device of devices) {
        const where = device.name;
        // should_poll: true if and only if poll_frequency is provided, in ms.
        if (device.poll_frequency === undefined) {
          assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
        } else {
          assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
          assert.ok(
            table.poll_frequencies_ms.includes(device.poll_frequency),
            `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
          );
        }

        assert.ok(device.features.length > 0, `${where}: no feature`);
        const externalIds = new Set();
        const names = new Set();
        for (const feature of device.features) {
          const at = `${where} / ${feature.name}`;
          const pair = table.pairs[`${feature.category}/${feature.type}`];
          assert.ok(
            pair,
            `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`,
          );
          assert.ok(
            pair.label_en && pair.label_fr && pair.icon,
            `${at}: couple without label or icon`,
          );
          assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
          assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
          assert.ok(
            Number.isFinite(feature.min) && Number.isFinite(feature.max),
            `${at}: finite min/max`,
          );
          assert.ok(feature.min <= feature.max, `${at}: min > max`);
          assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
          assert.equal(
            typeof feature.has_feedback,
            'boolean',
            `${at}: has_feedback must be a boolean`,
          );
          if (feature.unit !== undefined) {
            assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          }
          assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
          externalIds.add(feature.external_id);
          assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
          names.add(feature.name);
        }

        // Every published state stays within the bounds of its feature.
        for (const state of world.fake.states) {
          if (!state.device_feature_external_id.startsWith(`${device.external_id}:`)) {
            continue;
          }
          const feature = device.features.find(
            (f) => f.external_id === state.device_feature_external_id,
          );
          assert.ok(feature, `${state.device_feature_external_id}: state of an unknown feature`);
          if (state.text !== undefined) {
            assert.ok(state.text.length > 0, `${feature.name}: empty text`);
          } else {
            assert.ok(
              state.state >= feature.min && state.state <= feature.max,
              `${feature.name}: ${state.state} outside [${feature.min}, ${feature.max}]`,
            );
          }
        }
      }
    });
  }
}
