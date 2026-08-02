import type { TrafficLevel } from '../theme/colors';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type TravelMode = 'driving' | 'bicycling' | 'motorcycle' | 'truck';

export type DirectionsProvider = 'google' | 'osrm';

export interface TrafficSegment {
  coordinates: LatLng[];
  level: TrafficLevel;
}

export interface RouteStep {
  coordinates: LatLng[];
  instruction: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  maneuver: string | null;
}

export interface RouteOption {
  /** Stable key derived from the route's summary + rounded endpoints; used both as a React key and as the fairness-routing identifier. */
  routeKey: string;
  summary: string;
  coordinates: LatLng[];
  steps: RouteStep[];
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  durationInTrafficSeconds: number;
  durationInTrafficText: string;
  trafficLevel: TrafficLevel;
  /** `null` when the provider can't tell us — don't claim "No tolls" in that case. */
  hasTolls: boolean | null;
  /** False when the ETA is a static estimate rather than a live traffic-aware one. */
  hasLiveTraffic: boolean;
  /** Free-flowing speed for this trip's vehicle, so a cyclist at cycling pace isn't read as a traffic jam. */
  paceReferenceKmh: number;
}

// Which routing backend to use.
//
//   osrm   — the public OSRM demo server. No API key, no billing account, no
//            signup. Static (non-traffic) ETAs, car profile only.
//   google — Directions API. Live traffic-aware ETAs and toll avoidance, but
//            the Google Cloud project MUST have billing enabled or every call
//            comes back REQUEST_DENIED, even within the free monthly quota.
//
// Defaults to osrm so a fresh checkout routes with zero setup. Flip to google
// with EXPO_PUBLIC_DIRECTIONS_PROVIDER=google in .env once billing is on.
const PROVIDER: DirectionsProvider =
  process.env.EXPO_PUBLIC_DIRECTIONS_PROVIDER === 'google' ? 'google' : 'osrm';

export const directionsProvider = PROVIDER;

/** Decodes a Google/OSRM encoded polyline (precision 5) into an array of coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Rounds to ~110m precision so nearby drivers on the same road hash identically for fairness-aware routing. */
export function roundForHash(value: number): string {
  return value.toFixed(3);
}

export function buildRouteKey(origin: LatLng, destination: LatLng, summary: string): string {
  return [
    roundForHash(origin.latitude),
    roundForHash(origin.longitude),
    roundForHash(destination.latitude),
    roundForHash(destination.longitude),
    summary || 'route',
  ].join(':');
}

export function metersToDistanceText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

/** Live-traffic classification: how much worse the trip is right now vs. its typical duration. */
function classifyByTrafficRatio(durationSeconds: number, durationInTrafficSeconds: number): TrafficLevel {
  const ratio = durationInTrafficSeconds / Math.max(durationSeconds, 1);
  if (ratio >= 1.4) return 'high';
  if (ratio >= 1.15) return 'medium';
  return 'low';
}

/** Typical urban cycling speed — also the free-flow reference for bicycle trips. */
const BICYCLE_SPEED_KMH = 15;
/** Free-flow reference for motor vehicles, i.e. the speed at which a road reads as clear. */
const MOTOR_SPEED_KMH = 45;

function paceReferenceKmh(mode: TravelMode): number {
  return mode === 'bicycling' ? BICYCLE_SPEED_KMH : MOTOR_SPEED_KMH;
}

/**
 * Judges a stretch of road by how its pace compares to free-flow for that
 * vehicle: at or above reference reads "low", under ~45% of it reads "high".
 * Scaling by vehicle matters — 15 km/h is a jam in a car and a normal pace on
 * a bike. Without a live feed this is a road-type signal, not a congestion
 * signal, which is what `hasLiveTraffic: false` tells the UI.
 */
function classifyByPace(speedKmh: number, referenceKmh: number): TrafficLevel {
  if (speedKmh >= referenceKmh) return 'low';
  if (speedKmh >= referenceKmh * 0.45) return 'medium';
  return 'high';
}

function averageSpeedKmh(distanceMeters: number, durationSeconds: number): number {
  return (distanceMeters / Math.max(durationSeconds, 1)) * 3.6;
}

// ---------------------------------------------------------------------------
// Google Directions provider
// ---------------------------------------------------------------------------

// Directions API is called as a plain HTTP request from JS, not through the
// native Maps SDK, so it can't use an iOS/Android app-restricted key (those
// restrictions only apply to native SDK requests that carry bundle/package
// headers). Use a separate key restricted only by API, falling back to the
// map key for simpler single-key setups.
const GOOGLE_DIRECTIONS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';
const DIRECTIONS_ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';

// Real driving-vehicle Google modes only support "driving" — bicycling has
// its own mode, and there's no first-class "truck"/"motorcycle" profile on
// the free Directions API, so those fall back to "driving" with the UI
// simply remembering the user's selected vehicle for the trip summary.
function toGoogleMode(mode: TravelMode): 'driving' | 'bicycling' {
  return mode === 'bicycling' ? 'bicycling' : 'driving';
}

interface GoogleStep {
  polyline: { points: string };
  html_instructions: string;
  distance: { value: number; text: string };
  duration: { value: number };
  maneuver?: string;
}

interface GoogleRoute {
  summary: string;
  overview_polyline: { points: string };
  legs: Array<{
    distance: { value: number; text: string };
    duration: { value: number; text: string };
    duration_in_traffic?: { value: number; text: string };
    steps: GoogleStep[];
  }>;
}

async function requestGoogleRoutes(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  avoidTolls: boolean,
): Promise<GoogleRoute[]> {
  if (!GOOGLE_DIRECTIONS_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY.');
  }

  const googleMode = toGoogleMode(mode);
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: googleMode,
    alternatives: 'true',
    key: GOOGLE_DIRECTIONS_API_KEY,
  });

  if (googleMode === 'driving') {
    params.set('departure_time', 'now');
    params.set('traffic_model', 'best_guess');
  }
  if (avoidTolls) {
    params.set('avoid', 'tolls');
  }

  const response = await fetch(`${DIRECTIONS_ENDPOINT}?${params.toString()}`);
  const json = await response.json();

  if (json.status !== 'OK') {
    if (json.status === 'ZERO_RESULTS') return [];
    throw new Error(`Directions request failed: ${json.status}${json.error_message ? ` — ${json.error_message}` : ''}`);
  }

  return json.routes as GoogleRoute[];
}

function fromGoogleRoute(
  route: GoogleRoute,
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  hasTolls: boolean | null,
): RouteOption | null {
  const leg = route.legs[0];
  if (!leg) return null;

  const durationSeconds = leg.duration.value;
  const durationInTrafficSeconds = leg.duration_in_traffic?.value ?? durationSeconds;

  return {
    routeKey: buildRouteKey(origin, destination, route.summary),
    summary: route.summary || 'Route',
    coordinates: decodePolyline(route.overview_polyline.points),
    steps: leg.steps.map((step) => ({
      coordinates: decodePolyline(step.polyline.points),
      instruction: stripHtml(step.html_instructions),
      distanceMeters: step.distance.value,
      distanceText: step.distance.text,
      durationSeconds: step.duration.value,
      maneuver: step.maneuver ?? null,
    })),
    distanceMeters: leg.distance.value,
    distanceText: leg.distance.text,
    durationSeconds,
    durationText: leg.duration.text,
    durationInTrafficSeconds,
    durationInTrafficText: leg.duration_in_traffic?.text ?? leg.duration.text,
    trafficLevel: classifyByTrafficRatio(durationSeconds, durationInTrafficSeconds),
    hasTolls,
    hasLiveTraffic: leg.duration_in_traffic != null,
    paceReferenceKmh: paceReferenceKmh(mode),
  };
}

async function fetchGoogleOptions(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  avoidTolls: boolean,
): Promise<RouteOption[]> {
  const routes = await requestGoogleRoutes(origin, destination, mode, avoidTolls);
  // A route from the avoid=tolls request is known toll-free; the plain request
  // tells us nothing either way, so it stays unknown rather than claiming
  // "No tolls" the legacy Directions API never actually reported.
  const tollState = avoidTolls ? false : null;
  return routes
    .map((route) => fromGoogleRoute(route, origin, destination, mode, tollState))
    .filter((option): option is RouteOption => option !== null);
}

// ---------------------------------------------------------------------------
// OSRM provider (public demo server — no key, no billing)
// ---------------------------------------------------------------------------

// The demo server only has the car profile deployed: requesting /bike or
// /foot silently returns car routing, so the profile stays "driving" and the
// bicycle case is handled by re-timing the route below instead of pretending
// the server routed for a bike.
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

interface OsrmManeuver {
  type: string;
  modifier?: string;
  exit?: number;
  bearing_after?: number;
}

interface OsrmStep {
  geometry: string;
  name: string;
  ref?: string;
  distance: number;
  duration: number;
  maneuver: OsrmManeuver;
}

interface OsrmRoute {
  geometry: string;
  distance: number;
  duration: number;
  legs: Array<{
    summary: string;
    distance: number;
    duration: number;
    steps: OsrmStep[];
  }>;
}

const COMPASS_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

function compassDirection(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 45) % 8];
}

/** "slight left" → "slightly left" so the spoken/banner text reads naturally. */
function turnPhrase(modifier: string): string {
  return modifier.replace('slight ', 'slightly ').replace('sharp ', 'sharply ');
}

/** Maps OSRM's structured maneuver onto the Google maneuver vocabulary the UI is written against. */
function toGoogleManeuver(maneuver: OsrmManeuver): string | null {
  const modifier = maneuver.modifier ?? '';
  const side = modifier.includes('left') ? 'left' : 'right';

  switch (maneuver.type) {
    case 'depart':
    case 'arrive':
      return null;
    case 'merge':
      return 'merge';
    case 'on ramp':
    case 'off ramp':
      return `ramp-${side}`;
    case 'fork':
      return `fork-${side}`;
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return `roundabout-${side}`;
    default:
      break;
  }

  if (modifier === 'uturn') return 'uturn-left';
  if (!modifier || modifier === 'straight') return 'straight';
  return `turn-${modifier.replace(' ', '-')}`;
}

/** OSRM returns structured maneuvers, not prose, so the banner text is composed here. */
function toInstruction(step: OsrmStep): string {
  const road = step.name?.trim() || step.ref?.trim() || '';
  const onto = road ? ` onto ${road}` : '';
  const modifier = step.maneuver.modifier ?? '';
  const turn = turnPhrase(modifier);

  switch (step.maneuver.type) {
    case 'depart':
      return `Head ${compassDirection(step.maneuver.bearing_after ?? 0)}${road ? ` on ${road}` : ''}`;
    case 'arrive':
      return 'Arrive at your destination';
    case 'roundabout':
    case 'rotary':
      return step.maneuver.exit
        ? `At the roundabout, take exit ${step.maneuver.exit}${onto}`
        : `At the roundabout, continue${onto}`;
    case 'roundabout turn':
      return `At the roundabout, turn ${turn || 'straight'}${onto}`;
    case 'merge':
      return `Merge${turn ? ` ${turn}` : ''}${onto}`;
    case 'on ramp':
      return `Take the ramp${modifier ? ` on the ${modifier}` : ''}${onto}`;
    case 'off ramp':
      return `Take the exit${modifier ? ` on the ${modifier}` : ''}${onto}`;
    case 'fork':
      return `Keep ${modifier.replace('slight ', '') || 'straight'} at the fork${onto}`;
    case 'new name':
    case 'use lane':
    case 'notification':
      return `Continue${onto}`;
    case 'continue':
      if (modifier === 'uturn') return `Make a U-turn${onto}`;
      return `Continue${turn && turn !== 'straight' ? ` ${turn}` : ''}${onto}`;
    case 'end of road':
    case 'turn':
    default:
      if (modifier === 'uturn') return `Make a U-turn${onto}`;
      if (!turn || turn === 'straight') return `Continue straight${onto}`;
      return `Turn ${turn}${onto}`;
  }
}

/**
 * The demo server routes every profile as a car. For bicycle mode the geometry
 * is still usable but the ETA isn't, so durations are rescaled to a cycling
 * speed. This is an explicit estimate — it does not know about bike lanes, and
 * the roads themselves are still car roads.
 */
function paceFactor(mode: TravelMode, distanceMeters: number, carSeconds: number): number {
  if (mode !== 'bicycling') return 1;
  const cycleSeconds = (distanceMeters / 1000 / BICYCLE_SPEED_KMH) * 3600;
  return cycleSeconds / Math.max(carSeconds, 1);
}

async function fetchOsrmOptions(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
): Promise<RouteOption[]> {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline',
    steps: 'true',
    alternatives: '3',
  });

  const response = await fetch(`${OSRM_ENDPOINT}/${coords}?${params.toString()}`);
  const json = await response.json();

  if (json.code !== 'Ok') {
    if (json.code === 'NoRoute') return [];
    throw new Error(`Routing request failed: ${json.code}${json.message ? ` — ${json.message}` : ''}`);
  }

  const options: RouteOption[] = [];

  for (const route of json.routes as OsrmRoute[]) {
    const leg = route.legs[0];
    if (!leg) continue;

    const factor = paceFactor(mode, route.distance, route.duration);
    const durationSeconds = Math.round(route.duration * factor);
    const summary = leg.summary || 'Route';

    options.push({
      routeKey: buildRouteKey(origin, destination, summary),
      summary,
      coordinates: decodePolyline(route.geometry),
      steps: leg.steps.map((step) => ({
        coordinates: decodePolyline(step.geometry),
        instruction: toInstruction(step),
        distanceMeters: step.distance,
        distanceText: metersToDistanceText(step.distance),
        durationSeconds: step.duration * factor,
        maneuver: toGoogleManeuver(step.maneuver),
      })),
      distanceMeters: route.distance,
      distanceText: metersToDistanceText(route.distance),
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      // No live traffic feed: the "in traffic" ETA is the same static number,
      // so the UI shows one honest estimate instead of a fake delay.
      durationInTrafficSeconds: durationSeconds,
      durationInTrafficText: formatDuration(durationSeconds),
      trafficLevel: classifyByPace(averageSpeedKmh(route.distance, durationSeconds), paceReferenceKmh(mode)),
      // The demo server rejects exclude=toll, so toll status is unknown.
      hasTolls: null,
      hasLiveTraffic: false,
      paceReferenceKmh: paceReferenceKmh(mode),
    });
  }

  return options;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches route alternatives for a trip. On Google it also issues a second,
 * toll-avoiding request so the "no tolls" option from the design is a real
 * routed alternative rather than a guess; that call is best-effort and a
 * failure just means fewer alternatives. Results are de-duped by summary.
 */
export async function fetchRouteOptions(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode = 'driving',
): Promise<RouteOption[]> {
  if (PROVIDER === 'osrm') {
    const routes = await fetchOsrmOptions(origin, destination, mode);
    return routes.sort((a, b) => a.durationInTrafficSeconds - b.durationInTrafficSeconds);
  }

  const [normal, tollFree] = await Promise.all([
    fetchGoogleOptions(origin, destination, mode, false),
    toGoogleMode(mode) === 'driving'
      ? fetchGoogleOptions(origin, destination, mode, true).catch(() => [] as RouteOption[])
      : Promise.resolve([] as RouteOption[]),
  ]);

  const options = new Map<string, RouteOption>();
  for (const option of normal) {
    options.set(option.summary, option);
  }
  for (const option of tollFree) {
    // Only add if it's actually a different road than an existing option.
    if (!options.has(option.summary)) options.set(option.summary, option);
  }

  return Array.from(options.values()).sort((a, b) => a.durationInTrafficSeconds - b.durationInTrafficSeconds);
}

/**
 * Neither provider reports traffic per step — Google only gives it at the
 * whole-route level (duration_in_traffic) and OSRM not at all. To still render
 * a segment-coloured route like the design, each step's typical pace
 * (distance/duration, i.e. how fast that stretch of road normally moves) is
 * classified against the vehicle's free-flow reference, raised when the
 * route's overall live traffic ratio is worse — so a route already flagged
 * "high" traffic paints more of itself red/orange, while a clear route stays
 * mostly blue. Without a live feed the reference is unshifted and the colours
 * reflect road type alone.
 */
export function buildTrafficSegments(route: RouteOption): TrafficSegment[] {
  const ratio = route.durationInTrafficSeconds / Math.max(route.durationSeconds, 1);
  const shiftFactor = ratio >= 1.4 ? 1.4 : ratio >= 1.15 ? 1.18 : 1;
  const reference = route.paceReferenceKmh * shiftFactor;

  return route.steps.map((step) => ({
    coordinates: step.coordinates,
    level: classifyByPace(averageSpeedKmh(step.distanceMeters, step.durationSeconds), reference),
  }));
}
