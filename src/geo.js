// -----------------------------------------------------------------------------
// Distances and directions on the Earth, enough for "the storms around my
// home", and the unit conversions of the NHC (knots, mph).
// -----------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
export const KM_PER_MILE = 1.609344;
const rad = (degrees) => (degrees * Math.PI) / 180;
const deg = (radians) => (radians * 180) / Math.PI;

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from the first point to the second, 0-359 degrees (0 north, 90 east). */
export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return Math.round(deg(Math.atan2(y, x)) + 360) % 360;
}

/** One of the 16 points of the compass (0 = N … 15 = NNW). */
export const compassIndex = (degrees) => Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;

// The NHC rounds the wind of its advisories to the nearest 5 mph and 5 km/h
// (45 kt: "50 mph, 85 km/h"): the same here, so the numbers match theirs.
const toFive = (value) => Math.round(value / 5) * 5;
export const ktToMph = (kt) => toFive(kt * 1.150779);
export const ktToKmh = (kt) => toFive(kt * 1.852);

/** A wind in knots, in the chosen unit. */
export const windIn = (kt, units) => (units === 'metric' ? ktToKmh(kt) : ktToMph(kt));
/** A speed in mph (movement of a storm), in the chosen unit. */
export const mphIn = (mph, units) => (units === 'metric' ? Math.round(mph * KM_PER_MILE) : mph);
/** A distance in km, in the chosen unit. */
export const kmIn = (km, units) => (units === 'metric' ? km : km / KM_PER_MILE);
