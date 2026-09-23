import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { MAP_CONFIG } from '../config/mapConfig';
import type {
  EventDestination,
  InterpolatedCoordinate,
  MemberLocationRecord,
} from '../types';
import { formatLocationAge, formatSpeedKmh } from '../utils/locationFreshness';
import { calculateCoordinatesBounds } from '../utils/mapBounds';
import { DestinationMarker } from './DestinationMarker';
import { CloseIcon } from './LocationIcons';
import { LocationMapControls } from './LocationMapControls';
import { MemberLocationMarker } from './MemberLocationMarker';

export interface LocationMapProps {
  locations: MemberLocationRecord[];
  destination: EventDestination | null;
  currentUserId?: string;
  isConnected: boolean;
  onSelectMember?: (member: MemberLocationRecord) => void;
  onSelectDestination?: (destination: EventDestination) => void;
  testID?: string;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  locations,
  destination,
  currentUserId,
  isConnected,
  onSelectMember,
  onSelectDestination,
  testID = 'location-map-container',
}) => {
  const cameraRef = useRef<CameraRef>(null);
  const [selectedMember, setSelectedMember] = useState<MemberLocationRecord | null>(null);
  const hasInitializedBoundsRef = useRef(false);

  // Identify current user's location
  const selfLocation = useMemo(
    () => locations.find((l) => l.userId === currentUserId),
    [locations, currentUserId],
  );

  // All valid coordinates on the map (members + destination)
  const allCoordinates = useMemo(() => {
    const coords: (InterpolatedCoordinate | { latitude: number; longitude: number })[] = [];
    for (const loc of locations) {
      const lat = loc.interpolated?.latitude ?? loc.latitude;
      const lng = loc.interpolated?.longitude ?? loc.longitude;
      coords.push({ latitude: lat, longitude: lng });
    }
    if (destination) {
      coords.push({ latitude: destination.latitude, longitude: destination.longitude });
    }
    return coords;
  }, [locations, destination]);

  // Compute bounding box
  const boundsResult = useMemo(
    () => calculateCoordinatesBounds(allCoordinates),
    [allCoordinates],
  );

  // Fit camera around group & destination
  const handleFitGroup = useCallback(() => {
    if (!boundsResult) return;
    cameraRef.current?.fitBounds(
      boundsResult.bounds,
      {
        padding: MAP_CONFIG.FIT_BOUNDS_PADDING,
        duration: MAP_CONFIG.CAMERA_ANIMATION_MS,
      },
    );
  }, [boundsResult]);

  // Center camera on current user
  const handleCenterOnMe = useCallback(() => {
    if (!selfLocation) return;
    const lng = selfLocation.interpolated?.longitude ?? selfLocation.longitude;
    const lat = selfLocation.interpolated?.latitude ?? selfLocation.latitude;

    cameraRef.current?.easeTo({
      center: [lng, lat],
      zoom: MAP_CONFIG.FOCUS_ME_ZOOM,
      duration: MAP_CONFIG.CAMERA_ANIMATION_MS,
    });
  }, [selfLocation]);

  // Auto-fit initial bounds once coordinates become available
  useEffect(() => {
    if (!hasInitializedBoundsRef.current && boundsResult) {
      handleFitGroup();
      hasInitializedBoundsRef.current = true;
    }
  }, [boundsResult, handleFitGroup]);

  const handleMemberPress = useCallback(
    (record: MemberLocationRecord) => {
      setSelectedMember(record);
      onSelectMember?.(record);
    },
    [onSelectMember],
  );

  const handleDestinationPress = useCallback(
    (dest: EventDestination) => {
      setSelectedMember(null);
      onSelectDestination?.(dest);
    },
    [onSelectDestination],
  );

  return (
    <View style={styles.container} testID={testID}>
      <Map
        style={styles.map}
        mapStyle={MAP_CONFIG.STYLE_URL}
        testID="vector-map-view"
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            zoom: MAP_CONFIG.DEFAULT_ZOOM,
            center: destination
              ? [destination.longitude, destination.latitude]
              : selfLocation
              ? [
                  selfLocation.interpolated?.longitude ?? selfLocation.longitude,
                  selfLocation.interpolated?.latitude ?? selfLocation.latitude,
                ]
              : [0, 0],
          }}
        />

        {/* Member Markers */}
        {locations.map((member) => (
          <MemberLocationMarker
            key={member.userId}
            record={member}
            isSelected={selectedMember?.userId === member.userId}
            onPress={handleMemberPress}
          />
        ))}

        {/* Destination Marker */}
        {destination && (
          <DestinationMarker
            destination={destination}
            onPress={handleDestinationPress}
          />
        )}
      </Map>

      {/* Map Floating Controls */}
      <LocationMapControls
        onCenterOnMe={handleCenterOnMe}
        onFitGroup={handleFitGroup}
        hasSelfLocation={Boolean(selfLocation)}
        isConnected={isConnected}
        activeMembersCount={locations.length}
      />

      {/* Selected Member Detail Callout Card */}
      {selectedMember && (
        <View style={styles.detailCard} testID="member-detail-card">
          <View style={styles.detailCardHeader}>
            <View style={styles.detailTitleGroup}>
              <Text style={styles.detailNameText}>
                {selectedMember.user?.displayName || selectedMember.user?.username || 'Member'}
              </Text>
              {selectedMember.isCurrentUser && (
                <View style={styles.detailSelfBadge}>
                  <Text style={styles.detailSelfBadgeText}>YOU</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedMember(null)}
              testID="close-member-card"
              style={styles.closeButton}
              accessibilityLabel="Close member details"
              accessibilityRole="button"
            >
              <CloseIcon size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailMetaLabel}>Status:</Text>
            <Text
              style={[
                styles.detailMetaValue,
                selectedMember.isStale && styles.staleValue,
              ]}
            >
              {selectedMember.isStale
                ? 'Stale (>5m)'
                : selectedMember.movementState}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailMetaLabel}>Speed:</Text>
            <Text style={styles.detailMetaValue}>
              {formatSpeedKmh(selectedMember.speed)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailMetaLabel}>Last Update:</Text>
            <Text style={styles.detailMetaValue}>
              {formatLocationAge(selectedMember.recordedAt)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  detailCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 76, // leave room for right action buttons
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  detailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 6,
  },
  detailTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailNameText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  detailSelfBadge: {
    backgroundColor: '#0284C7',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  detailSelfBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  closeButton: {
    padding: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  detailMetaLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  detailMetaValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  staleValue: {
    color: '#F59E0B',
  },
});
