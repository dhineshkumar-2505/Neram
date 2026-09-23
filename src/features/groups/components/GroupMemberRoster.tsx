import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { GroupMemberWithProfile, GroupRole } from '../types';

export interface GroupMemberRosterProps {
  members: GroupMemberWithProfile[];
  ownerId: string;
  currentUserRole: GroupRole | null;
  onInvitePress?: () => void;
  isExpired?: boolean;
}

/**
 * Membership Roster Component for Group Interior.
 * Displays active participants, role badges (OWNER, ADMIN, MEMBER),
 * and an administrative friend invitation action.
 */
export const GroupMemberRoster: React.FC<GroupMemberRosterProps> = ({
  members,
  ownerId,
  currentUserRole,
  onInvitePress,
  isExpired = false,
}) => {
  const canInvite =
    !isExpired && (currentUserRole === 'OWNER' || currentUserRole === 'ADMIN');

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Roster Header */}
      <View style={styles.headerRow}>
        <Text variant="caption" weight="semibold" style={styles.sectionTitle}>
          MEMBERS ({members.length})
        </Text>

        {canInvite && onInvitePress && (
          <Pressable
            onPress={onInvitePress}
            accessibilityRole="button"
            accessibilityLabel="Invite more mutual friends"
            style={styles.inviteButton}
          >
            <Text style={styles.inviteButtonText}>+ Add Friends</Text>
          </Pressable>
        )}
      </View>

      {/* Member Cards List */}
      <View style={styles.list}>
        {members.map((member) => {
          const isOwner = member.user_id === ownerId || member.role === 'OWNER';
          const isAdmin = member.role === 'ADMIN';
          const displayName = member.profile?.display_name || 'Member';
          const username = member.profile?.username || 'user';

          return (
            <View key={member.user_id} style={styles.memberCard}>
              {/* Avatar */}
              <View
                style={[
                  styles.avatar,
                  isOwner && styles.avatarOwner,
                  isAdmin && styles.avatarAdmin,
                ]}
              >
                <Text
                  weight="bold"
                  style={[
                    styles.avatarText,
                    isOwner && styles.avatarTextOwner,
                  ]}
                >
                  {getInitials(displayName)}
                </Text>
              </View>

              {/* Name & Handle */}
              <View style={styles.infoCol}>
                <Text variant="callout" weight="medium" style={styles.nameText} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text variant="caption" style={styles.handleText} numberOfLines={1}>
                  @{username}
                </Text>
              </View>

              {/* Role Badge */}
              <View
                style={[
                  styles.roleBadge,
                  isOwner && styles.roleBadgeOwner,
                  isAdmin && styles.roleBadgeAdmin,
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    isOwner && styles.roleBadgeTextOwner,
                    isAdmin && styles.roleBadgeTextAdmin,
                  ]}
                >
                  {member.role}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
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
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    color: '#64748B',
    letterSpacing: 0.8,
  },
  inviteButton: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  inviteButtonText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    gap: tokens.spacing.xs,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: tokens.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm,
  },
  avatarOwner: {
    backgroundColor: 'rgba(79, 70, 229, 0.3)',
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  avatarAdmin: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  avatarText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  avatarTextOwner: {
    color: '#F8FAFC',
  },
  infoCol: {
    flex: 1,
  },
  nameText: {
    color: '#E2E8F0',
  },
  handleText: {
    color: '#64748B',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
  },
  roleBadgeOwner: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  roleBadgeTextOwner: {
    color: '#818CF8',
  },
  roleBadgeTextAdmin: {
    color: '#38BDF8',
  },
});

export default GroupMemberRoster;
