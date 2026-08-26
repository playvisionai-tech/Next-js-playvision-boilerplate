import { afterEach, describe, expect, it, vi } from 'vitest';
import { FORECAST_LOCATION, forecastQuery, toCondition } from '../forecast';

type FetchStub = (url: string) => Promise<Response>;

const OBSERVED_AT_UNIX = 1_787_745_600;

const signal = () => AbortSignal.timeout(1000);

/**
 * Answers with one Open-Meteo current-conditions payload.
 *
 * @param current The `current` block the fake origin should return.
 * @returns The spy standing in for global fetch, so its URL can be asserted.
 */
function stubForecast(current: Record<string, number>) {
  const fetchSpy = vi.fn<FetchStub>();

  fetchSpy.mockResolvedValue(Response.json({ current }));
  vi.stubGlobal('fetch', fetchSpy);

  return fetchSpy;
}

describe('WMO code to condition', () => {
  it.each([
    [0, 'clear'],
    [2, 'cloudy'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [73, 'snow'],
    [81, 'rain'],
    [86, 'snow'],
    [99, 'thunderstorm'],
  ])('maps %i to %s', (code, condition) => {
    expect(toCondition(code)).toBe(condition);
  });

  // The gaps in the WMO table are real: 4 to 44 and 58 to 60 mean nothing.
  it.each([4, 44, 59, 100, -1])('renders %i as unknown rather than guessing', (code) => {
    expect(toCondition(code)).toBe('unknown');
  });
});

describe('Forecast query', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('puts the location in the key, so two places are two cache entries', () => {
    const paris = forecastQuery({ latitude: 48.85, longitude: 2.35 });
    const oslo = forecastQuery({ latitude: 59.91, longitude: 10.75 });

    expect(paris.queryKey).not.toStrictEqual(oslo.queryKey);
    expect(paris.queryKey).toStrictEqual(
      forecastQuery({ latitude: 48.85, longitude: 2.35 }).queryKey,
    );
  });

  it('asks Open-Meteo for unix times, so no timestamp arrives without a zone', async () => {
    const fetchSpy = stubForecast({
      time: OBSERVED_AT_UNIX,
      temperature_2m: 28.1,
      weather_code: 1,
    });

    await forecastQuery(FORECAST_LOCATION).queryFn({ signal: signal() });

    const url = fetchSpy.mock.calls[0]?.[0];

    expect(url).toContain('https://api.open-meteo.com/v1/forecast');
    expect(url).toContain('timeformat=unixtime');
  });

  it('returns a shape with no WMO code and no snake_case left in it', async () => {
    stubForecast({ time: OBSERVED_AT_UNIX, temperature_2m: 28.1, weather_code: 95 });

    const forecast = await forecastQuery(FORECAST_LOCATION).queryFn({ signal: signal() });

    expect(forecast).toStrictEqual({
      observedAt: new Date(OBSERVED_AT_UNIX * 1000),
      celsius: 28.1,
      condition: 'thunderstorm',
    });
  });

  it('fails rather than rendering a partial reading when a field goes missing', async () => {
    stubForecast({ time: OBSERVED_AT_UNIX, temperature_2m: 28.1 });

    await expect(forecastQuery(FORECAST_LOCATION).queryFn({ signal: signal() })).rejects.toThrow(
      'did not match its schema',
    );
  });
});
