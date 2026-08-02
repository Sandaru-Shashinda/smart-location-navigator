import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IncidentType } from '../lib/supabase';
import { colors, radii, spacing } from '../theme/colors';

const TYPES: { key: IncidentType; icon: string; label: string }[] = [
  { key: 'accident', icon: '🚧', label: 'Accident' },
  { key: 'hazard', icon: '⚠️', label: 'Hazard' },
  { key: 'police', icon: '🚓', label: 'Police' },
  { key: 'closure', icon: '⛔', label: 'Road Closed' },
  { key: 'congestion', icon: '🐢', label: 'Congestion' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: IncidentType) => void;
  submitting: boolean;
}

export default function ReportIncidentSheet({ visible, onClose, onSelect, submitting }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Report an incident</Text>
          <View style={styles.grid}>
            {TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={styles.option}
                onPress={() => onSelect(type.key)}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>{type.icon}</Text>
                <Text style={styles.optionLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  option: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
  },
  optionIcon: {
    fontSize: 26,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
