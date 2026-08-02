import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  location: Coordinates | null;
  /** Ground speed in meters/second, when the device can report it. */
  speed: number | null;
  heading: number | null;
  errorMsg: string | null;
  loading: boolean;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (cancelled) return;

      if (status !== 'granted') {
        setErrorMsg('Location permission denied. Enable it in Settings to use the map.');
        setLoading(false);
        return;
      }

      // Real-time capture at regular intervals, per the location-handling
      // requirement: a GPS fix at least every 5s or every 10m of movement.
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (pos) => {
          if (!cancelled) {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setSpeed(pos.coords.speed && pos.coords.speed >= 0 ? pos.coords.speed : null);
            setHeading(pos.coords.heading && pos.coords.heading >= 0 ? pos.coords.heading : null);
            setLoading(false);
          }
        },
      );

      if (cancelled) {
        subscription.remove();
      } else {
        watcherRef.current = subscription;
      }
    };

    startWatching();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, []);

  return { location, speed, heading, errorMsg, loading };
}
