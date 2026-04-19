import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  location: Coordinates | null;
  errorMsg: string | null;
  loading: boolean;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<Coordinates | null>(null);
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

  return { location, errorMsg, loading };
}
