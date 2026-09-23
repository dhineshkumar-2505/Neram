import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CrosshairIcon, GroupBoundsIcon } from './LocationIcons';

export interface LocationMapControlsProps {
  onCenterOnMe: () => void;
  onFitGroup: () => void;
  hasSelfLocation: boolean;
  isConnected: boolean;
  activeMembersCount: number;
}

export const LocationMapControls: React.FC<LocationMapControlsProps> = ({
  onCenterOnMe,
  onFitGroup,
  hasSelfLocation,
  isConnected,
  activeMembersCount,
}) => {
  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* Top Status Banner */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.statusPill} testID="connection-status-pill">
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10B981' : '#F59E0B' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'LIVE' : 'SYNCING'}
          </Text>
          <View style={styles.statusDivider} />
          <Text style={styles.memberCountText} testID="active-members-count">
            {activeMembersCount} {activeMembersCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>

      {/* Floating Action Controls (Right Bottom) */}
      <View style={styles.controlsColumn} pointerEvents="box-none">
        {/* Fit Group / All Members */}
        <TouchableOpacity
          style={styles.controlButton}
          activeOpacity={0.7}
          onPress={onFitGroup}
          testID="btn-fit-group"
          accessibilityLabel="Fit all members in view"
          accessibilityRole="button"
        >
          <GroupBoundsIcon size={20} color="#38BDF8" />
        </TouchableOpacity>

        {/* Center on My Position */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            !hasSelfLocation && styles.disabledButton,
          ]}
          activeOpacity={0.7}
          onPress={onCenterOnMe}
          disabled={!hasSelfLocation}
          testID="btn-center-me"
          accessibilityLabel="Center on my location"
          accessibilityRole="button"
        >
          <CrosshairIcon
            size={20}
            color={hasSelfLocation ? '#38BDF8' : '#64748B'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#334155',
  },
  memberCountText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  controlsColumn: {
    alignSelf: 'flex-end',
    gap: 12,
    marginBottom: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  disabledButton: {
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
});
