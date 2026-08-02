import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

export interface AlertAction {
  label: string;
  onPress: () => void;
  color: string;
  textColor?: string;
}

interface Props {
  icon: string;
  iconColor: string;
  title: string;
  message: string;
  onClose: () => void;
  primaryAction: AlertAction;
  secondaryAction?: AlertAction;
}

export default function AlertCard({ icon, iconColor, title, message, onClose, primaryAction, secondaryAction }: Props) {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        <View style={[styles.iconBadge, { backgroundColor: `${iconColor}26` }]}>
          <Text style={styles.iconGlyph}>{icon}</Text>
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: primaryAction.color }]}
          onPress={primaryAction.onPress}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionLabel, { color: primaryAction.textColor ?? colors.textOnPrimary }]}>
            {primaryAction.label}
          </Text>
        </TouchableOpacity>
        {secondaryAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: secondaryAction.color }]}
            onPress={secondaryAction.onPress}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionLabel, { color: secondaryAction.textColor ?? colors.textOnPrimary }]}>
              {secondaryAction.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  closeIcon: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 22,
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
