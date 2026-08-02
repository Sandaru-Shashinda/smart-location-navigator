import { useEffect, useRef, useState } from 'react';
import { fetchWeatherSnapshot, WeatherHazard, WeatherSnapshot } from '../lib/weather';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface WeatherHazardState {
  hazard: WeatherHazard | null;
  /** Latest reading for the driver's position — kept even after a hazard is acknowledged. */
  snapshot: WeatherSnapshot | null;
  acknowledge: () => void;
}

const DEFAULT_POLL_MS = 10 * 60 * 1000;

// Requirement #7 — weather hazard detection: poll a weather API for the
// driver's current position and surface hazardous conditions.
export function useWeatherHazard(location: Coordinates | null, pollIntervalMs = DEFAULT_POLL_MS): WeatherHazardState {
  const [hazard, setHazard] = useState<WeatherHazard | null>(null);
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const locationRef = useRef(location);
  const dismissedRef = useRef<WeatherHazard | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!location || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const poll = async () => {
      const current = locationRef.current;
      if (!current) return;
      try {
        const next = await fetchWeatherSnapshot(current.latitude, current.longitude);
        if (cancelled) return;
        setSnapshot(next);
        setHazard(next.hazard !== dismissedRef.current ? next.hazard : null);
      } catch {
        // Transient network/API failure — leave any current hazard state as-is.
      }
    };

    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location, pollIntervalMs]);

  const acknowledge = () => {
    dismissedRef.current = hazard;
    setHazard(null);
  };

  return { hazard, snapshot, acknowledge };
}
