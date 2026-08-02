import type { LatLng, RouteOption } from './directions';
import { haversineMeters } from './geo';

// Open-Meteo requires no API key, which keeps weather-hazard detection
// working out of the box without another secret to provision.
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export type WeatherHazard = 'rain' | 'fog' | 'storm' | 'snow' | 'wind';

export interface WeatherSnapshot {
  temperatureC: number;
  windSpeedKmh: number;
  weatherCode: number;
  hazard: WeatherHazard | null;
}

/** A forecast for one point on the route, timed to when the driver gets there. */
export interface RouteWeatherPoint {
  coordinate: LatLng;
  /** Distance from the driver's current step to this point. */
  distanceMeters: number;
  /** Seconds from now until the driver is expected to reach this point. */
  etaSeconds: number;
  temperatureC: number;
  windSpeedKmh: number;
  weatherCode: number;
  /** `null` when the provider doesn't report it for this hour. */
  precipitationChance: number | null;
  hazard: WeatherHazard | null;
  /** 'current' for points reached within the hour, 'forecast' further out. */
  source: 'current' | 'forecast';
}

// https://open-meteo.com/en/docs — WMO weather interpretation codes.
function classifyHazard(weatherCode: number, windSpeedKmh: number): WeatherHazard | null {
  if ([95, 96, 99].includes(weatherCode)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'snow';
  if ([45, 48].includes(weatherCode)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'rain';
  if (windSpeedKmh >= 50) return 'wind';
  return null;
}

export async function fetchWeatherSnapshot(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,weather_code,wind_speed_10m',
  });

  const response = await fetch(`${FORECAST_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }
  const json = await response.json();
  const current = json.current;

  const weatherCode: number = current.weather_code;
  const windSpeedKmh: number = current.wind_speed_10m;

  return {
    temperatureC: current.temperature_2m,
    windSpeedKmh,
    weatherCode,
    hazard: classifyHazard(weatherCode, windSpeedKmh),
  };
}

export function hazardTitle(hazard: WeatherHazard): string {
  switch (hazard) {
    case 'fog':
      return 'Fog Detected Ahead';
    case 'rain':
      return 'Rain Detected Ahead';
    case 'snow':
      return 'Snow Detected Ahead';
    case 'storm':
      return 'Storm Warning Ahead';
    case 'wind':
      return 'High Winds Ahead';
  }
}

export function hazardMessage(hazard: WeatherHazard): string {
  switch (hazard) {
    case 'fog':
      return 'Low visibility due to fog. Drive carefully.';
    case 'rain':
      return 'Roads may be slippery — drive carefully.';
    case 'snow':
      return 'Snow may reduce traction. Reduce speed.';
    case 'storm':
      return 'Thunderstorms nearby. Consider delaying travel.';
    case 'wind':
      return 'Strong winds may affect vehicle control.';
  }
}

/** Short chip-sized name for a hazard, e.g. "Rain near 12km". */
export function hazardLabel(hazard: WeatherHazard): string {
  switch (hazard) {
    case 'fog':
      return 'Fog';
    case 'rain':
      return 'Rain';
    case 'snow':
      return 'Snow';
    case 'storm':
      return 'Storm';
    case 'wind':
      return 'High wind';
  }
}

export function hazardIcon(hazard: WeatherHazard): string {
  switch (hazard) {
    case 'fog':
      return '🌫️';
    case 'rain':
      return '🌧️';
    case 'snow':
      return '❄️';
    case 'storm':
      return '⛈️';
    case 'wind':
      return '💨';
  }
}

const WEATHER_CODE_TEXT: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

export function weatherCodeText(code: number): string {
  return WEATHER_CODE_TEXT[code] ?? 'Unknown conditions';
}

export function weatherCodeIcon(code: number): string {
  if (code >= 95) return '⛈️';
  if (code >= 85) return '🌨️';
  if (code >= 80) return '🌦️';
  if (code >= 71) return '❄️';
  if (code >= 61) return '🌧️';
  if (code >= 51) return '🌦️';
  if (code >= 45) return '🌫️';
  if (code >= 3) return '☁️';
  if (code >= 1) return '🌤️';
  return '☀️';
}

// ---------------------------------------------------------------------------
// Weather along the route
// ---------------------------------------------------------------------------

/** How many points along the path to forecast, including start and arrival. */
const ROUTE_SAMPLE_COUNT = 6;
/** Sample points closer together than this describe the same weather, so they're collapsed. */
const MIN_SAMPLE_SPACING_M = 800;
/** Points reached within this window use the "current" reading instead of an hourly forecast. */
const CURRENT_READING_WINDOW_S = 30 * 60;

interface RouteSample {
  coordinate: LatLng;
  distanceMeters: number;
  etaSeconds: number;
}

/**
 * Picks evenly spaced points along the road still ahead of the driver and works
 * out when they reach each one. Step durations are free-flow estimates, so
 * they're stretched onto the route's traffic-aware ETA — the forecast is only
 * useful if it's read at the hour the driver actually arrives.
 */
function sampleAlongRoute(route: RouteOption, stops: number, fromStepIndex: number): RouteSample[] {
  // The traffic factor comes from the whole route: a partial trip's steps can't
  // be compared against a whole-trip ETA.
  const freeFlowTotal = route.steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  const trafficFactor = route.durationInTrafficSeconds / Math.max(freeFlowTotal, 1);

  const start = Math.min(Math.max(fromStepIndex, 0), Math.max(route.steps.length - 1, 0));
  const steps = route.steps
    .slice(start)
    .filter((step) => step.coordinates.length > 0 && step.distanceMeters > 0);
  if (steps.length === 0) {
    const here = route.steps[start]?.coordinates[0] ?? route.coordinates[0];
    return here ? [{ coordinate: here, distanceMeters: 0, etaSeconds: 0 }] : [];
  }

  let runningDistance = 0;
  let runningDuration = 0;
  const legs = steps.map((step) => {
    const leg = { step, startDistance: runningDistance, startDuration: runningDuration };
    runningDistance += step.distanceMeters;
    runningDuration += step.durationSeconds;
    return leg;
  });

  const totalDistance = runningDistance;
  const count = Math.max(2, stops);
  const samples: RouteSample[] = [];

  for (let i = 0; i < count; i += 1) {
    const target = (totalDistance * i) / (count - 1);
    const leg =
      legs.find((candidate) => candidate.startDistance + candidate.step.distanceMeters >= target) ??
      legs[legs.length - 1];
    const within = Math.min(1, Math.max(0, (target - leg.startDistance) / leg.step.distanceMeters));
    const coordinate = leg.step.coordinates[Math.round(within * (leg.step.coordinates.length - 1))];
    if (!coordinate) continue;

    samples.push({
      coordinate,
      distanceMeters: target,
      etaSeconds: (leg.startDuration + leg.step.durationSeconds * within) * trafficFactor,
    });
  }

  return collapseNearbySamples(samples);
}

function collapseNearbySamples(samples: RouteSample[]): RouteSample[] {
  const kept: RouteSample[] = [];
  for (const sample of samples) {
    const previous = kept[kept.length - 1];
    if (!previous || haversineMeters(previous.coordinate, sample.coordinate) >= MIN_SAMPLE_SPACING_M) {
      kept.push(sample);
    }
  }

  // The arrival point is the one the driver cares about most — never drop it.
  const arrival = samples[samples.length - 1];
  if (arrival && kept[kept.length - 1] !== arrival) {
    if (kept.length > 1) kept[kept.length - 1] = arrival;
    else kept.push(arrival);
  }

  return kept;
}

interface Reading {
  temperatureC: number;
  windSpeedKmh: number;
  weatherCode: number;
  precipitationChance: number | null;
}

function readCurrent(location: any): Reading | null {
  const current = location?.current;
  if (!current || typeof current.weather_code !== 'number') return null;
  return {
    temperatureC: current.temperature_2m,
    windSpeedKmh: current.wind_speed_10m,
    weatherCode: current.weather_code,
    precipitationChance: null,
  };
}

/** Picks the hourly entry closest to `targetUnix`; times come back sorted, so it stops once they start diverging. */
function readHourly(location: any, targetUnix: number): Reading | null {
  const hourly = location?.hourly;
  const times: number[] | undefined = hourly?.time;
  if (!times?.length) return null;

  let bestIndex = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const delta = Math.abs(times[i] - targetUnix);
    if (delta > bestDelta) break;
    bestDelta = delta;
    bestIndex = i;
  }

  const weatherCode = hourly.weather_code?.[bestIndex];
  if (typeof weatherCode !== 'number') return null;

  const chance = hourly.precipitation_probability?.[bestIndex];
  return {
    temperatureC: hourly.temperature_2m?.[bestIndex],
    windSpeedKmh: hourly.wind_speed_10m?.[bestIndex],
    weatherCode,
    precipitationChance: typeof chance === 'number' ? chance : null,
  };
}

export interface RouteWeatherOptions {
  /** Step the driver is currently on — everything before it is already behind them. */
  fromStepIndex?: number;
  /** How many points to forecast, including where they are now and their arrival. */
  stops?: number;
}

/**
 * Forecasts the weather at several points along the road ahead, each read at
 * the hour the driver is expected to be there. Open-Meteo takes comma-separated
 * coordinates, so the whole path costs a single request.
 */
export async function fetchRouteWeather(
  route: RouteOption,
  { fromStepIndex = 0, stops = ROUTE_SAMPLE_COUNT }: RouteWeatherOptions = {},
): Promise<RouteWeatherPoint[]> {
  const samples = sampleAlongRoute(route, stops, fromStepIndex);
  if (samples.length === 0) return [];

  const params = new URLSearchParams({
    latitude: samples.map((sample) => sample.coordinate.latitude.toFixed(4)).join(','),
    longitude: samples.map((sample) => sample.coordinate.longitude.toFixed(4)).join(','),
    current: 'temperature_2m,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,wind_speed_10m,precipitation_probability',
    // Unix timestamps are always GMT+0, which keeps arrival-hour matching free
    // of any timezone parsing.
    timeformat: 'unixtime',
    forecast_days: '2',
  });

  const response = await fetch(`${FORECAST_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const json = await response.json();
  // A single coordinate returns an object; multiple return an array.
  const locations: any[] = Array.isArray(json) ? json : [json];
  const nowSeconds = Math.floor(Date.now() / 1000);

  const points: RouteWeatherPoint[] = [];

  samples.forEach((sample, index) => {
    const location = locations[index];
    if (!location) return;

    const useCurrent = sample.etaSeconds <= CURRENT_READING_WINDOW_S;
    const reading = useCurrent
      ? readCurrent(location) ?? readHourly(location, nowSeconds + sample.etaSeconds)
      : readHourly(location, nowSeconds + sample.etaSeconds) ?? readCurrent(location);
    if (!reading) return;

    points.push({
      coordinate: sample.coordinate,
      distanceMeters: sample.distanceMeters,
      etaSeconds: sample.etaSeconds,
      temperatureC: reading.temperatureC,
      windSpeedKmh: reading.windSpeedKmh,
      weatherCode: reading.weatherCode,
      precipitationChance: reading.precipitationChance,
      hazard: classifyHazard(reading.weatherCode, reading.windSpeedKmh),
      source: useCurrent ? 'current' : 'forecast',
    });
  });

  return points;
}
