import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  size?: number;
}

export default function ShieldLogo({ size = 96 }: Props) {
  const badgeSize = size * 0.34;
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={{ fontSize: size * 0.5 }}>🛡️</Text>
      <View
        style={[
          styles.checkBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: size * 0.08,
            bottom: size * 0.1,
          },
        ]}
      >
        <Text style={{ fontSize: badgeSize * 0.55, color: '#FFFFFF', fontWeight: '900' }}>✓</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
