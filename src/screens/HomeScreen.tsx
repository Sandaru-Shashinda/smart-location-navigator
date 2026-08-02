import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TrafficMap from '../components/TrafficMap';
import { useLocation } from '../hooks/useLocation';
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions';
import { metersToDistanceText } from '../lib/directions';
import { PlaceSuggestion, resolveDestination } from '../lib/places';
import { fetchRecentSearches, RecentSearch, saveRecentSearch, supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, spacing } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: NavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const { location } = useLocation();
  const [destText, setDestText] = useState('');
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [recentsError, setRecentsError] = useState<string | null>(null);

  const { suggestions, loading: suggesting, error: suggestError, active: showSuggestions } =
    usePlaceSuggestions(destText, location);

  const loadRecents = useCallback(async () => {
    try {
      setRecents(await fetchRecentSearches());
      setRecentsError(null);
    } catch (err) {
      // Surfaced in the sheet rather than swallowed: an empty list usually
      // means supabase/schema.sql hasn't been run on this project, and silently
      // showing "no recents" gives no way to tell that apart from a first run.
      setRecents([]);
      setRecentsError(err instanceof Error ? err.message : 'Could not load recent destinations.');
    }
  }, []);

  // On focus, not just on mount: Home stays mounted while the driver picks a
  // route, so a destination saved on the way out would otherwise not show up in
  // RECENT until the app was restarted.
  useFocusEffect(
    useCallback(() => {
      loadRecents();
    }, [loadRecents]),
  );

  const goToRoute = async (label: string, latitude: number, longitude: number) => {
    navigation.navigate('RouteSelect', { destination: { latitude, longitude }, destinationLabel: label });
    try {
      await saveRecentSearch(label, latitude, longitude);
    } catch {
      // Recents are a convenience feature; failures shouldn't block navigation.
    }
  };

  const selectPlace = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setDestText('');
    goToRoute(place.title, place.latitude, place.longitude);
  };

  const handleSearch = async () => {
    if (!destText.trim()) {
      Alert.alert('Missing destination', 'Please enter a destination.');
      return;
    }

    // Submitting mid-type takes the top suggestion, the same as tapping it.
    if (suggestions.length > 0) {
      selectPlace(suggestions[0]);
      return;
    }

    setSearching(true);
    try {
      const place = await resolveDestination(destText, location);
      if (!place) {
        Alert.alert('Not found', `Could not find "${destText.trim()}".`);
        return;
      }
      selectPlace(place);
    } catch {
      Alert.alert('Error', 'Something went wrong while searching.');
    } finally {
      setSearching(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const renderSuggestions = () => {
    if (suggestions.length === 0) {
      if (suggesting) return <Text style={styles.panelMessage}>Searching…</Text>;
      if (suggestError) return <Text style={styles.panelError}>{suggestError}</Text>;
      return <Text style={styles.panelMessage}>No places found for “{destText.trim()}”.</Text>;
    }

    return (
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.id}
        style={styles.suggestionsList}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => selectPlace(item)} activeOpacity={0.7}>
            <Text style={styles.rowIcon}>📍</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {!!item.subtitle && (
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              )}
            </View>
            {item.distanceMeters !== null && (
              <Text style={styles.rowDistance}>{metersToDistanceText(item.distanceMeters)}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    );
  };

  const renderRecents = () => (
    <FlatList
      data={recents}
      keyExtractor={(item) => item.id}
      style={styles.recentsList}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        recentsError ? (
          <View>
            <Text style={styles.errorText}>{recentsError}</Text>
            {recentsError.includes('schema cache') && (
              <Text style={styles.emptyText}>
                Run supabase/schema.sql in the Supabase SQL editor to create this table.
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>Your recent destinations will appear here.</Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => goToRoute(item.label, item.latitude, item.longitude)}
          activeOpacity={0.7}
        >
          <Text style={styles.rowIcon}>🕒</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );

  return (
    <View style={styles.container}>
      <TrafficMap userLocation={location} />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        {/* The suggestions drop out of the search bar rather than into the
            bottom sheet: the sheet sits behind the on-screen keyboard, so
            results rendered there are invisible while the driver is typing. */}
        <View style={styles.searchColumn}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Where to go..?"
              placeholderTextColor={colors.textSecondary}
              value={destText}
              onChangeText={setDestText}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="words"
              onSubmitEditing={handleSearch}
            />
            {(searching || suggesting) && <ActivityIndicator size="small" color={colors.primary} />}
            {destText.length > 0 && !searching && !suggesting && (
              <TouchableOpacity onPress={() => setDestText('')} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {showSuggestions && <View style={styles.suggestionsPanel}>{renderSuggestions()}</View>}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutIcon}>↩</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>RECENT</Text>
        {renderRecents()}

        <TouchableOpacity
          style={[styles.startButton, !destText.trim() && styles.startButtonDisabled]}
          onPress={handleSearch}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    // Top-aligned so the sign-out button stays level with the search bar
    // instead of drifting down as the suggestions panel grows below it.
    alignItems: 'flex-start',
    gap: spacing.sm,
    zIndex: 10,
  },
  searchColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  clearIcon: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  suggestionsPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  signOutButton: {
    // Centres the 40pt button against the 48pt search bar beside it.
    marginTop: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  signOutIcon: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '700',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    minHeight: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 14,
  },
  sheetTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  // Capped so the dropdown never reaches down into the bottom sheet.
  suggestionsList: {
    maxHeight: 260,
  },
  recentsList: {
    maxHeight: 200,
  },
  panelMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  panelError: {
    color: colors.danger,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    fontSize: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  rowDistance: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
