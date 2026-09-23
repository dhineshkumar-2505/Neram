import React from 'react';
import { View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { tokens } from '../../../design';
import type { FriendProfile } from '../../../types/friends';
import Text from '../../../components/Text';
import { MoreIcon } from '../../../components/icons/CommonIcons';

export interface FriendItemProps {
  friend: FriendProfile;
  onUnfriend: (friendId: string) => void;
  onBlock?: (friendId: string) => void;
}

export const FriendItem: React.FC<FriendItemProps> = ({
  friend,
  onUnfriend,
  onBlock,
}) => {
  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  const handleActionMenu = () => {
    Alert.alert(
      friend.displayName,
      `@${friend.username}`,
      [
        {
          text: 'Remove Friend',
          style: 'destructive',
          onPress: () => onUnfriend(friend.userId),
        },
        ...(onBlock
          ? [
              {
                text: 'Block User',
                style: 'destructive' as const,
                onPress: () => onBlock(friend.userId),
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {friend.avatarPath ? (
          <Image source={{ uri: friend.avatarPath }} style={styles.avatarImage} />
        ) : (
          <Text weight="bold" style={styles.avatarInitials}>
            {getInitials(friend.displayName)}
          </Text>
        )}
      </View>

      {/* Info Column */}
      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text weight="semibold" style={styles.displayName} numberOfLines={1}>
            {friend.displayName}
          </Text>
          <View style={styles.handleBadge}>
            <Text style={styles.handleText}>@{friend.username}</Text>
          </View>
        </View>

        {friend.bio ? (
          <Text style={styles.bioText} numberOfLines={1}>
            {friend.bio}
          </Text>
        ) : null}
      </View>

      {/* Action / Menu Trigger */}
      <Pressable
        onPress={handleActionMenu}
        hitSlop={12}
        style={styles.moreButton}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${friend.displayName}`}
      >
        <MoreIcon size={18} color="#94A3B8" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 16,
    color: '#818CF8',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: 2,
  },
  displayName: {
    fontSize: tokens.typography.sizes.body,
    color: '#F8FAFC',
    maxWidth: '65%',
  },
  handleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.radius.xs,
  },
  handleText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#818CF8',
  },
  bioText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
  },
  moreButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.sm,
  },
  moreButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FriendItem;
