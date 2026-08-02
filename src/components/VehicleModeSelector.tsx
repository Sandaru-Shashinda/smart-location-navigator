import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { TravelMode } from '../lib/directions';

const MODES: { key: TravelMode; icon: string; label: string }[] = [
  { key: 'driving', icon: '🚗', label: 'Car' },
  { key: 'motorcycle', icon: '🏍️', label: 'Bike' },
  { key: 'truck', icon: '🚚', label: 'Truck' },
  { key: 'bicycling', icon: '🚲', label: 'Cycle' },
];

interface Props {
  mode: TravelMode;
  onChange: (mode: TravelMode) => void;
}

export default function VehicleModeSelector({ mode, onChange }: Props) {
  return (
    <View style={styles.row}>
      {MODES.map((item) => {
        const selected = item.key === mode;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.pill, selected && styles.pillSelected]}
            onPress={() => onChange(item.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            {selected && <Text style={styles.label}>{item.label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.surface,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
});
