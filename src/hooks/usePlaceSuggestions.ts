import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../lib/directions';
import { fetchPlaceSuggestions, MIN_QUERY_LENGTH, PlaceSuggestion } from '../lib/places';

interface PlaceSuggestionsState {
  suggestions: PlaceSuggestion[];
  loading: boolean;
  error: string | null;
  /** True while the query is long enough to search — lets the UI show suggestions instead of recents. */
  active: boolean;
}

/** Long enough that a burst of typing is one request, short enough to feel live. */
const DEBOUNCE_MS = 300;

/**
 * Search-as-you-type place lookup for `query`, biased toward `near`.
 *
 * Every keystroke cancels the request in flight, so a slow response for "col"
 * can't land after the results for "colombo" and overwrite them. `near` is read
 * through a ref rather than watched: a GPS tick every few seconds shouldn't
 * re-run the search, but the next keystroke should use the driver's new position.
 */
export function usePlaceSuggestions(query: string, near: LatLng | null): PlaceSuggestionsState {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nearRef = useRef(near);

  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const next = await fetchPlaceSuggestions(trimmed, {
          near: nearRef.current,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestions(next);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(err instanceof Error ? err.message : 'Could not search for places.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, active]);

  return { suggestions, loading, error, active };
}
