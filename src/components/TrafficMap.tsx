import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { buildTrafficSegments, LatLng, RouteOption } from '../lib/directions';
import { IncidentReport, IncidentType } from '../lib/supabase';
import { colors, trafficLevelColor } from '../theme/colors';

interface Props {
  userLocation: LatLng | null;
  heading?: number | null;
  originCoords?: LatLng | null;
  destCoords?: LatLng | null;
  /** The route currently being navigated — drawn as a traffic-coloured line. */
  activeRoute?: RouteOption | null;
  /** Unselected route options — drawn as thin grey lines the user can tap. */
  alternativeRoutes?: RouteOption[];
  onSelectAlternative?: (route: RouteOption) => void;
  incidents?: IncidentReport[];
  /** Keep the camera locked on the user, rotated to heading (turn-by-turn mode). */
  followUser?: boolean;
}

const INCIDENT_ICON: Record<IncidentType, string> = {
  accident: '🚧',
  hazard: '⚠️',
  police: '🚓',
  closure: '⛔',
  congestion: '🐢',
  other: '📍',
};

export default function TrafficMap({
  userLocation,
  heading,
  originCoords,
  destCoords,
  activeRoute,
  alternativeRoutes,
  onSelectAlternative,
  incidents,
  followUser,
}: Props) {
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

  // Turn-by-turn: keep the camera glued to the driver, rotated to heading.
  useEffect(() => {
    if (followUser && userLocation) {
      mapRef.current?.animateCamera(
        {
          center: userLocation,
          heading: heading ?? 0,
          pitch: 45,
          zoom: 17,
        },
        { duration: 500 },
      );
    }
  }, [followUser, userLocation, heading]);

  // Fit map to show the active route, or both origin+destination.
  useEffect(() => {
    if (followUser) return;
    if (activeRoute && activeRoute.coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(activeRoute.coordinates, {
        edgePadding: { top: 160, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    } else if (originCoords && destCoords) {
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
  }, [activeRoute, originCoords, destCoords, followUser]);

  const effectiveOrigin = originCoords ?? userLocation;
  const segments = activeRoute ? buildTrafficSegments(activeRoute) : [];

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
      {alternativeRoutes?.map((route) => (
        <Polyline
          key={route.routeKey}
          coordinates={route.coordinates}
          strokeColor={colors.neutralAction}
          strokeWidth={4}
          tappable
          onPress={() => onSelectAlternative?.(route)}
        />
      ))}

      {segments.map((segment, index) => (
        <Polyline
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          coordinates={segment.coordinates}
          strokeColor={trafficLevelColor(segment.level)}
          strokeWidth={6}
        />
      ))}

      {/* Current position marker (shown when no custom origin is set) */}
      {userLocation && !originCoords && (
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} flat rotation={heading ?? 0}>
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

      {incidents?.map((incident) => (
        <Marker
          key={incident.id}
          coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.incidentBadge}>
            <Text style={styles.incidentGlyph}>{INCIDENT_ICON[incident.type]}</Text>
          </View>
        </Marker>
      ))}
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
    backgroundColor: 'rgba(58, 109, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinStart: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.dangerStrong,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  incidentBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  incidentGlyph: {
    fontSize: 14,
  },
});
