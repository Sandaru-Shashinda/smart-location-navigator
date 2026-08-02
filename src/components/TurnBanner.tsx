import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

interface Props {
  distanceText: string;
  instruction: string;
  onBack?: () => void;
}

export default function TurnBanner({ distanceText, instruction, onBack }: Props) {
  return (
    <View style={styles.banner}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      )}
      <View style={styles.textColumn}>
        <Text style={styles.distance}>{distanceText}</Text>
        <Text style={styles.instruction} numberOfLines={1}>
          {instruction}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  textColumn: {
    flex: 1,
    alignItems: 'center',
  },
  distance: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  instruction: {
    color: colors.textOnPrimaryMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
});
