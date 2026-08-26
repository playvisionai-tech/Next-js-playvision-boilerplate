import * as z from 'zod';
import { apiFetch } from './client';
import type { ApiQuery } from './query';

/** Open-Meteo's forecast endpoint. Free, keyless, and CORS-open by design. */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * The upstream model publishes a new current-conditions value roughly every
 * fifteen minutes, so refetching faster than this returns the same numbers.
 */
const FORECAST_STALE_TIME_MS = 5 * 60_000;

/**
 * A point on the globe. The place *name* is not here: it is copy, so it lives
 * in `src/messages` like every other string a user reads.
 */
export type ForecastLocation = {
  latitude: number;
  longitude: number;
};

/** What the example slice asks about. Paris, to two decimal places. */
export const FORECAST_LOCATION: ForecastLocation = {
  latitude: 48.85,
  longitude: 2.35,
};

/**
 * The weather, in the handful of buckets this app can render.
 *
 * Open-Meteo answers with a WMO code — an integer between 0 and 99, with gaps.
 * Translating it here means no component ever branches on a number whose
 * meaning is in someone else's table, and an unrecognised code renders
 * `unknown` rather than nothing.
 */
export type ForecastCondition =
  | 'clear'
  | 'cloudy'
  | 'drizzle'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

/** WMO code ranges, in the order Open-Meteo documents them. */
const CONDITION_RANGES: readonly { from: number; to: number; condition: ForecastCondition }[] = [
  { from: 0, to: 0, condition: 'clear' },
  { from: 1, to: 3, condition: 'cloudy' },
  { from: 45, to: 48, condition: 'fog' },
  { from: 51, to: 57, condition: 'drizzle' },
  { from: 61, to: 67, condition: 'rain' },
  { from: 71, to: 77, condition: 'snow' },
  { from: 80, to: 82, condition: 'rain' },
  { from: 85, to: 86, condition: 'snow' },
  { from: 95, to: 99, condition: 'thunderstorm' },
];

/**
 * The slice of Open-Meteo's response this app reads.
 *
 * `timeformat=unixtime` is requested so `time` is an integer rather than an
 * ISO string with no offset, which is ambiguous the moment it leaves the
 * timezone the request asked for.
 */
const forecastResponseSchema = z.object({
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    weather_code: z.number(),
  }),
});

/** What a component receives: three fields, none of them WMO-shaped. */
export type Forecast = {
  observedAt: Date;
  celsius: number;
  condition: ForecastCondition;
};

/**
 * Maps a WMO weather code onto a condition this app can name.
 *
 * @param code The `weather_code` Open-Meteo returned.
 * @returns The matching condition, or `unknown` for a code outside every range.
 */
export function toCondition(code: number): ForecastCondition {
  const match = CONDITION_RANGES.find((range) => code >= range.from && code <= range.to);

  return match?.condition ?? 'unknown';
}

/**
 * Declares the current-conditions query for one location.
 *
 * The location is in the query key, so two places are two cache entries and
 * switching between them is a cache read rather than a request.
 *
 * @param location Where to ask about.
 * @returns The query, ready to hand to `useApiQuery`.
 */
export function forecastQuery(location: ForecastLocation): ApiQuery<Forecast> {
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code',
    timeformat: 'unixtime',
  });

  return {
    queryKey: ['forecast', location.latitude, location.longitude],
    queryFn: async (context) => {
      const response = await apiFetch(
        `${FORECAST_URL}?${query.toString()}`,
        forecastResponseSchema,
        {
          signal: context.signal,
        },
      );

      return {
        observedAt: new Date(response.current.time * 1000),
        celsius: response.current.temperature_2m,
        condition: toCondition(response.current.weather_code),
      };
    },
    staleTime: FORECAST_STALE_TIME_MS,
  };
}
