// app.config.js replaces app.json so the Google Maps API key can be read from
// the environment instead of being hardcoded/committed to source control.
// Expo CLI loads .env files into process.env before this file is evaluated.

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

module.exports = {
  expo: {
    name: 'Safe To Go',
    slug: 'safe-to-go',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#3A6DFF',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.yourname.trafficpilot',
      config: {
        googleMapsApiKey,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Safe To Go needs your location to show traffic and route you.',
        NSLocationAlwaysUsageDescription:
          'Safe To Go uses your location in the background to track traffic and detect driving sessions.',
      },
    },
    android: {
      package: 'com.yourname.trafficpilot',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#3A6DFF',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-secure-store',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow Safe To Go to use your location.',
        },
      ],
    ],
  },
};
