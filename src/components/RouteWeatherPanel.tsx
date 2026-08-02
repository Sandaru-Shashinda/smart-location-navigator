import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { metersToDistanceText } from '../lib/directions';
import {
  hazardIcon,
  hazardLabel,
  hazardMessage,
  RouteWeatherPoint,
  weatherCodeIcon,
  weatherCodeText,
  WeatherHazard,
  WeatherSnapshot,
} from '../lib/weather';
import { colors, radii, spacing } from '../theme/colors';

interface Props {
  destinationLabel?: string;
  /** Conditions where the driver is right now, from the hazard poller. */
  current: WeatherSnapshot | null;
  points: RouteWeatherPoint[];
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  onRefresh: () => void;
  onBack: () => void;
}

/** "Now" / "+25m" / "+1h 10m" — how far ahead this stretch of road is. */
function formatEta(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `+${hours}h` : `+${hours}h ${rest}m`;
}

/** Distances are measured from the driver, so the start of the list is "here". */
function formatPosition(distanceMeters: number): string {
  return distanceMeters < 100 ? 'here' : `${metersToDistanceText(distanceMeters)} ahead`;
}

function formatUpdatedAt(updatedAt: number): string {
  const minutes = Math.round((Date.now() - updatedAt) / 60000);
  if (minutes < 1) return 'Updated just now';
  return `Updated ${minutes} min ago`;
}

export default function RouteWeatherPanel({
  destinationLabel,
  current,
  points,
  loading,
  error,
  updatedAt,
  onRefresh,
  onBack,
}: Props) {
  const hazardPoints = points.filter(
    (point): point is RouteWeatherPoint & { hazard: WeatherHazard } => point.hazard !== null,
  );

  return (
    <View style={styles.panel}>
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleColumn}>
            <Text style={styles.heroTitle}>Weather on route</Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {destinationLabel ? `To ${destinationLabel}` : 'Along your path'}
            </Text>
          </View>
          <TouchableOpacity style={styles.backPill} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backPillLabel}>← Route</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroReading}>
          <Text style={styles.heroGlyph}>{current ? weatherCodeIcon(current.weatherCode) : '📡'}</Text>
          <View style={styles.heroReadingText}>
            <Text style={styles.heroTemperature}>
              {current ? `${Math.round(current.temperatureC)}°C` : '—'}
            </Text>
            <Text style={styles.heroCondition}>
              {current
                ? `${weatherCodeText(current.weatherCode)} · ${Math.round(current.windSpeedKmh)} km/h wind`
                : 'Reading your local conditions…'}
            </Text>
          </View>
        </View>

        {current?.hazard && (
          <View style={styles.heroHazard}>
            <Text style={styles.heroHazardIcon}>{hazardIcon(current.hazard)}</Text>
            <Text style={styles.heroHazardText}>{hazardMessage(current.hazard)}</Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hazards ahead</Text>
          {updatedAt !== null && <Text style={styles.sectionMeta}>{formatUpdatedAt(updatedAt)}</Text>}
        </View>

        {loading && points.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.stateText}>Checking weather along your route…</Text>
          </View>
        ) : error && points.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.85}>
              <Text style={styles.retryLabel}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : hazardPoints.length === 0 ? (
          <View style={[styles.summaryCard, styles.summaryCardClear]}>
            <Text style={styles.summaryIcon}>✅</Text>
            <Text style={styles.summaryText}>No weather hazards expected on this route.</Text>
          </View>
        ) : (
          <View style={[styles.summaryCard, styles.summaryCardHazard]}>
            <Text style={styles.summaryIcon}>⚠️</Text>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryText}>
                {hazardPoints.length} weather {hazardPoints.length === 1 ? 'hazard' : 'hazards'} on this route
              </Text>
              <View style={styles.chipRow}>
                {hazardPoints.map((point, index) => (
                  <View key={`${index}-${point.distanceMeters}`} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {hazardIcon(point.hazard)} {hazardLabel(point.hazard)} ·{' '}
                      {formatPosition(point.distanceMeters)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {points.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.timelineTitle]}>Along the path</Text>
            <View style={styles.timeline}>
              {points.map((point, index) => (
                <WeatherStop
                  key={`${index}-${point.distanceMeters}`}
                  point={point}
                  isFirst={index === 0}
                  isLast={index === points.length - 1}
                />
              ))}
            </View>
            <Text style={styles.footnote}>
              Forecast for each point at the time you're expected to reach it.
            </Text>
          </>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.refreshLabel}>↻</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.backButtonLabel}>Back to Route</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function WeatherStop({
  point,
  isFirst,
  isLast,
}: {
  point: RouteWeatherPoint;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={[styles.railLine, isFirst && styles.railLineHidden]} />
        <View style={[styles.railDot, point.hazard != null && styles.railDotHazard]} />
        <View style={[styles.railLine, isLast && styles.railLineHidden]} />
      </View>

      <View style={styles.stopCard}>
        <View style={styles.stopHeader}>
          <Text style={styles.stopTime}>{isLast ? 'Arrive' : formatEta(point.etaSeconds)}</Text>
          <Text style={styles.stopDistance}>{isFirst ? 'Your position' : formatPosition(point.distanceMeters)}</Text>
        </View>

        <View style={styles.stopBody}>
          <Text style={styles.stopGlyph}>{weatherCodeIcon(point.weatherCode)}</Text>
          <View style={styles.stopTextColumn}>
            <Text style={styles.stopCondition}>{weatherCodeText(point.weatherCode)}</Text>
            <Text style={styles.stopMeta}>
              {Math.round(point.windSpeedKmh)} km/h wind
              {point.precipitationChance !== null ? ` · ${point.precipitationChance}% rain` : ''}
            </Text>
          </View>
          <Text style={styles.stopTemperature}>{Math.round(point.temperatureC)}°</Text>
        </View>

        {point.hazard && (
          <View style={styles.stopHazard}>
            <Text style={styles.stopHazardText}>
              {hazardIcon(point.hazard)} {hazardLabel(point.hazard)} — {hazardMessage(point.hazard)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  heroTitleColumn: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: colors.textOnPrimaryMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  backPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backPillLabel: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  heroReading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  heroGlyph: {
    fontSize: 44,
  },
  heroReadingText: {
    flex: 1,
    gap: 2,
  },
  heroTemperature: {
    color: colors.textOnPrimary,
    fontSize: 34,
    fontWeight: '700',
  },
  heroCondition: {
    color: colors.textOnPrimaryMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  heroHazard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  heroHazardIcon: {
    fontSize: 16,
  },
  heroHazardText: {
    flex: 1,
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.xl,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
  },
  summaryCardClear: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  summaryCardHazard: {
    backgroundColor: `${colors.hazard}1F`,
    borderColor: `${colors.hazard}66`,
  },
  summaryColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  summaryIcon: {
    fontSize: 18,
  },
  summaryText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  timelineTitle: {
    marginTop: spacing.md,
  },
  timeline: {
    gap: 0,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  rail: {
    width: 12,
    alignItems: 'center',
  },
  railLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
  },
  railLineHidden: {
    backgroundColor: 'transparent',
  },
  railDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginVertical: 2,
  },
  railDotHazard: {
    backgroundColor: colors.hazard,
  },
  stopCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopTime: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stopDistance: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  stopBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stopGlyph: {
    fontSize: 26,
  },
  stopTextColumn: {
    flex: 1,
    gap: 2,
  },
  stopCondition: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  stopMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  stopTemperature: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  stopHazard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.hazard,
  },
  stopHazardText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  footnote: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshLabel: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  backButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
  },
  backButtonLabel: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
