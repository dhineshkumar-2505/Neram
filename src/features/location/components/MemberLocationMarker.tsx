import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import { MAP_CONFIG } from '../config/mapConfig';
import type { MemberLocationRecord } from '../types';
import { formatSpeedKmh } from '../utils/locationFreshness';

export interface MemberLocationMarkerProps {
  record: MemberLocationRecord;
  onPress?: (record: MemberLocationRecord) => void;
  isSelected?: boolean;
}

/**
 * Extracts 2-letter uppercase initials for avatar fallback.
 */
function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '??';
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1];
  return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
}

/**
 * Resolves marker ring color based on movement and staleness.
 */
function getRingColor(record: MemberLocationRecord): string {
  if (record.isStale) {
    return MAP_CONFIG.MOVEMENT_COLORS.STALE;
  }
  switch (record.movementState) {
    case 'DRIVING':
      return MAP_CONFIG.MOVEMENT_COLORS.DRIVING;
    case 'WALKING':
      return MAP_CONFIG.MOVEMENT_COLORS.WALKING;
    case 'STATIONARY':
    default:
      return MAP_CONFIG.MOVEMENT_COLORS.STATIONARY;
  }
}

export const MemberLocationMarker: React.FC<MemberLocationMarkerProps> = React.memo(
  ({ record, onPress, isSelected = false }) => {
    const lng = record.interpolated?.longitude ?? record.longitude;
    const lat = record.interpolated?.latitude ?? record.latitude;

    const ringColor = getRingColor(record);
    const displayName = record.user?.displayName || record.user?.username || 'Member';
    const initials = getInitials(displayName);
    const speedLabel =
      record.movementState === 'DRIVING'
        ? formatSpeedKmh(record.speed)
        : record.movementState === 'WALKING'
        ? 'WALK'
        : 'STATIONARY';

    return (
      <Marker
        id={`member-${record.userId}`}
        lngLat={[lng, lat]}
        anchor="center"
      >
        <TouchableOpacity
          testID={`member-marker-${record.userId}`}
          activeOpacity={0.8}
          onPress={() => onPress?.(record)}
          style={[
            styles.container,
            record.isStale && styles.staleContainer,
          ]}
          accessibilityLabel={`${displayName}, ${record.movementState}, ${
            record.isStale ? 'Stale' : 'Live'
          }`}
          accessibilityRole="button"
        >
          {/* Current User Outer Pulse Ring */}
          {record.isCurrentUser && (
            <View
              testID="self-pulse-ring"
              style={[
                styles.selfRing,
                { borderColor: MAP_CONFIG.SELF_RING_COLOR },
              ]}
            />
          )}

          {/* Avatar Ring with Movement State Color */}
          <View
            style={[
              styles.avatarFrame,
              { borderColor: ringColor },
              isSelected && styles.selectedFrame,
            ]}
          >
            {record.user?.avatarPath ? (
              <Image
                source={{ uri: record.user.avatarPath }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Current User "YOU" Badge */}
          {record.isCurrentUser && (
            <View style={styles.youBadge} testID="you-badge">
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          )}

          {/* Movement / Speed Pill */}
          <View
            style={[
              styles.statePill,
              { borderColor: ringColor },
              record.isStale && styles.stalePill,
            ]}
          >
            <View style={[styles.stateDot, { backgroundColor: ringColor }]} />
            <Text style={styles.stateText}>
              {record.isStale ? 'STALE' : speedLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </Marker>
    );
  },
);

MemberLocationMarker.displayName = 'MemberLocationMarker';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 72,
  },
  staleContainer: {
    opacity: 0.55,
  },
  selfRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    top: 0,
  },
  avatarFrame: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedFrame: {
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  youBadge: {
    position: 'absolute',
    top: -2,
    backgroundColor: '#0284C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statePill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  stalePill: {
    backgroundColor: '#181E29',
    borderColor: '#6B7280',
  },
  stateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stateText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
