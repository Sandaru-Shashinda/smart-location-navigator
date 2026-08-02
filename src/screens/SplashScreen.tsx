import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ShieldLogo from '../components/ShieldLogo';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <ShieldLogo size={96} />
      <Text style={styles.title}>SAFE TO GO</Text>
      <Text style={styles.tagline}>Smart Traffic Navigation</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  title: {
    color: colors.textOnPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  tagline: {
    color: colors.textOnPrimaryMuted,
    fontSize: 16,
    fontWeight: '500',
  },
});
