// Design tokens extracted from the "Safe To Go" Figma file
// https://www.figma.com/design/e0dQ0iWSgSOGm4f0SXf3ZV/Safe-to-Go

export const colors = {
  // Brand
  primary: '#3A6DFF',
  primaryDark: '#1842BA',

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F6F8',

  // Text
  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.5)',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryMuted: 'rgba(255,255,255,0.8)',

  // Status / alerts
  danger: '#CC1C1C',
  dangerStrong: '#F30004',
  hazard: '#CAC411',
  neutralAction: '#B3B3B3',

  // Traffic levels (route polyline + chips)
  trafficLow: '#3A6DFF',
  trafficMedium: '#FF9500',
  trafficHigh: '#E4372B',

  border: '#E4E7EC',
  overlay: 'rgba(0,0,0,0.35)',
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type TrafficLevel = 'low' | 'medium' | 'high';

export const trafficLevelColor = (level: TrafficLevel): string => {
  switch (level) {
    case 'high':
      return colors.trafficHigh;
    case 'medium':
      return colors.trafficMedium;
    default:
      return colors.trafficLow;
  }
};
