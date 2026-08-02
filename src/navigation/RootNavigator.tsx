import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { LatLng, RouteOption, TravelMode } from '../lib/directions';
import SplashScreen from '../screens/SplashScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import RouteSelectScreen from '../screens/RouteSelectScreen';
import NavigationScreen from '../screens/NavigationScreen';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  Home: undefined;
  RouteSelect: { destination: LatLng; destinationLabel: string };
  Navigation: {
    origin: LatLng;
    destination: LatLng;
    destinationLabel: string;
    mode: TravelMode;
    initialRoute: RouteOption;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // A session was persisted on-device but its refresh token is no
        // longer valid server-side (e.g. after a project reset or token
        // expiry) — clear it locally so we don't keep retrying a dead token.
        supabase.auth.signOut().catch(() => {});
      }
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? 'Home' : 'SignIn'}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="RouteSelect" component={RouteSelectScreen} />
          <Stack.Screen
            name="Navigation"
            component={NavigationScreen}
            options={{ gestureEnabled: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
