import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import TrafficMap from '../components/TrafficMap';
import VehicleModeSelector from '../components/VehicleModeSelector';
import { useLocation } from '../hooks/useLocation';
import { fetchRouteOptions, RouteOption, TravelMode } from '../lib/directions';
import { fetchRouteUsageCounts } from '../lib/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, spacing } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RouteSelect'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'RouteSelect'>;

interface Props {
  navigation: NavigationProp;
}

// Rough estimate of how many concurrent drivers a typical road segment can
// absorb before it's considered "loaded" — requirement #5's road-capacity
// estimate, deliberately simple rather than a full traffic-engineering model.
const ESTIMATED_ROUTE_CAPACITY = 25;

export default function RouteSelectScreen({ navigation }: Props) {
  const { params } = useRoute<ScreenRouteProp>();
  const { location } = useLocation();
  const [mode, setMode] = useState<TravelMode>('driving');
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balancedNotice, setBalancedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBalancedNotice(false);

    (async () => {
      try {
        const routes = await fetchRouteOptions(location, params.destination, mode);
        if (cancelled) return;
        if (routes.length === 0) {
          setOptions([]);
          setError('No route found to this destination.');
          return;
        }

        let chosen = routes[0];
        try {
          const usage = await fetchRouteUsageCounts(routes.map((r) => r.routeKey));
          const fastestUsage = usage[chosen.routeKey] ?? 0;
          if (fastestUsage >= ESTIMATED_ROUTE_CAPACITY) {
            const lessLoaded = routes.find((r) => (usage[r.routeKey] ?? 0) < fastestUsage);
            if (lessLoaded) {
              chosen = lessLoaded;
              if (!cancelled) setBalancedNotice(true);
            }
          }
        } catch {
          // Fairness lookup is best-effort — fall back to the fastest route.
        }

        if (!cancelled) {
          setOptions(routes);
          setSelectedKey(chosen.routeKey);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load routes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location?.latitude, location?.longitude, params.destination, mode]);

  const selectedRoute = useMemo(
    () => options.find((route) => route.routeKey === selectedKey) ?? null,
    [options, selectedKey],
  );
  const alternativeRoutes = useMemo(
    () => options.filter((route) => route.routeKey !== selectedKey),
    [options, selectedKey],
  );

  const handleStart = () => {
    if (!selectedRoute || !location) return;
    navigation.navigate('Navigation', {
      origin: location,
      destination: params.destination,
      destinationLabel: params.destinationLabel,
      mode,
      initialRoute: selectedRoute,
    });
  };

  return (
    <View style={styles.container}>
      <TrafficMap
        userLocation={location}
        destCoords={params.destination}
        activeRoute={selectedRoute}
        alternativeRoutes={alternativeRoutes}
        onSelectAlternative={(route) => setSelectedKey(route.routeKey)}
      />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.locationBar}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            Your Location
          </Text>
        </View>
        <VehicleModeSelector mode={mode} onChange={setMode} />
      </SafeAreaView>

      {loading && (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Finding routes…</Text>
        </View>
      )}

      {!loading && balancedNotice && (
        <View style={styles.noticePill}>
          <Text style={styles.noticeText}>Balanced route selected to reduce congestion</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.noticePill}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      <View style={styles.bottomBar}>
        {selectedRoute && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryDuration}>{selectedRoute.durationInTrafficText}</Text>
            <Text style={styles.summaryMeta}>
              {selectedRoute.distanceText}
              {selectedRoute.hasTolls === null ? '' : selectedRoute.hasTolls ? ' · Tolls' : ' · No tolls'}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.startButton, !selectedRoute && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!selectedRoute}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    gap: spacing.md,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingPill: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  noticePill: {
    position: 'absolute',
    top: 130,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noticeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
    gap: 2,
  },
  summaryDuration: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
