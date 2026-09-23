import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { CheckIcon } from '../../../components/icons/CommonIcons';
import { friendsService } from '../../friends/services/friendsService';
import type { FriendProfile } from '../../../types/friends';

export interface FriendInviteSelectorProps {
  userId: string;
  selectedFriendIds: string[];
  onToggleFriend: (friendId: string) => void;
  disabled?: boolean;
}

/**
 * Mutual Friend Invitee Selector for Group Creation.
 * Strictly guarantees Neram's social safety rule:
 * Temporary spaces can only be formed with accepted mutual friends.
 */
export const FriendInviteSelector: React.FC<FriendInviteSelectorProps> = ({
  userId,
  selectedFriendIds,
  onToggleFriend,
  disabled = false,
}) => {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadFriends() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const res = await friendsService.fetchFriends(userId);
      if (isCurrent) {
        if (res.error) {
          setError(res.error);
        } else {
          setFriends(res.friends);
        }
        setLoading(false);
      }
    }

    loadFriends();

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q),
    );
  }, [friends, searchQuery]);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  const handleToggle = (friendId: string) => {
    if (disabled) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // Fallback
    }

    onToggleFriend(friendId);
  };

  const selectedCount = selectedFriendIds.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="caption" weight="semibold" style={styles.sectionTitle}>
          INVITE MUTUAL FRIENDS
        </Text>
        {selectedCount > 0 && (
          <View style={styles.selectedCountBadge}>
            <Text style={styles.selectedCountText}>
              {selectedCount} {selectedCount === 1 ? 'Invited' : 'Invited'}
            </Text>
          </View>
        )}
      </View>

      <Text variant="caption" style={styles.safetyNotice}>
        Only accepted mutual friends can be invited to private spaces.
      </Text>

      {/* Search Input when friends list is populated */}
      {friends.length > 0 && (
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search mutual friends by name or @username..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!disabled}
            style={styles.searchInput}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#818CF8" />
          <Text variant="caption" style={styles.loadingText}>
            Loading mutual friends...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text variant="caption" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="footnote" weight="semibold" style={styles.emptyTitle}>
            No Mutual Friends Yet
          </Text>
          <Text variant="caption" style={styles.emptyDescription}>
            Neram spaces are strictly private. You can create this space now and invite friends after adding them to your circle.
          </Text>
        </View>
      ) : filteredFriends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="caption" style={styles.emptyDescription}>
            No friends match &quot;{searchQuery}&quot;.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {filteredFriends.map((friend) => {
            const isSelected = selectedFriendIds.includes(friend.userId);

            return (
              <Pressable
                key={friend.userId}
                onPress={() => handleToggle(friend.userId)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityLabel={`${friend.displayName} (@${friend.username})`}
                accessibilityState={{ checked: isSelected }}
                style={[
                  styles.friendItem,
                  isSelected && styles.friendItemSelected,
                  disabled && styles.friendItemDisabled,
                ]}
              >
                {/* Initials Avatar */}
                <View
                  style={[
                    styles.avatarBadge,
                    isSelected && styles.avatarBadgeSelected,
                  ]}
                >
                  <Text
                    weight="bold"
                    style={[
                      styles.avatarText,
                      isSelected && styles.avatarTextSelected,
                    ]}
                  >
                    {getInitials(friend.displayName)}
                  </Text>
                </View>

                {/* Identity Info */}
                <View style={styles.infoCol}>
                  <Text
                    variant="callout"
                    weight="medium"
                    style={[
                      styles.displayNameText,
                      isSelected && styles.displayNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {friend.displayName}
                  </Text>
                  <Text variant="caption" style={styles.handleText} numberOfLines={1}>
                    @{friend.username}
                  </Text>
                </View>

                {/* Selection Checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}
                >
                  {isSelected && <CheckIcon size={12} color="#FFFFFF" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: tokens.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#64748B',
    letterSpacing: 0.8,
  },
  selectedCountBadge: {
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  selectedCountText: {
    fontSize: 10,
    color: '#2DD4BF',
    fontWeight: '700',
  },
  safetyNotice: {
    color: '#64748B',
    paddingHorizontal: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  searchContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  searchInput: {
    height: 40,
    color: '#F8FAFC',
    fontSize: tokens.typography.sizes.footnote,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  loadingText: {
    color: '#64748B',
  },
  errorContainer: {
    padding: tokens.spacing.sm,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: tokens.radius.sm,
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
  },
  emptyContainer: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: tokens.spacing.md,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#94A3B8',
    marginBottom: 4,
  },
  emptyDescription: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContainer: {
    gap: tokens.spacing.xs,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: tokens.spacing.sm,
  },
  friendItemSelected: {
    borderColor: 'rgba(45, 212, 191, 0.4)',
    backgroundColor: 'rgba(45, 212, 191, 0.05)',
  },
  friendItemDisabled: {
    opacity: 0.5,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm,
  },
  avatarBadgeSelected: {
    backgroundColor: '#4F46E5',
  },
  avatarText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  avatarTextSelected: {
    color: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
  },
  displayNameText: {
    color: '#E2E8F0',
    fontSize: tokens.typography.sizes.body,
  },
  displayNameSelected: {
    color: '#F8FAFC',
  },
  handleText: {
    color: '#64748B',
    fontSize: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2DD4BF',
    borderColor: '#2DD4BF',
  },
  checkmarkIcon: {
    color: '#0B0F19',
    fontSize: 12,
    lineHeight: 14,
  },
});

export default FriendInviteSelector;
