import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Props {
  userLocation: Coordinates | null;
  originCoords?: Coordinates | null;
  destCoords?: Coordinates | null;
}

export default function TrafficMap({ userLocation, originCoords, destCoords }: Props) {
  const mapRef = useRef<MapView>(null);
  const hasInitializedRef = useRef(false);

  // Center map on first GPS fix
  useEffect(() => {
    if (userLocation && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
    }
  }, [userLocation]);

  // Fit map to show both origin and destination
  useEffect(() => {
    if (originCoords && destCoords) {
      mapRef.current?.fitToCoordinates([originCoords, destCoords], {
        edgePadding: { top: 160, right: 40, bottom: 80, left: 40 },
        animated: true,
      });
    } else if (destCoords) {
      mapRef.current?.animateToRegion(
        {
          latitude: destCoords.latitude,
          longitude: destCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800,
      );
    }
  }, [originCoords, destCoords]);

  const effectiveOrigin = originCoords ?? userLocation;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      showsUserLocation={false}
      showsTraffic
      showsCompass
      initialRegion={
        userLocation
          ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }
          : undefined
      }
    >
      {/* Current position marker (shown when no custom origin is set) */}
      {userLocation && !originCoords && (
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.markerOuter}>
            <View style={styles.markerInner} />
          </View>
        </Marker>
      )}

      {/* Origin marker */}
      {effectiveOrigin && originCoords && (
        <Marker coordinate={effectiveOrigin} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.pinStart}>
            <View style={styles.pinStartDot} />
          </View>
        </Marker>
      )}

      {/* Destination marker */}
      {destCoords && (
        <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.pinEnd}>
            <View style={styles.pinEndPoint} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 198, 174, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00C6AE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinStart: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00C6AE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinStartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pinEnd: {
    width: 20,
    height: 28,
    alignItems: 'center',
  },
  pinEndPoint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4757',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
