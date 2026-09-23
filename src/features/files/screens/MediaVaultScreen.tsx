import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import EmptyState from '../../../components/EmptyState';
import ErrorState from '../../../components/ErrorState';
import { SkeletonFile, FadeInContent } from '../../../components/skeleton';
import { useAuth } from '../../../hooks/useAuth';
import { groupService } from '../../groups/services/groupService';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import type { GroupDetailedRecord } from '../../groups/types';
import type { RootStackScreenProps } from '../../../navigation/types';
import type { GroupFile, FileFilterTab } from '../types';
import { useMediaVault } from '../hooks/useMediaVault';
import { FileCard } from '../components/FileCard';
import { UploadModal } from '../components/UploadModal';
import {
  FileGenericIcon,
  UploadIcon,
  LockIcon,
} from '../components/FileIcons';

export const MediaVaultScreen: React.FC<RootStackScreenProps<'MediaVault'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (groupId) {
      groupService.fetchGroupDetails(groupId).then((res) => {
        if (isCurrent && res.group) {
          setGroup(res.group);
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [groupId]);

  const { remainingTime, isExpired } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state || 'ACTIVE',
    groupId,
  );

  const {
    filteredFiles,
    activeFilter,
    setActiveFilter,
    isLoading,
    isRefreshing,
    error,
    counts,
    refresh,
    uploadFile,
    deleteFile,
    getSignedUrl,
  } = useMediaVault(groupId, currentUserId);

  const spaceName = group?.name || initialGroupName || 'Space';
  const remainingTimeText = isExpired
    ? 'EXPIRED'
    : typeof remainingTime === 'string'
    ? remainingTime
    : remainingTime?.formattedText || '--';

  const handleOpenFile = async (file: GroupFile) => {
    try {
      const signedUrl = await getSignedUrl(file.storagePath, 900);
      if (!signedUrl) {
        Alert.alert(
          'Access Error',
          'Could not generate a secure download link for this attachment.',
          [{ text: 'OK' }],
        );
        return;
      }

      try {
        await WebBrowser.openBrowserAsync(signedUrl);
      } catch {
        // Fallback to React Native Linking if WebBrowser fails
        const canOpen = await Linking.canOpenURL(signedUrl);
        if (canOpen) {
          await Linking.openURL(signedUrl);
        } else {
          Alert.alert(
            'Unable to Open',
            'No application available to open this attachment link.',
            [{ text: 'OK' }],
          );
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve attachment file.';
      Alert.alert('Download Error', message, [{ text: 'OK' }]);
    }
  };

  const handleDeleteFile = async (file: GroupFile) => {
    if (isExpired) {
      Alert.alert(
        'Space Expired',
        'This space has dissolved. The Media Vault has been frozen in read-only archive mode.',
        [{ text: 'Understood' }],
      );
      return;
    }

    const res = await deleteFile(file.id, file.storagePath);
    if (!res.success && res.error) {
      Alert.alert('Delete Failed', res.error, [{ text: 'OK' }]);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Space Header */}
      <View style={styles.header}>
        <Pressable
          testID="media-vault-back-button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Text variant="body" weight="medium" style={styles.backButtonText}>
            Back
          </Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text variant="title3" weight="bold" style={styles.title} numberOfLines={1}>
            Media Vault
          </Text>
          <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
            {spaceName}
          </Text>
        </View>

        {/* Space Lifespan Badge */}
        <View style={[styles.lifespanBadge, isExpired && styles.lifespanBadgeExpired]}>
          <Text
            variant="caption"
            weight="bold"
            style={[styles.lifespanText, isExpired && styles.lifespanTextExpired]}
          >
            {remainingTimeText}
          </Text>
        </View>
      </View>

      {/* Read-Only Expiration Banner */}
      {isExpired && (
        <View style={styles.expiredBanner}>
          <LockIcon size={16} color="#EF4444" />
          <Text variant="caption" weight="semibold" style={styles.expiredBannerText}>
            SPACE DISSOLVED — Media Vault is frozen in permanent read-only archive mode.
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {(
          [
            { tab: 'ALL' as FileFilterTab, label: 'All', count: counts.all },
            { tab: 'IMAGES' as FileFilterTab, label: 'Images', count: counts.images },
            { tab: 'DOCUMENTS' as FileFilterTab, label: 'Documents', count: counts.documents },
          ]
        ).map(({ tab, label, count }) => {
          const isActive = activeFilter === tab;
          return (
            <Pressable
              key={tab}
              testID={`tab-${tab.toLowerCase()}`}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                variant="caption"
                weight={isActive ? 'bold' : 'medium'}
                style={[styles.tabText, isActive && styles.tabTextActive]}
              >
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content Area */}
      {isLoading ? (
        <SkeletonFile count={4} />
      ) : error && filteredFiles.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FadeInContent style={{ flex: 1 }}>
          <FlatList
            data={filteredFiles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FileCard
                file={item}
                currentUserId={currentUserId}
                isExpired={isExpired}
                onOpen={handleOpenFile}
                onDelete={handleDeleteFile}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor="#10B981"
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<FileGenericIcon size={48} color="#10B981" />}
                title={
                  activeFilter === 'ALL'
                    ? 'Media Vault is Empty'
                    : activeFilter === 'IMAGES'
                    ? 'No Images in Vault'
                    : 'No Documents in Vault'
                }
                description={
                  activeFilter === 'ALL'
                    ? 'No private documents or media attachments have been uploaded to this temporary space yet.'
                    : activeFilter === 'IMAGES'
                    ? 'No image files found in this temporary space.'
                    : 'No document or PDF files found in this temporary space.'
                }
                actionLabel={!isExpired ? 'Upload File' : undefined}
                onAction={() => setUploadModalVisible(true)}
              />
            }
          />
        </FadeInContent>
      )}

      {/* Floating Action Button (FAB) */}
      {!isExpired && (
        <Pressable
          testID="upload-file-fab"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => setUploadModalVisible(true)}
          accessibilityLabel="Upload File to Vault"
        >
          <UploadIcon size={20} color="#FFFFFF" />
          <Text variant="callout" weight="bold" style={styles.fabText}>
            Upload
          </Text>
        </Pressable>
      )}

      {/* Upload Modal */}
      <UploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onUpload={uploadFile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: tokens.colors.primary.default,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  title: {
    color: tokens.colors.text.primary,
  },
  subtitle: {
    color: tokens.colors.text.tertiary,
    marginTop: 1,
  },
  lifespanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  lifespanBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  lifespanText: {
    color: '#38BDF8',
    fontSize: 11,
  },
  lifespanTextExpired: {
    color: '#EF4444',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  expiredBannerText: {
    color: '#EF4444',
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  tabText: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  tabTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: tokens.radius.full,
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: '#FFFFFF',
  },
});

export default MediaVaultScreen;
