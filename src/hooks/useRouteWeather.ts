import { useCallback, useEffect, useRef, useState } from 'react';
import { RouteOption } from '../lib/directions';
import { fetchRouteWeather, RouteWeatherPoint } from '../lib/weather';

interface RouteWeatherState {
  points: RouteWeatherPoint[];
  loading: boolean;
  error: string | null;
  /** Epoch ms of the last successful load, or null if it hasn't loaded yet. */
  updatedAt: number | null;
  refresh: () => void;
}

/** A forecast this old is worth re-fetching the next time the panel is opened. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Loads the forecast along `route`, but only while `enabled` — the weather view
 * is opt-in, so a driver who never opens it never pays for the request.
 *
 * `stepIndex` is read through a ref rather than watched: advancing a turn while
 * the panel is open shouldn't fire a request every couple of minutes, but
 * re-opening it after real progress should forecast the road actually left.
 */
export function useRouteWeather(
  route: RouteOption | null,
  enabled: boolean,
  stepIndex = 0,
): RouteWeatherState {
  const [points, setPoints] = useState<RouteWeatherPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const routeRef = useRef(route);
  const stepIndexRef = useRef(stepIndex);
  const requestIdRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    routeRef.current = route;
    stepIndexRef.current = stepIndex;
  }, [route, stepIndex]);

  const refresh = useCallback(async () => {
    const current = routeRef.current;
    if (!current) return;

    const fromStepIndex = stepIndexRef.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const next = await fetchRouteWeather(current, { fromStepIndex });
      if (requestId !== requestIdRef.current) return;
      setPoints(next);
      setUpdatedAt(Date.now());
      loadedKeyRef.current = `${current.routeKey}:${fromStepIndex}`;
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load weather for this route.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Re-runs when the panel opens or the driver reroutes; `updatedAt` is read
  // rather than watched so a successful load doesn't retrigger the effect.
  useEffect(() => {
    if (!enabled || !route) return;
    const isStale = updatedAt === null || Date.now() - updatedAt > STALE_AFTER_MS;
    if (loadedKeyRef.current === `${route.routeKey}:${stepIndexRef.current}` && !isStale) return;
    refresh();
  }, [enabled, route?.routeKey, refresh]);

  return { points, loading, error, updatedAt, refresh };
}
