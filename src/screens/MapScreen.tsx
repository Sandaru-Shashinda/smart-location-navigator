import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TrafficMap from '../components/TrafficMap';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';

interface Coordinates {
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const { location, errorMsg, loading } = useLocation();

  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null);
  const [destCoords, setDestCoords] = useState<Coordinates | null>(null);
  const [searching, setSearching] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const geocode = async (address: string): Promise<Coordinates | null> => {
    const results = await Location.geocodeAsync(address);
    if (results.length === 0) return null;
    return { latitude: results[0].latitude, longitude: results[0].longitude };
  };

  const handleSearch = async () => {
    if (!destText.trim()) {
      Alert.alert('Missing destination', 'Please enter a destination.');
      return;
    }

    setSearching(true);
    try {
      // Origin: geocode if filled, otherwise use live location
      let resolvedOrigin: Coordinates | null = null;
      if (originText.trim()) {
        resolvedOrigin = await geocode(originText.trim());
        if (!resolvedOrigin) {
          Alert.alert('Not found', `Could not find "${originText}".`);
          setSearching(false);
          return;
        }
      }

      const resolvedDest = await geocode(destText.trim());
      if (!resolvedDest) {
        Alert.alert('Not found', `Could not find "${destText}".`);
        setSearching(false);
        return;
      }

      setOriginCoords(resolvedOrigin);
      setDestCoords(resolvedDest);
    } catch {
      Alert.alert('Error', 'Something went wrong while searching.');
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setOriginText('');
    setDestText('');
    setOriginCoords(null);
    setDestCoords(null);
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>Acquiring GPS…</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Location Unavailable</Text>
        <Text style={styles.errorMessage}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TrafficMap
        userLocation={location}
        originCoords={originCoords}
        destCoords={destCoords}
      />

      {/* Search panel — top */}
      <SafeAreaView style={styles.searchPanel} edges={['top']}>
        <View style={styles.searchCard}>
          {/* Dot + line indicator */}
          <View style={styles.dotColumn}>
            <View style={styles.dotStart} />
            <View style={styles.dotLine} />
            <View style={styles.dotEnd} />
          </View>

          {/* Input fields */}
          <View style={styles.inputsColumn}>
            <TextInput
              style={styles.input}
              placeholder="Your location"
              placeholderTextColor="#8FA8C0"
              value={originText}
              onChangeText={setOriginText}
              returnKeyType="next"
            />
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder="Where to?"
              placeholderTextColor="#8FA8C0"
              value={destText}
              onChangeText={setDestText}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actionsColumn}>
            {(originText || destText || destCoords) ? (
              <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.goButton, searching && styles.goButtonDisabled]}
          onPress={handleSearch}
          disabled={searching}
          activeOpacity={0.8}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#0D1B2A" />
          ) : (
            <Text style={styles.goButtonText}>Go</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Coordinates overlay — bottom left */}
      {location && (
        <View style={styles.coordsCard} pointerEvents="none">
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>LAT</Text>
            <Text style={styles.coordValue}>{location.latitude.toFixed(5)}</Text>
          </View>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>LNG</Text>
            <Text style={styles.coordValue}>{location.longitude.toFixed(5)}</Text>
          </View>
        </View>
      )}

      {/* Sign-out button — bottom right */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutIcon}>↩</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#8FA8C0',
    fontSize: 15,
    marginTop: 16,
    letterSpacing: 0.3,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  errorMessage: {
    color: '#8FA8C0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Search panel
  searchPanel: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  searchCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dotColumn: {
    alignItems: 'center',
    gap: 0,
    paddingVertical: 4,
  },
  dotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C6AE',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dotLine: {
    width: 2,
    height: 18,
    backgroundColor: '#3A5068',
    marginVertical: 3,
  },
  dotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  inputsColumn: {
    flex: 1,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 6,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#1E3248',
  },
  actionsColumn: {
    justifyContent: 'center',
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E3248',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    color: '#8FA8C0',
    fontSize: 12,
    fontWeight: '700',
  },
  goButton: {
    backgroundColor: '#00C6AE',
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C6AE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  goButtonDisabled: {
    opacity: 0.6,
  },
  goButtonText: {
    color: '#0D1B2A',
    fontSize: 15,
    fontWeight: '700',
  },

  // Coords card
  coordsCard: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    backgroundColor: 'rgba(22, 36, 54, 0.88)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordLabel: {
    color: '#8FA8C0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    width: 28,
  },
  coordValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

  // Sign out
  signOutButton: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 36, 54, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutIcon: {
    color: '#00C6AE',
    fontSize: 18,
    fontWeight: '700',
  },
});
