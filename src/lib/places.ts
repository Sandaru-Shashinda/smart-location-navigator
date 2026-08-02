import * as Location from 'expo-location';
import type { LatLng } from './directions';
import { haversineMeters } from './geo';

export interface PlaceSuggestion {
  id: string;
  /** Primary line — what the place is called ("Galle Face Green"). */
  title: string;
  /** Secondary line — where it is ("Colombo, Western Province, Sri Lanka"); empty when unknown. */
  subtitle: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance from the bias point, or null when none was supplied. */
  distanceMeters: number | null;
}

/** Below this a query matches half the planet, so the type-ahead stays quiet. */
export const MIN_QUERY_LENGTH = 2;

// Photon is a free, keyless geocoder built specifically for search-as-you-type
// over OpenStreetMap data — the same reasoning behind the OSRM demo server in
// directions.ts: a fresh checkout gets working place search with no API key, no
// billing account and no signup. Google Places Autocomplete would be the paid
// alternative and needs a billing-enabled Cloud project even inside the free
// tier. The public instance asks that usage be fair, which is why callers
// debounce and why queries shorter than MIN_QUERY_LENGTH never leave the device.
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

/**
 * React Native's fetch has no default timeout, so a request that never comes
 * back would leave the type-ahead spinner turning forever with nothing to show.
 * This bounds every lookup and reports running out of time as a normal failure.
 */
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abortNow = () => controller.abort();
  const timer = setTimeout(abortNow, REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', abortNow);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    // A newer keystroke cancelling this request isn't worth showing the driver;
    // the request timing out is.
    if (!signal?.aborted && controller.signal.aborted) {
      throw new Error('Place search timed out — check your connection.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortNow);
  }
}

interface PhotonProperties {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
}

/**
 * Photon labels pure addresses with no `name`, so the house number and street
 * stand in; failing that the smallest administrative area it did return does.
 */
function formatTitle(props: PhotonProperties): string | null {
  if (props.name) return props.name;
  if (props.street) return props.housenumber ? `${props.housenumber} ${props.street}` : props.street;
  return props.city || props.county || props.state || props.country || null;
}

/** Any more than this and the line just truncates mid-word on a phone. */
const MAX_SUBTITLE_PARTS = 3;

/**
 * Builds the "where is it" line from the most specific administrative parts
 * outward, dropping anything the title already says — otherwise a city search
 * reads "Colombo · Colombo, Western Province" and "221B Baker Street" is
 * followed by "Baker Street".
 */
function formatSubtitle(props: PhotonProperties, title: string): string {
  const parts = [props.street, props.district, props.city, props.county, props.state, props.country];
  const lowerTitle = title.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key) || lowerTitle.includes(key)) continue;
    seen.add(key);
    out.push(part);
    if (out.length === MAX_SUBTITLE_PARTS) break;
  }

  return out.join(', ');
}

function toSuggestions(features: PhotonFeature[], near: LatLng | null): PlaceSuggestion[] {
  const suggestions: PlaceSuggestion[] = [];
  const seen = new Set<string>();

  features.forEach((feature, index) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    const props = feature.properties ?? {};
    const title = formatTitle(props);
    if (!title) return;

    const subtitle = formatSubtitle(props, title);
    // Photon can return the same place as separate OSM nodes/ways (a shop
    // mapped as both a point and a building outline), which reads as a
    // duplicate row even though the ids differ.
    const dedupeKey = `${title}|${subtitle}`.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const [longitude, latitude] = coords;
    suggestions.push({
      id: props.osm_id ? `${props.osm_type ?? 'N'}${props.osm_id}` : `${latitude},${longitude},${index}`,
      title,
      subtitle,
      latitude,
      longitude,
      distanceMeters: near ? haversineMeters(near, { latitude, longitude }) : null,
    });
  });

  return suggestions;
}

/**
 * Type-ahead place lookup. Results keep the provider's own ranking rather than
 * being re-sorted by distance — a nearby bus stop shouldn't outrank the city
 * the driver actually typed.
 *
 * Pass `signal` to drop a request the next keystroke has already superseded.
 */
export async function fetchPlaceSuggestions(
  query: string,
  options: { near?: LatLng | null; limit?: number; signal?: AbortSignal } = {},
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const { near = null, limit = 6, signal } = options;
  const params = new URLSearchParams({ q: trimmed, limit: String(limit), lang: 'en' });

  if (near) {
    // Bias toward the driver: "station" should mean the one down the road, not
    // the highest-ranked one on the planet.
    params.set('lat', near.latitude.toFixed(5));
    params.set('lon', near.longitude.toFixed(5));
  }

  const response = await fetchWithTimeout(`${PHOTON_ENDPOINT}?${params.toString()}`, signal);
  if (!response.ok) {
    throw new Error(`Place search failed: ${response.status}`);
  }

  const json = await response.json();
  return toSuggestions((json.features ?? []) as PhotonFeature[], near);
}

/**
 * Resolves free text the user submitted without picking a suggestion (hitting
 * "search" mid-type, or a query Photon has no POI for). Falls back to the
 * device's own geocoder, which handles plain postal addresses well but returns
 * coordinates only — hence the typed text standing in as the label.
 */
export async function resolveDestination(
  query: string,
  near: LatLng | null = null,
): Promise<PlaceSuggestion | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const [best] = await fetchPlaceSuggestions(trimmed, { near, limit: 1 });
    if (best) return best;
  } catch {
    // Provider unreachable or rate-limited — the device geocoder below is the
    // whole point of having a fallback, so this failure isn't surfaced.
  }

  const [match] = await Location.geocodeAsync(trimmed);
  if (!match) return null;

  return {
    id: `geocoded:${match.latitude},${match.longitude}`,
    title: trimmed,
    subtitle: '',
    latitude: match.latitude,
    longitude: match.longitude,
    distanceMeters: near ? haversineMeters(near, match) : null,
  };
}
