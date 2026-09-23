import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import { MAP_CONFIG } from '../config/mapConfig';
import type { EventDestination } from '../types';
import { DestinationFlagIcon, RendezvousPinIcon } from './LocationIcons';

export interface DestinationMarkerProps {
  destination: EventDestination;
  onPress?: (destination: EventDestination) => void;
}

export const DestinationMarker: React.FC<DestinationMarkerProps> = React.memo(
  ({ destination, onPress }) => {
    const isMilestone = Boolean(destination.isMilestone);
    const pinColor = MAP_CONFIG.DESTINATION_COLOR;

    return (
      <Marker
        id={`dest-${destination.id}`}
        lngLat={[destination.longitude, destination.latitude]}
        anchor="bottom"
      >
        <TouchableOpacity
          testID={`destination-marker-${destination.id}`}
          activeOpacity={0.8}
          onPress={() => onPress?.(destination)}
          style={styles.container}
          accessibilityLabel={`Destination: ${destination.title}${
            isMilestone ? ', Milestone' : ''
          }`}
          accessibilityRole="button"
        >
          {/* Floating Venue / Title Pill */}
          <View style={styles.labelBubble}>
            {isMilestone && (
              <View style={styles.milestoneTag}>
                <Text style={styles.milestoneTagText}>MILESTONE</Text>
              </View>
            )}
            <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
              {destination.locationName || destination.title}
            </Text>
          </View>

          {/* Pin Graphic */}
          <View style={styles.pinWrapper}>
            {isMilestone ? (
              <DestinationFlagIcon size={26} color={pinColor} />
            ) : (
              <RendezvousPinIcon size={26} color={pinColor} />
            )}
          </View>
        </TouchableOpacity>
      </Marker>
    );
  },
);

DestinationMarker.displayName = 'DestinationMarker';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  labelBubble: {
    backgroundColor: '#0F172A',
    borderColor: '#F43F5E',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    maxWidth: 160,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  milestoneTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2,
  },
  milestoneTagText: {
    color: '#FDA4AF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 4,
  },
});
