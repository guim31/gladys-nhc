// -----------------------------------------------------------------------------
// The `storms` widget (checked by the SDK's validator of the core vocabulary
// and budget), the scene action `read_storms` and the action `check_now`.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { CONFIG_ACTION, SCENE_ACTION } from '../src/actions.js';
import { WIDGET_KEY } from '../src/monitor.js';
import {
  KINGSTON,
  MELISSA,
  MELISSA_ADVISORY,
  PENA,
  START,
  createApi,
  createWorld,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function widget(w, request) {
  const { data } = await w.fake.widgetGet(WIDGET_KEY, request);
  return data.content;
}

function melissaApi() {
  const api = createApi();
  api.addStorm({
    id: MELISSA,
    name: 'Melissa',
    classification: 'HU',
    intensity: 145,
    latitude: 16.4,
    longitude: -78.2,
  });
  api.addAdvisory('at', MELISSA_ADVISORY, { published: START - 60000 });
  return api;
}

for (const language of ['en', 'fr', 'de', 'es']) {
  test(`the widget is valid in ${language}, strongest storm first`, async (t) => {
    const w = await world(t, { api: melissaApi(), config: KINGSTON });
    const content = await widget(w, { language, units: 'metric' });
    assert.deepEqual(validateWidgetContent(content), []);
    assert.deepEqual(
      content.components.map((c) => c.type),
      ['text', 'card-list', 'status', 'text', 'button'],
    );
    const [first, second] = content.components[1].items;
    assert.match(first.title, /Melissa$/);
    assert.match(second.title, /Pena$/);
    assert.equal(first.badge.color, 'danger');
    assert.match(first.subtitle, /^270 km\/h · /);
    assert.match(first.description, /Jamaica/);
    assert.equal(content.components[2].items.length, 3);
  });
}

test('the widget follows the units of the user, and hides the outlook if asked', async (t) => {
  const w = await world(t, { config: { units: 'metric', language: 'en' } });
  const us = await widget(w, { language: 'en', units: 'us' });
  assert.match(us.components[1].items[0].subtitle, /^50 mph · 587 mi SSE of home$/);
  const metric = await widget(w, { language: 'en', units: 'metric' });
  assert.match(metric.components[1].items[0].subtitle, /^85 km\/h · 9\d\d km SSE of home$/);
  const hidden = await widget(w, { language: 'en', settings: { show_outlook: false } });
  assert.ok(!hidden.components.some((c) => c.type === 'status'));
  const noLink = await widget(w, { language: 'en', settings: { show_link: false } });
  assert.ok(!noLink.components.some((c) => c.type === 'button'));
});

test('the widget without storm, and before the NHC ever answered', async (t) => {
  const api = createApi();
  api.end(PENA);
  const w = await world(t, { api });
  const quiet = await widget(w, { language: 'fr' });
  assert.equal(quiet.components[0].text, 'Aucun système actif');
  assert.ok(!quiet.components.some((c) => c.type === 'card-list'));
  const down = createApi();
  down.down = 'network';
  const w2 = await world(t, { api: down });
  const waiting = await widget(w2, { language: 'en' });
  assert.equal(waiting.components[0].text, 'Waiting for the NHC…');
  assert.deepEqual(validateWidgetContent(waiting), []);
});

test('read_storms: one sentence, the count and the highest category', async (t) => {
  const w = await world(t, { api: melissaApi(), config: { ...KINGSTON, language: 'en' } });
  const { data } = await w.fake.sceneAction(SCENE_ACTION, {});
  assert.equal(data.outputs.count, 2);
  assert.equal(data.outputs.max_category, 5);
  assert.match(
    data.outputs.text,
    /^2 active systems: Hurricane Melissa, category 5, 165 mph, 1\d\d mi SW of home; Tropical Storm Pena, 50 mph, .+\. Highest formation chance in 7 days: 20 % \(Eastern Pacific\)\.$/,
  );
});

test('read_storms fails when the NHC never answered; check_now says it in four languages', async (t) => {
  const api = createApi();
  api.down = 503;
  const w = await world(t, { api });
  const failed = await w.fake.sceneAction(SCENE_ACTION, {});
  assert.match(JSON.stringify(failed), /National Hurricane Center ne répond pas/);
  const answer = await w.fake.action(CONFIG_ACTION, {});
  assert.match(JSON.stringify(answer), /does not answer/);
  api.down = false;
  w.clock.advance(20 * 60 * 1000);
  const ok = JSON.stringify(await w.fake.action(CONFIG_ACTION, {}));
  assert.match(
    ok,
    /1 système actif : Tempête tropicale Pena, 50 mph, à 587 mi au SSE de la maison\./,
  );
  assert.match(ok, /Vérifié à /);
});
