// -----------------------------------------------------------------------------
// The Gladys devices of the integration (couples checked against the Gladys
// front, see test/gladys-rules.test.js):
//
// One device per followed basin (Atlantic, Eastern Pacific, Central Pacific):
//   - active_systems    counter-sensor/integer: storms the NHC follows there;
//   - strongest         text/text: the strongest of them, in words;
//   - max_category      counter-sensor/integer 0-5: its Saffir-Simpson
//                       category (0 below hurricane strength, or no storm);
//   - max_wind          speed-sensor/integer, mph or km/h: its sustained wind;
//   - formation_48h     counter-sensor/integer, %: the highest formation
//   - formation_7d      chance of the Tropical Weather Outlook, 48 h and 7 days.
//
// One device "nearest storm", measured from the home (followed basins only):
//   - storm             text/text: classification and name;
//   - category          counter-sensor/integer 0-5;
//   - wind              speed-sensor/integer;
//   - distance          distance-sensor/decimal, miles or km. Without any
//                       storm, NO_STORM (half the circumference of the Earth,
//                       the farthest a point can be): a "below 300 miles"
//                       condition stays false;
//   - bearing           angle-sensor/integer, degrees: where the storm is,
//                       seen from the home (0 north, 90 east);
//   - movement          text/text: heading and speed of the storm.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). Platform ids are fixed: the basin key, and "home".
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

export const BASIN_TYPE = 'basin';
export const NEAREST_TYPE = 'nearest';
export const NEAREST_ID = 'home';

export const BASIN_FEATURES = [
  'active_systems',
  'strongest',
  'max_category',
  'max_wind',
  'formation_48h',
  'formation_7d',
];
export const NEAREST_FEATURES = ['storm', 'category', 'wind', 'distance', 'bearing', 'movement'];

export const UNIT_OF = {
  imperial: { speed: UNITS.MILE_PER_HOUR, distance: UNITS.MILE, noStorm: 12451, maxWind: 250 },
  metric: { speed: UNITS.KILOMETER_PER_HOUR, distance: UNITS.KM, noStorm: 20038, maxWind: 400 },
};

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    atlantic: 'Hurricanes Atlantic',
    eastern_pacific: 'Hurricanes Eastern Pacific',
    central_pacific: 'Hurricanes Central Pacific',
    nearest: 'Nearest hurricane',
    active_systems: 'Active systems',
    strongest: 'Strongest system',
    max_category: 'Highest category',
    max_wind: 'Highest sustained wind',
    formation_48h: 'Formation chance 48 h',
    formation_7d: 'Formation chance 7 days',
    storm: 'Storm',
    category: 'Category',
    wind: 'Sustained wind',
    distance: 'Distance',
    bearing: 'Direction',
    movement: 'Movement',
  },
  fr: {
    atlantic: 'Ouragans Atlantique',
    eastern_pacific: 'Ouragans Pacifique Est',
    central_pacific: 'Ouragans Pacifique Central',
    nearest: 'Ouragan le plus proche',
    active_systems: 'Systèmes actifs',
    strongest: 'Système le plus fort',
    max_category: 'Catégorie la plus haute',
    max_wind: 'Vent soutenu le plus fort',
    formation_48h: 'Probabilité de formation 48 h',
    formation_7d: 'Probabilité de formation 7 jours',
    storm: 'Tempête',
    category: 'Catégorie',
    wind: 'Vent soutenu',
    distance: 'Distance',
    bearing: 'Direction',
    movement: 'Déplacement',
  },
  de: {
    atlantic: 'Hurrikane Atlantik',
    eastern_pacific: 'Hurrikane Ostpazifik',
    central_pacific: 'Hurrikane Zentralpazifik',
    nearest: 'Nächster Hurrikan',
    active_systems: 'Aktive Systeme',
    strongest: 'Stärkstes System',
    max_category: 'Höchste Kategorie',
    max_wind: 'Stärkster Dauerwind',
    formation_48h: 'Entstehungschance 48 h',
    formation_7d: 'Entstehungschance 7 Tage',
    storm: 'Sturm',
    category: 'Kategorie',
    wind: 'Dauerwind',
    distance: 'Entfernung',
    bearing: 'Richtung',
    movement: 'Zugbahn',
  },
  es: {
    atlantic: 'Huracanes Atlántico',
    eastern_pacific: 'Huracanes Pacífico Este',
    central_pacific: 'Huracanes Pacífico Central',
    nearest: 'Huracán más cercano',
    active_systems: 'Sistemas activos',
    strongest: 'Sistema más fuerte',
    max_category: 'Categoría más alta',
    max_wind: 'Viento sostenido más fuerte',
    formation_48h: 'Probabilidad de formación 48 h',
    formation_7d: 'Probabilidad de formación 7 días',
    storm: 'Tormenta',
    category: 'Categoría',
    wind: 'Viento sostenido',
    distance: 'Distancia',
    bearing: 'Dirección',
    movement: 'Desplazamiento',
  },
};

/** External ids of a device and of its features. */
export function idsOf(gladys, type, platformId, keys) {
  const ids = gladys.externalIds(type, platformId);
  return {
    device: ids.device,
    ...Object.fromEntries(keys.map((key) => [key, ids.feature(key)])),
  };
}
export const basinIds = (gladys, basin) => idsOf(gladys, BASIN_TYPE, basin, BASIN_FEATURES);
export const nearestIds = (gladys) => idsOf(gladys, NEAREST_TYPE, NEAREST_ID, NEAREST_FEATURES);

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...extra,
});
const text = (name, externalId) =>
  sensor(name, externalId, CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
    keep_history: false,
    min: 0,
    max: 0,
  });
const integer = (name, externalId, max, extra) =>
  sensor(name, externalId, CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
    min: 0,
    max,
    ...extra,
  });

/** The discovery payload of a basin device. */
export function buildBasinDevice(gladys, basin, { language = 'fr', units = 'imperial' } = {}) {
  const ids = basinIds(gladys, basin);
  const names = NAMES[language] ?? NAMES.fr;
  const unit = UNIT_OF[units] ?? UNIT_OF.imperial;
  return {
    name: names[basin],
    external_id: ids.device,
    model: 'NHC',
    should_poll: false,
    params: [],
    features: [
      integer(names.active_systems, ids.active_systems, 50),
      text(names.strongest, ids.strongest),
      integer(names.max_category, ids.max_category, 5),
      sensor(names.max_wind, ids.max_wind, CATEGORIES.SPEED_SENSOR, TYPES.SENSOR.INTEGER, {
        unit: unit.speed,
        min: 0,
        max: unit.maxWind,
      }),
      integer(names.formation_48h, ids.formation_48h, 100, { unit: UNITS.PERCENT }),
      integer(names.formation_7d, ids.formation_7d, 100, { unit: UNITS.PERCENT }),
    ],
  };
}

/** The discovery payload of the "nearest storm" device. */
export function buildNearestDevice(gladys, { language = 'fr', units = 'imperial' } = {}) {
  const ids = nearestIds(gladys);
  const names = NAMES[language] ?? NAMES.fr;
  const unit = UNIT_OF[units] ?? UNIT_OF.imperial;
  return {
    name: names.nearest,
    external_id: ids.device,
    model: 'NHC',
    should_poll: false,
    params: [],
    features: [
      text(names.storm, ids.storm),
      integer(names.category, ids.category, 5),
      sensor(names.wind, ids.wind, CATEGORIES.SPEED_SENSOR, TYPES.SENSOR.INTEGER, {
        unit: unit.speed,
        min: 0,
        max: unit.maxWind,
      }),
      sensor(names.distance, ids.distance, CATEGORIES.DISTANCE_SENSOR, TYPES.SENSOR.DECIMAL, {
        unit: unit.distance,
        min: 0,
        max: unit.noStorm,
      }),
      sensor(names.bearing, ids.bearing, CATEGORIES.ANGLE_SENSOR, TYPES.SENSOR.INTEGER, {
        unit: UNITS.DEGREE,
        keep_history: false,
        min: 0,
        max: 359,
      }),
      text(names.movement, ids.movement),
    ],
  };
}

/** Every device of a configuration: the followed basins, then the nearest storm. */
export function buildDevices(gladys, config) {
  return [
    ...config.basins.map((basin) => buildBasinDevice(gladys, basin, config)),
    buildNearestDevice(gladys, config),
  ];
}
