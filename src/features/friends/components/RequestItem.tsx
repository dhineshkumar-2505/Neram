import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { tokens } from '../../../design';
import type { FriendRequest } from '../../../types/friends';
import Text from '../../../components/Text';
import Button from '../../../components/Button';

export interface RequestItemProps {
  request: FriendRequest;
  isIncoming: boolean;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  isBusy?: boolean;
}

export const RequestItem: React.FC<RequestItemProps> = ({
  request,
  isIncoming,
  onAccept,
  onDecline,
  onCancel,
  isBusy = false,
}) => {
  const { profile } = request;

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile.avatarPath ? (
            <Image source={{ uri: profile.avatarPath }} style={styles.avatarImage} />
          ) : (
            <Text weight="bold" style={styles.avatarInitials}>
              {getInitials(profile.displayName)}
            </Text>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.infoCol}>
          <Text weight="semibold" style={styles.displayName}>
            {profile.displayName}
          </Text>
          <Text style={styles.handleText}>@{profile.username}</Text>

          {profile.bio ? (
            <Text style={styles.bioText} numberOfLines={2}>
              "{profile.bio}"
            </Text>
          ) : null}
        </View>
      </View>

      {/* Action Row */}
      {isIncoming ? (
        <View style={styles.actionRow}>
          <Button
            title="Decline"
            variant="outline"
            size="sm"
            onPress={() => onDecline && onDecline(request.id)}
            disabled={isBusy}
            style={styles.declineBtn}
            accessibilityLabel={`Decline friend request from ${profile.displayName}`}
          />
          <Button
            title="Accept"
            variant="primary"
            size="sm"
            onPress={() => onAccept && onAccept(request.id)}
            disabled={isBusy}
            style={styles.acceptBtn}
            accessibilityLabel={`Accept friend request from ${profile.displayName}`}
          />
        </View>
      ) : (
        <View style={styles.outgoingRow}>
          <Text style={styles.pendingBadge}>Awaiting response</Text>
          <Pressable
            onPress={() => onCancel && onCancel(request.id)}
            disabled={isBusy}
            hitSlop={8}
            style={styles.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel={`Cancel friend request to ${profile.displayName}`}
          >
            <Text style={styles.cancelText}>Cancel Request</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 18,
    color: '#2DD4BF',
  },
  infoCol: {
    flex: 1,
  },
  displayName: {
    fontSize: tokens.typography.sizes.body,
    color: '#F8FAFC',
    marginBottom: 2,
  },
  handleText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#818CF8',
    marginBottom: 4,
  },
  bioText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  declineBtn: {
    minWidth: 88,
  },
  acceptBtn: {
    minWidth: 96,
    backgroundColor: '#4F46E5',
  },
  outgoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
  },
  pendingBadge: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
  },
  cancelBtn: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  cancelText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#F87171',
    fontWeight: '600',
  },
});

export default RequestItem;
