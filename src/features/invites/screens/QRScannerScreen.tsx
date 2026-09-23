import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tokens } from '../../../design';
import { inviteService } from '../services/inviteService';
import { haptics } from '../../../utils/haptics';
import { BackIcon } from '../../../components/icons/CommonIcons';
import { JoinGroupModal } from '../components';
import type { RootStackParamList } from '../../../navigation/types';

const { width } = Dimensions.get('window');
const SCAN_FRAME_SIZE = Math.min(width * 0.72, 280);

export const QRScannerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned || activeToken) return;

      const token = inviteService.parseInviteTokenFromUrl(data);
      if (token) {
        setScanned(true);
        haptics.selection();
        setActiveToken(token);
        setScanError(null);
      } else {
        setScanned(true);
        haptics.warning();
        setScanError('Unrecognized barcode. Please scan a valid Neram QR code.');
        // Re-enable scanning after 2.5 seconds
        setTimeout(() => {
          setScanned(false);
          setScanError(null);
        }, 2500);
      }
    },
    [scanned, activeToken],
  );

  const handleCloseJoinModal = () => {
    setActiveToken(null);
    setScanned(false);
  };

  const handleJoinSuccess = (groupId: string, groupName: string) => {
    setActiveToken(null);
    navigation.replace('GroupDetail', { groupId, groupName });
  };

  // Permission: loading / undetermined
  if (!permission) {
    return <View style={styles.darkBackground} />;
  }

  // Permission: not granted
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionCategory}>CAMERA ACCESS</Text>
          <Text style={styles.permissionTitle}>Scan Group QR Codes</Text>
          <Text style={styles.permissionBody}>
            Neram requires camera access to scan temporary space QR codes. Your camera
            is used strictly for on-device barcode detection.
          </Text>

          {permission.canAskAgain ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={requestPermission}
            >
              <Text style={styles.primaryButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.primaryButtonText}>Open Device Settings</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
      )}

      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <BackIcon size={22} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Space QR</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* Viewfinder Overlay */}
      <View style={styles.overlayCenter}>
        <View style={styles.viewfinderFrame}>
          {/* Viewfinder Corners */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {/* Animated/Glowing Scan Line */}
          <View style={styles.scanLine} />
        </View>

        <Text style={styles.viewfinderHint}>
          Align the QR code within the frame to join
        </Text>

        {scanError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{scanError}</Text>
          </View>
        ) : null}
      </View>

      {/* Join Confirmation Modal */}
      {activeToken ? (
        <JoinGroupModal
          visible={!!activeToken}
          token={activeToken}
          onClose={handleCloseJoinModal}
          onSuccess={handleJoinSuccess}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  darkBackground: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  headerBar: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.semiBold,
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  headerRightSpacer: {
    width: 40,
  },
  overlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  viewfinderFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00FF9D',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#00FF9D',
    shadowColor: '#00FF9D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  viewfinderHint: {
    marginTop: tokens.spacing.lg,
    fontSize: 13,
    color: 'rgba(248, 250, 252, 0.85)',
    textAlign: 'center',
    fontFamily: tokens.typography.fontFamily.medium,
  },
  errorBanner: {
    marginTop: tokens.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  permissionCategory: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.semiBold,
    color: '#00FF9D',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.xs,
  },
  permissionTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F8FAFC',
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: tokens.spacing.xl,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#00FF9D',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  primaryButtonText: {
    color: '#0B0F19',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
  },
  cancelButton: {
    paddingVertical: tokens.spacing.xs,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
  },
});

export default QRScannerScreen;
