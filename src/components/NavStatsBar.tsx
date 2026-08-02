import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

interface Props {
  etaText: string;
  distanceText: string;
  speedKmh: number;
  onExit: () => void;
}

export default function NavStatsBar({ etaText, distanceText, speedKmh, onExit }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.statsRow}>
        <Stat label="ETA" value={etaText} />
        <View style={styles.divider} />
        <Stat label="DISTANCE" value={distanceText} />
        <View style={styles.divider} />
        <Stat label="SPEED" value={`${Math.round(speedKmh)} km/h`} />
      </View>
      <TouchableOpacity style={styles.exitButton} onPress={onExit} activeOpacity={0.85}>
        <Text style={styles.exitLabel}>EXIT NAVIGATION</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  exitButton: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerStrong,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  exitLabel: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
