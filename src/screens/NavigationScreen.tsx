import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import TrafficMap from '../components/TrafficMap';
import TurnBanner from '../components/TurnBanner';
import NavStatsBar from '../components/NavStatsBar';
import AlertCard, { AlertAction } from '../components/AlertCard';
import ReportIncidentSheet from '../components/ReportIncidentSheet';
import RouteWeatherPanel from '../components/RouteWeatherPanel';
import { useLocation } from '../hooks/useLocation';
import { useDrivingSession } from '../hooks/useDrivingSession';
import { useRouteWeather } from '../hooks/useRouteWeather';
import { useWeatherHazard } from '../hooks/useWeatherHazard';
import { buildTrafficSegments, fetchRouteOptions, RouteOption } from '../lib/directions';
import { haversineMeters } from '../lib/geo';
import { hazardIcon, hazardMessage, hazardTitle, weatherCodeIcon, WeatherHazard } from '../lib/weather';
import {
  claimRouteAssignment,
  fetchNearbyIncidents,
  IncidentReport,
  IncidentType,
  releaseRouteAssignment,
  reportIncident,
} from '../lib/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Navigation'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'Navigation'>;

interface Props {
  navigation: NavigationProp;
}

const STEP_ARRIVAL_RADIUS_M = 35;
const REROUTE_CHECK_MS = 3 * 60 * 1000;
const REROUTE_MIN_SAVINGS_S = 4 * 60;
const INCIDENT_POLL_MS = 5 * 60 * 1000;

interface RerouteSuggestion {
  route: RouteOption;
  savingsSeconds: number;
}

type ActiveAlert =
  | { kind: 'reroute'; suggestion: RerouteSuggestion }
  // delayMinutes is null when the routing provider has no live traffic feed —
  // the slow stretch is still worth flagging, but the delay isn't knowable.
  | { kind: 'traffic'; delayMinutes: number | null }
  | { kind: 'weather'; hazard: WeatherHazard }
  | { kind: 'fatigue' };

export default function NavigationScreen({ navigation }: Props) {
  const { params } = useRoute<ScreenRouteProp>();
  const { location, speed, heading } = useLocation();
  const [route, setRoute] = useState<RouteOption>(params.initialRoute);
  const [stepIndex, setStepIndex] = useState(0);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [rerouteSuggestion, setRerouteSuggestion] = useState<RerouteSuggestion | null>(null);
  const [trafficDismissed, setTrafficDismissed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);

  const driving = useDrivingSession(speed);
  const weather = useWeatherHazard(location);
  const routeWeather = useRouteWeather(route, weatherOpen, stepIndex);

  const segments = useMemo(() => buildTrafficSegments(route), [route]);
  const currentStep = route.steps[stepIndex] ?? route.steps[route.steps.length - 1];

  // Fairness-aware routing: register this trip's route while navigating,
  // and release it as soon as the trip ends or the screen unmounts.
  useEffect(() => {
    claimRouteAssignment(route.routeKey, params.origin, params.destination).catch(() => {});
    return () => {
      releaseRouteAssignment().catch(() => {});
    };
  }, [route.routeKey, params.origin, params.destination]);

  // Advance to the next turn once the driver reaches the end of the current step.
  useEffect(() => {
    if (!location || !currentStep) return;
    const stepEnd = currentStep.coordinates[currentStep.coordinates.length - 1];
    if (!stepEnd) return;
    if (haversineMeters(location, stepEnd) < STEP_ARRIVAL_RADIUS_M && stepIndex < route.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    }
  }, [location, currentStep, stepIndex, route.steps.length]);

  // Periodically re-fetch the route to detect a materially faster alternative.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!location) return;
      try {
        const options = await fetchRouteOptions(location, params.destination, params.mode);
        const faster = options.find(
          (option) =>
            option.routeKey !== route.routeKey &&
            route.durationInTrafficSeconds - option.durationInTrafficSeconds >= REROUTE_MIN_SAVINGS_S,
        );
        if (faster) {
          setRerouteSuggestion({
            route: faster,
            savingsSeconds: route.durationInTrafficSeconds - faster.durationInTrafficSeconds,
          });
        }
      } catch {
        // Network hiccup — try again next interval.
      }
    }, REROUTE_CHECK_MS);
    return () => clearInterval(interval);
  }, [location, params.destination, params.mode, route]);

  // Crowdsourced incident reports feed back into the map/alerts (requirement #10).
  useEffect(() => {
    const load = () => fetchNearbyIncidents().then(setIncidents).catch(() => {});
    load();
    const interval = setInterval(load, INCIDENT_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const upcomingHighTraffic = useMemo(() => {
    const upcoming = segments.slice(stepIndex, stepIndex + 3);
    return upcoming.some((segment) => segment.level === 'high');
  }, [segments, stepIndex]);

  const activeAlert: ActiveAlert | null = rerouteSuggestion
    ? { kind: 'reroute', suggestion: rerouteSuggestion }
    : upcomingHighTraffic && !trafficDismissed
      ? {
          kind: 'traffic',
          delayMinutes: route.hasLiveTraffic
            ? Math.round((route.durationInTrafficSeconds - route.durationSeconds) / 60)
            : null,
        }
      : weather.hazard
        ? { kind: 'weather', hazard: weather.hazard }
        : driving.needsBreak
          ? { kind: 'fatigue' }
          : null;

  const remainingDistanceMeters = route.steps.slice(stepIndex).reduce((sum, step) => sum + step.distanceMeters, 0);
  const remainingFraction = remainingDistanceMeters / Math.max(route.distanceMeters, 1);
  const remainingSeconds = route.durationInTrafficSeconds * remainingFraction;
  const eta = useMemo(() => {
    const arrival = new Date(Date.now() + remainingSeconds * 1000);
    return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [remainingSeconds]);

  const handleExit = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleAcceptReroute = () => {
    if (!rerouteSuggestion) return;
    setRoute(rerouteSuggestion.route);
    setStepIndex(0);
    setRerouteSuggestion(null);
  };

  const handleReport = async (type: IncidentType) => {
    if (!location) return;
    setSubmittingReport(true);
    try {
      await reportIncident(type, location.latitude, location.longitude);
    } catch {
      // Best-effort — the driver already saw the confirmation UI close.
    } finally {
      setSubmittingReport(false);
      setReportOpen(false);
    }
  };

  return (
    <View style={styles.container}>
      <TrafficMap
        userLocation={location}
        heading={heading}
        destCoords={params.destination}
        activeRoute={route}
        incidents={incidents}
        followUser
      />

      <View style={styles.topOverlay} pointerEvents="box-none">
        <TurnBanner
          distanceText={currentStep?.distanceText ?? '—'}
          instruction={currentStep?.instruction ?? 'Head toward your destination'}
        />

        {activeAlert && (
          <View style={styles.alertWrap}>
            <RenderAlert
              alert={activeAlert}
              onCloseTraffic={() => setTrafficDismissed(true)}
              onFindAlternative={() => setTrafficDismissed(true)}
              onAcceptReroute={handleAcceptReroute}
              onKeepReroute={() => setRerouteSuggestion(null)}
              onAcknowledgeWeather={weather.acknowledge}
              onAcknowledgeFatigue={driving.acknowledge}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.weatherButton}
        onPress={() => setWeatherOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel="Show weather along your route"
      >
        <Text style={styles.fabIcon}>
          {weather.snapshot ? weatherCodeIcon(weather.snapshot.weatherCode) : '🌦️'}
        </Text>
        {weather.hazard && <View style={styles.weatherAlertDot} />}
      </TouchableOpacity>

      <TouchableOpacity style={styles.reportButton} onPress={() => setReportOpen(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>📣</Text>
      </TouchableOpacity>

      <View style={styles.bottomOverlay}>
        <NavStatsBar
          etaText={eta}
          distanceText={
            remainingDistanceMeters < 1000
              ? `${Math.round(remainingDistanceMeters)} m`
              : `${(remainingDistanceMeters / 1000).toFixed(1)} km`
          }
          speedKmh={(speed ?? 0) * 3.6}
          onExit={handleExit}
        />
      </View>

      {/* Overlays the map rather than replacing it, so switching back to the
          route is instant and navigation keeps running underneath. */}
      {weatherOpen && (
        <RouteWeatherPanel
          destinationLabel={params.destinationLabel}
          current={weather.snapshot}
          points={routeWeather.points}
          loading={routeWeather.loading}
          error={routeWeather.error}
          updatedAt={routeWeather.updatedAt}
          onRefresh={routeWeather.refresh}
          onBack={() => setWeatherOpen(false)}
        />
      )}

      <ReportIncidentSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSelect={handleReport}
        submitting={submittingReport}
      />
    </View>
  );
}

function RenderAlert({
  alert,
  onCloseTraffic,
  onFindAlternative,
  onAcceptReroute,
  onKeepReroute,
  onAcknowledgeWeather,
  onAcknowledgeFatigue,
}: {
  alert: ActiveAlert;
  onCloseTraffic: () => void;
  onFindAlternative: () => void;
  onAcceptReroute: () => void;
  onKeepReroute: () => void;
  onAcknowledgeWeather: () => void;
  onAcknowledgeFatigue: () => void;
}) {
  if (alert.kind === 'reroute') {
    const savingsMinutes = Math.max(1, Math.round(alert.suggestion.savingsSeconds / 60));
    const accept: AlertAction = { label: 'Accept', onPress: onAcceptReroute, color: colors.primary };
    const keep: AlertAction = { label: 'Keep', onPress: onKeepReroute, color: colors.neutralAction };
    return (
      <AlertCard
        icon="🔄"
        iconColor={colors.primary}
        title="Rerouting to a faster path..."
        message={`Save ${savingsMinutes} minute${savingsMinutes === 1 ? '' : 's'} via ${alert.suggestion.route.summary}`}
        onClose={onKeepReroute}
        primaryAction={accept}
        secondaryAction={keep}
      />
    );
  }

  if (alert.kind === 'traffic') {
    return (
      <AlertCard
        icon="⚠️"
        iconColor={colors.danger}
        title="Heavy Traffic Ahead"
        message={
          alert.delayMinutes === null
            ? 'Slow-moving roads ahead on your current route'
            : `Expect ${Math.max(alert.delayMinutes, 1)} min delay on current route`
        }
        onClose={onCloseTraffic}
        primaryAction={{ label: 'Find Alternative', onPress: onFindAlternative, color: colors.danger }}
      />
    );
  }

  if (alert.kind === 'weather') {
    return (
      <AlertCard
        icon={hazardIcon(alert.hazard)}
        iconColor={colors.hazard}
        title={hazardTitle(alert.hazard)}
        message={hazardMessage(alert.hazard)}
        onClose={onAcknowledgeWeather}
        primaryAction={{ label: 'Acknowledge', onPress: onAcknowledgeWeather, color: colors.hazard, textColor: colors.textPrimary }}
      />
    );
  }

  return (
    <AlertCard
      icon="☕"
      iconColor={colors.danger}
      title="Time for a Break"
      message="You've been driving for a while. Take a 10-minute rest."
      onClose={onAcknowledgeFatigue}
      primaryAction={{ label: 'Find Rest Stop', onPress: onAcknowledgeFatigue, color: colors.danger }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topOverlay: {
    position: 'absolute',
    top: 56,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.md,
  },
  alertWrap: {
    marginTop: 4,
  },
  reportButton: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  weatherButton: {
    position: 'absolute',
    right: 16,
    bottom: 278,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  // Unread-style marker so an active hazard is visible without opening the panel.
  weatherAlertDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.dangerStrong,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  fabIcon: {
    fontSize: 20,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
