import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ───────────────────────────────────────────────────────────────────────
// Recent searches (Home screen "RECENT" list) — see supabase/schema.sql
// ───────────────────────────────────────────────────────────────────────
export interface RecentSearch {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

/**
 * Supabase rejects with a plain `{ message, code }` object, not an `Error`, so
 * UI that reads `err instanceof Error ? err.message : 'something went wrong'`
 * silently drops the only useful part — e.g. "Could not find the table
 * 'public.recent_searches' in the schema cache", which says the schema was
 * never applied. Re-wrapping keeps that diagnosis intact.
 */
function toError(error: { message: string; code?: string }): Error {
  return new Error(error.code ? `${error.message} (${error.code})` : error.message);
}

export async function fetchRecentSearches(limit = 5): Promise<RecentSearch[]> {
  // Over-fetch so the per-label dedupe below can still return `limit` rows.
  // Rows written before dedupe landed can repeat a destination, and RLS scopes
  // the select to the signed-in user.
  const { data, error } = await supabase
    .from('recent_searches')
    .select('id, label, latitude, longitude, created_at')
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (error) throw toError(error);

  const seen = new Set<string>();
  const unique: RecentSearch[] = [];
  for (const row of data ?? []) {
    const key = row.label.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length === limit) break;
  }
  return unique;
}

export async function saveRecentSearch(label: string, latitude: number, longitude: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // One row per destination: driving somewhere again should move it back to the
  // top of the list rather than push a duplicate into it. A failed delete just
  // means a duplicate row, which fetchRecentSearches already collapses.
  await supabase.from('recent_searches').delete().eq('user_id', user.id).eq('label', label);
  const { error } = await supabase
    .from('recent_searches')
    .insert({ user_id: user.id, label, latitude, longitude });
  if (error) throw toError(error);
}

// ───────────────────────────────────────────────────────────────────────
// Incident reports (requirement #10 — user feedback & reporting)
// ───────────────────────────────────────────────────────────────────────
export type IncidentType = 'accident' | 'hazard' | 'police' | 'closure' | 'congestion' | 'other';

export interface IncidentReport {
  id: string;
  type: IncidentType;
  description: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

export async function reportIncident(
  type: IncidentType,
  latitude: number,
  longitude: number,
  description?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to report an incident.');
  const { error } = await supabase
    .from('incident_reports')
    .insert({ user_id: user.id, type, latitude, longitude, description: description ?? null });
  if (error) throw error;
}

export async function fetchNearbyIncidents(): Promise<IncidentReport[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('id, type, description, latitude, longitude, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

// ───────────────────────────────────────────────────────────────────────
// Fairness-aware routing (requirement #5) — see supabase/schema.sql
// ───────────────────────────────────────────────────────────────────────
export async function claimRouteAssignment(
  routeKey: string,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('active_route_assignments').upsert({
    user_id: user.id,
    route_hash: routeKey,
    origin_lat: origin.latitude,
    origin_lng: origin.longitude,
    dest_lat: destination.latitude,
    dest_lng: destination.longitude,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function releaseRouteAssignment(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('active_route_assignments').delete().eq('user_id', user.id);
  if (error) throw error;
}

export async function fetchRouteUsageCounts(routeKeys: string[]): Promise<Record<string, number>> {
  if (routeKeys.length === 0) return {};
  const { data, error } = await supabase.rpc('route_usage_counts', { hashes: routeKeys });
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.route_hash] = Number(row.active_users);
  }
  return counts;
}
