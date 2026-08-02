import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';

// Supabase logs this whenever a previously-persisted session's refresh
// token has been invalidated server-side; the SDK already falls back to
// "signed out" gracefully (see RootNavigator), so it isn't a real error —
// just noisy in the dev LogBox overlay.
LogBox.ignoreLogs(['AuthApiError: Invalid Refresh Token']);

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}
