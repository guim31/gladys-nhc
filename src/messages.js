// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action and
// scene messages, scene variables), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object. German
// says "du", Spanish "usted". Storm names and the areas of the watches come
// from the NHC, in English: they are not translated.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { compassIndex, kmIn, mphIn, windIn } from './geo.js';

export const BASIN_NAMES = {
  en: {
    atlantic: 'Atlantic',
    eastern_pacific: 'Eastern Pacific',
    central_pacific: 'Central Pacific',
  },
  fr: {
    atlantic: 'Atlantique',
    eastern_pacific: 'Pacifique Est',
    central_pacific: 'Pacifique Central',
  },
  de: { atlantic: 'Atlantik', eastern_pacific: 'Ostpazifik', central_pacific: 'Zentralpazifik' },
  es: {
    atlantic: 'Atlántico',
    eastern_pacific: 'Pacífico Este',
    central_pacific: 'Pacífico Central',
  },
};

// Classifications of CurrentStorms.json; `other` for a code not listed here.
export const CLASSIFICATION_NAMES = {
  en: {
    TD: 'Tropical Depression',
    STD: 'Subtropical Depression',
    TS: 'Tropical Storm',
    STS: 'Subtropical Storm',
    HU: 'Hurricane',
    PTC: 'Potential Tropical Cyclone',
    PC: 'Post-Tropical Cyclone',
    other: 'Tropical Cyclone',
  },
  fr: {
    TD: 'Dépression tropicale',
    STD: 'Dépression subtropicale',
    TS: 'Tempête tropicale',
    STS: 'Tempête subtropicale',
    HU: 'Ouragan',
    PTC: 'Cyclone tropical potentiel',
    PC: 'Cyclone post-tropical',
    other: 'Cyclone tropical',
  },
  de: {
    TD: 'Tropisches Tief',
    STD: 'Subtropisches Tief',
    TS: 'Tropischer Sturm',
    STS: 'Subtropischer Sturm',
    HU: 'Hurrikan',
    PTC: 'Potenzieller Tropensturm',
    PC: 'Posttropischer Sturm',
    other: 'Tropischer Wirbelsturm',
  },
  es: {
    TD: 'Depresión tropical',
    STD: 'Depresión subtropical',
    TS: 'Tormenta tropical',
    STS: 'Tormenta subtropical',
    HU: 'Huracán',
    PTC: 'Ciclón tropical potencial',
    PC: 'Ciclón postropical',
    other: 'Ciclón tropical',
  },
};

export const WATCH_NAMES = {
  en: {
    hurricane_warning: 'Hurricane warning',
    storm_surge_warning: 'Storm surge warning',
    hurricane_watch: 'Hurricane watch',
    storm_surge_watch: 'Storm surge watch',
    tropical_storm_warning: 'Tropical storm warning',
    tropical_storm_watch: 'Tropical storm watch',
  },
  fr: {
    hurricane_warning: 'Alerte ouragan',
    storm_surge_warning: 'Alerte onde de tempête',
    hurricane_watch: 'Veille ouragan',
    storm_surge_watch: 'Veille onde de tempête',
    tropical_storm_warning: 'Alerte tempête tropicale',
    tropical_storm_watch: 'Veille tempête tropicale',
  },
  de: {
    hurricane_warning: 'Hurrikanwarnung',
    storm_surge_warning: 'Sturmflutwarnung',
    hurricane_watch: 'Hurrikanvorwarnung',
    storm_surge_watch: 'Sturmflutvorwarnung',
    tropical_storm_warning: 'Tropensturmwarnung',
    tropical_storm_watch: 'Tropensturmvorwarnung',
  },
  es: {
    hurricane_warning: 'Aviso de huracán',
    storm_surge_warning: 'Aviso de marejada ciclónica',
    hurricane_watch: 'Vigilancia de huracán',
    storm_surge_watch: 'Vigilancia de marejada ciclónica',
    tropical_storm_warning: 'Aviso de tormenta tropical',
    tropical_storm_watch: 'Vigilancia de tormenta tropical',
  },
};

const COMPASS = {
  en: 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW',
  fr: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
  de: 'N NNO NO ONO O OSO SO SSO S SSW SW WSW W WNW NW NNW',
  es: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
};
export const compass = (degrees, language) => COMPASS[language].split(' ')[compassIndex(degrees)];

/**
 * Colour of a storm in the closed widget palette: info below hurricane
 * strength, warning for categories 1-2, danger for a major hurricane (3-5).
 */
export const categoryColor = (category) =>
  category >= 3 ? WIDGET_COLORS.DANGER : category >= 1 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO;

export const UNIT_LABELS = {
  imperial: { speed: 'mph', distance: 'mi' },
  metric: { speed: 'km/h', distance: 'km' },
};

// Values of the text features, and pieces of sentences.
export const PHRASES = {
  en: {
    none: 'No active system',
    stationary: 'Stationary',
    moving: ({ dir, speed }) => `${dir} at ${speed}`,
    category: ({ value }) => `category ${value}`,
    away: ({ distance, dir }) => `${distance} ${dir} of home`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    systems: ({ count }) => (count === 1 ? '1 active system' : `${count} active systems`),
    noSystem: 'No active tropical cyclone in the followed basins.',
    outlook: ({ chance, basin }) => `Highest formation chance in 7 days: ${chance} % (${basin}).`,
  },
  fr: {
    none: 'Aucun système actif',
    stationary: 'Stationnaire',
    moving: ({ dir, speed }) => `Cap ${dir} à ${speed}`,
    category: ({ value }) => `catégorie ${value}`,
    away: ({ distance, dir }) => `à ${distance} au ${dir} de la maison`,
    list: ({ head, items }) => `${head} : ${items.join(' ; ')}.`,
    systems: ({ count }) => (count === 1 ? '1 système actif' : `${count} systèmes actifs`),
    noSystem: 'Aucun cyclone tropical actif dans les bassins suivis.',
    outlook: ({ chance, basin }) =>
      `Plus forte probabilité de formation à 7 jours : ${chance} % (${basin}).`,
  },
  de: {
    none: 'Kein aktives System',
    stationary: 'Stationär',
    moving: ({ dir, speed }) => `Richtung ${dir} mit ${speed}`,
    category: ({ value }) => `Kategorie ${value}`,
    away: ({ distance, dir }) => `${distance} ${dir} von zu Hause`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    systems: ({ count }) => (count === 1 ? '1 aktives System' : `${count} aktive Systeme`),
    noSystem: 'Kein aktiver tropischer Wirbelsturm in den verfolgten Becken.',
    outlook: ({ chance, basin }) => `Höchste Entstehungschance in 7 Tagen: ${chance} % (${basin}).`,
  },
  es: {
    none: 'Ningún sistema activo',
    stationary: 'Estacionario',
    moving: ({ dir, speed }) => `Hacia el ${dir} a ${speed}`,
    category: ({ value }) => `categoría ${value}`,
    away: ({ distance, dir }) => `a ${distance} al ${dir} de su casa`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    systems: ({ count }) => (count === 1 ? '1 sistema activo' : `${count} sistemas activos`),
    noSystem: 'Ningún ciclón tropical activo en las cuencas seguidas.',
    outlook: ({ chance, basin }) =>
      `Mayor probabilidad de formación a 7 días: ${chance} % (${basin}).`,
  },
};

// Connection status of the Configuration screen, and messages of the actions.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    nhcDown: 'The National Hurricane Center does not answer: the storms are not updated.',
    noCenter:
      'No home location: give your house a location in Gladys (Settings, Houses) or type coordinates. Distances are not computed.',
    invalidCenter: 'The coordinates are not valid: the location of your house is used.',
    noBasin: 'No basin selected: nothing is followed.',
    summary: ({ text, time }) => `${text} Checked at ${time}.`,
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    nhcDown: 'Le National Hurricane Center ne répond pas : les tempêtes ne sont pas mises à jour.',
    noCenter:
      'Pas de position : indiquez la position de votre maison dans Gladys (Paramètres, Maisons) ou saisissez des coordonnées. Les distances ne sont pas calculées.',
    invalidCenter:
      'Les coordonnées ne sont pas valides : la position de votre maison est utilisée.',
    noBasin: "Aucun bassin choisi : rien n'est suivi.",
    summary: ({ text, time }) => `${text} Vérifié à ${time}.`,
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    nhcDown: 'Das National Hurricane Center antwortet nicht: Die Stürme werden nicht aktualisiert.',
    noCenter:
      'Kein Standort: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser) oder trage Koordinaten ein. Entfernungen werden nicht berechnet.',
    invalidCenter: 'Die Koordinaten sind ungültig: Der Standort deines Hauses wird verwendet.',
    noBasin: 'Kein Becken gewählt: Nichts wird verfolgt.',
    summary: ({ text, time }) => `${text} Geprüft um ${time}.`,
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    nhcDown: 'El National Hurricane Center no responde: las tormentas no se actualizan.',
    noCenter:
      'Sin ubicación: indique la ubicación de su casa en Gladys (Ajustes, Casas) o introduzca coordenadas. Las distancias no se calculan.',
    invalidCenter: 'Las coordenadas no son válidas: se usa la ubicación de su casa.',
    noBasin: 'Ninguna cuenca elegida: no se sigue nada.',
    summary: ({ text, time }) => `${text} Comprobado a las ${time}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-US' : language);

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "07/11 15:00". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A time of day, e.g. "18:35". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "1,234" or "1 234". */
export function formatNumber(value, language) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
}

/** "Hurricane Melissa", "Tempête tropicale Pena". */
export function stormTitle(storm, language) {
  const names = CLASSIFICATION_NAMES[language];
  return `${names[storm.classification] ?? names.other} ${storm.name}`;
}

/** "165 mph" */
export function windText(storm, language, units) {
  return storm.windKt === null
    ? null
    : `${formatNumber(windIn(storm.windKt, units), language)} ${UNIT_LABELS[units].speed}`;
}

/** "230 mi" */
export function distanceText(km, language, units) {
  return `${formatNumber(kmIn(km, units), language)} ${UNIT_LABELS[units].distance}`;
}

/** "W at 13 mph", "Stationary"; null when the NHC gives no movement. */
export function movementText(storm, language, units) {
  if (storm.movementMph === null) {
    return null;
  }
  if (storm.movementMph === 0 || storm.movementDir === null) {
    return PHRASES[language].stationary;
  }
  const speed = `${formatNumber(mphIn(storm.movementMph, units), language)} ${UNIT_LABELS[units].speed}`;
  return PHRASES[language].moving({ dir: compass(storm.movementDir, language), speed });
}

/** "230 mi SW of home", when the distance is known. */
export function awayText(storm, language, units) {
  if (storm.distanceKm === null || storm.distanceKm === undefined) {
    return null;
  }
  return PHRASES[language].away({
    distance: distanceText(storm.distanceKm, language, units),
    dir: compass(storm.bearing, language),
  });
}

/** A storm in one line: "Hurricane Melissa, category 5, 165 mph, 230 mi SW of home". */
export function describe(storm, language, units) {
  return [
    stormTitle(storm, language),
    storm.category > 0 ? PHRASES[language].category({ value: storm.category }) : null,
    windText(storm, language, units),
    awayText(storm, language, units),
  ]
    .filter(Boolean)
    .join(', ');
}

// Storms named in one sentence; the rest is counted in the head.
export const SENTENCE_STORMS = 4;

/** The followed storms (and the outlook) as one sentence, for a message or a voice. */
export function sentence(storms, outlook, language, units) {
  const phrases = PHRASES[language];
  const parts = [];
  if (storms.length === 0) {
    parts.push(phrases.noSystem);
  } else {
    parts.push(
      phrases.list({
        head: phrases.systems({ count: storms.length }),
        items: storms.slice(0, SENTENCE_STORMS).map((storm) => describe(storm, language, units)),
      }),
    );
  }
  if (outlook && outlook.chance7d > 0) {
    parts.push(
      phrases.outlook({ chance: outlook.chance7d, basin: BASIN_NAMES[language][outlook.basin] }),
    );
  }
  return parts.join(' ');
}
