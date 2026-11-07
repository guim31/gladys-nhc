// -----------------------------------------------------------------------------
// The scene action `read_storms` and the configuration action `check_now`.
// Both read the NHC again when the last cycle is older than one interval, and
// answer with the storms of the followed basins as one sentence: something a
// scene can send by message or read aloud, strongest first, plus the highest
// formation chance of the outlook.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS, formatTime, render, sentence } from './messages.js';

const logger = createLogger({ name: 'nhc-actions' });

export const SCENE_ACTION = 'read_storms';
export const CONFIG_ACTION = 'check_now';

/** Scene action: outputs `text`, `count` and `max_category`; throws if the NHC never answered. */
export async function readStorms(monitor) {
  const { storms, ok } = await monitor.fresh();
  const { language, units } = monitor.config;
  if (!ok) {
    throw new Error(render(STATUS, 'nhcDown')[language]);
  }
  return {
    text: sentence(storms, monitor.bestOutlook(), language, units),
    count: storms.length,
    max_category: Math.max(0, ...storms.map((storm) => storm.category)),
  };
}

/** Configuration action: the storms now, in every language. */
export async function checkNow(monitor) {
  const { storms, ok } = await monitor.fresh();
  logger.info(`Check requested: ${ok ? `${storms.length} storm(s) followed` : 'NHC unreachable'}`);
  if (!ok) {
    return render(STATUS, 'nhcDown');
  }
  const outlook = monitor.bestOutlook();
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      render(STATUS, 'summary', {
        text: sentence(storms, outlook, language, monitor.config.units),
        time: formatTime(monitor.lastSuccessAt, language),
      })[language],
    ]),
  );
}
