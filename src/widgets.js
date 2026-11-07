// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `storms`.
//
// A heading with the number of active systems, then the storms of the
// followed basins as a `card-list` (8 rows at most, the core's cap), strongest
// first: classification and name as title, wind and distance as subtitle, the
// Saffir-Simpson category as a coloured badge. Tapping a row opens the core's
// detail panel: position, movement, pressure, coastal watches and warnings,
// and links to the NHC advisory and graphics. Then, unless hidden by the
// `show_outlook` setting, one status row per followed basin with the formation
// chances of the Tropical Weather Outlook. The footer gives the source and the
// time of the last reading, and a link to the NHC (setting `show_link`).
// Budget: 2 texts, 1 card-list, 1 status, 1 button.
//
// Units: the user's preference sent with the request ('metric' or 'us'),
// else the one of the configuration.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  BASIN_NAMES,
  WATCH_NAMES,
  awayText,
  categoryColor,
  formatDate,
  movementText,
  stormTitle,
  windText,
} from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { NHC_SITE, WATCH_KINDS } from './nhc.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for the NHC…',
    fr: 'En attente du NHC…',
    de: 'Warte auf das NHC…',
    es: 'Esperando al NHC…',
  },
  none: {
    en: 'No active system',
    fr: 'Aucun système actif',
    de: 'Kein aktives System',
    es: 'Ningún sistema activo',
  },
  one: {
    en: '1 active system',
    fr: '1 système actif',
    de: '1 aktives System',
    es: '1 sistema activo',
  },
  many: {
    en: ' active systems',
    fr: ' systèmes actifs',
    de: ' aktive Systeme',
    es: ' sistemas activos',
  },
  source: {
    en: 'Source: NOAA NHC',
    fr: 'Source : NOAA NHC',
    de: 'Quelle: NOAA NHC',
    es: 'Fuente: NOAA NHC',
  },
  advisory: {
    en: 'Public advisory',
    fr: 'Bulletin public',
    de: 'Öffentliche Meldung',
    es: 'Aviso público',
  },
  graphics: {
    en: 'Forecast cone',
    fr: 'Cône de prévision',
    de: 'Prognosekegel',
    es: 'Cono de pronóstico',
  },
  site: { en: 'NHC', fr: 'NHC', de: 'NHC', es: 'NHC' },
  category: { en: 'Cat.', fr: 'Cat.', de: 'Kat.', es: 'Cat.' },
  pressure: { en: 'Pressure', fr: 'Pression', de: 'Luftdruck', es: 'Presión' },
  position: { en: 'Position', fr: 'Position', de: 'Position', es: 'Posición' },
  noWatch: {
    en: 'No coastal watch or warning',
    fr: 'Aucune veille ni alerte côtière',
    de: 'Keine Küstenwarnung',
    es: 'Ninguna vigilancia ni aviso costero',
  },
  outlook: {
    en: ({ h48, d7 }) => `${h48}% 48 h · ${d7}% 7 days`,
    fr: ({ h48, d7 }) => `${h48} % 48 h · ${d7} % 7 jours`,
    de: ({ h48, d7 }) => `${h48} % 48 h · ${d7} % 7 Tage`,
    es: ({ h48, d7 }) => `${h48} % 48 h · ${d7} % 7 días`,
  },
  noOutlook: {
    en: 'No outlook',
    fr: 'Pas de prévision',
    de: 'Keine Prognose',
    es: 'Sin previsión',
  },
};

const t = (text, language) => text[language] ?? text.en;
// French puts a space before a colon.
const labelled = (label, value, language) => `${label}${language === 'fr' ? ' : ' : ': '}${value}`;
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const unitsOf = (requested, fallback) =>
  requested === 'us' ? 'imperial' : requested === 'metric' ? 'metric' : fallback;

function heading(storms, language) {
  if (storms.length === 0) {
    return t(TEXT.none, language);
  }
  return storms.length === 1 ? t(TEXT.one, language) : `${storms.length}${t(TEXT.many, language)}`;
}

const position = (storm) =>
  `${Math.abs(storm.latitude).toFixed(1)}${storm.latitude >= 0 ? 'N' : 'S'} ${Math.abs(storm.longitude).toFixed(1)}${storm.longitude >= 0 ? 'E' : 'W'}`;

/** One row of the list, and its detail panel. */
export function itemOf(storm, language, units) {
  const watches = storm.watches
    ? WATCH_KINDS.filter((kind) => storm.watches[kind]).map((kind) =>
        labelled(WATCH_NAMES[language][kind], storm.watches[kind].join(', '), language),
      )
    : [];
  const details = [
    labelled(t(TEXT.position, language), position(storm), language),
    movementText(storm, language, units),
    storm.pressureMb === null
      ? null
      : labelled(t(TEXT.pressure, language), `${storm.pressureMb} hPa`, language),
    ...(storm.watches && watches.length === 0 ? [t(TEXT.noWatch, language)] : watches),
    storm.updatedAt === null ? null : formatDate(storm.updatedAt, language),
  ];
  const links = [
    storm.advisoryUrl && { url: storm.advisoryUrl, label: t(TEXT.advisory, language) },
    storm.graphicsUrl && { url: storm.graphicsUrl, label: t(TEXT.graphics, language) },
  ].filter(Boolean);
  return {
    title: clip(stormTitle(storm, language), 60),
    subtitle: clip(
      [windText(storm, language, units), awayText(storm, language, units)]
        .filter(Boolean)
        .join(' · '),
      60,
    ),
    badge: {
      text:
        storm.category > 0
          ? `${t(TEXT.category, language)} ${storm.category}`
          : storm.classification,
      color: categoryColor(storm.category),
    },
    description: clip(details.filter(Boolean).join('\n'), 1000),
    ...(links.length > 0 ? { links } : {}),
  };
}

/** One status row per followed basin: the formation chances of the outlook. */
function outlookRows(monitor, language) {
  return monitor.config.basins.map((basin) => {
    const outlook = monitor.outlook(basin);
    if (!outlook) {
      return {
        label: BASIN_NAMES[language][basin],
        value: t(TEXT.noOutlook, language),
        color: WIDGET_COLORS.NEUTRAL,
      };
    }
    const chance = outlook.chance7d;
    return {
      label: BASIN_NAMES[language][basin],
      value: TEXT.outlook[language]({ h48: outlook.chance48h, d7: chance }),
      // The NHC colours: low under 40 %, medium 40-60 %, high above.
      color:
        chance > 60
          ? WIDGET_COLORS.DANGER
          : chance >= 40
            ? WIDGET_COLORS.WARNING
            : chance > 0
              ? WIDGET_COLORS.INFO
              : WIDGET_COLORS.SUCCESS,
    };
  });
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en', units, settings = {} } = {}) {
      const lang = BASIN_NAMES[language] ? language : 'en';
      const unit = unitsOf(units, monitor.config.units);
      const updated = monitor.lastSuccessAt;
      const source = t(TEXT.source, lang);
      const components = [
        {
          type: 'text',
          variant: 'heading',
          text: updated === null ? t(TEXT.waiting, lang) : heading(monitor.storms, lang),
        },
      ];
      if (monitor.storms.length > 0) {
        components.push({
          type: 'card-list',
          display: 'list',
          items: monitor.storms.slice(0, MAX_ITEMS).map((storm) => itemOf(storm, lang, unit)),
        });
      }
      if (settings.show_outlook !== false && updated !== null && monitor.config.basins.length > 0) {
        components.push({ type: 'status', items: outlookRows(monitor, lang) });
      }
      components.push({
        type: 'text',
        variant: 'caption',
        text: updated === null ? source : `${source} · ${formatDate(updated, lang)}`,
      });
      if (settings.show_link !== false) {
        components.push({
          type: 'button',
          label: t(TEXT.site, lang),
          icon: 'external-link',
          link: { url: NHC_SITE },
        });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
