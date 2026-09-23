import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Alert, Animated, Easing } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { haptics } from '../../../utils/haptics';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  RadioCheckedIcon,
  RadioUncheckedIcon,
  CheckboxCheckedIcon,
  CheckboxUncheckedIcon,
  TrophyIcon,
  LockIcon,
  ClosePollIcon,
} from './PollIcons';
import type { PollRecord } from '../types';

export interface PollCardProps {
  poll: PollRecord;
  currentUserId?: string;
  isExpired?: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll?: (pollId: string) => void;
  onDeletePoll?: (pollId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

interface AnimatedProgressBarProps {
  percentage: number;
  isUserVoted: boolean;
  isWinner: boolean;
  isClosed: boolean;
  prefersReducedMotion: boolean;
}

const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  percentage,
  isUserVoted,
  isWinner,
  isClosed,
  prefersReducedMotion,
}) => {
  const animWidth = useRef(new Animated.Value(prefersReducedMotion ? percentage : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      animWidth.setValue(percentage);
    } else {
      Animated.timing(animWidth, {
        toValue: percentage,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [percentage, prefersReducedMotion, animWidth]);

  return (
    <Animated.View
      style={[
        styles.percentageBar,
        {
          width: animWidth.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        },
        isUserVoted && styles.percentageBarVoted,
        isWinner && isClosed && styles.percentageBarWinner,
      ]}
    />
  );
};

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserId,
  isExpired = false,
  onVote,
  onClosePoll,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isPastExpiry = Boolean(
    poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now(),
  );
  const isClosed = poll.isClosed || isPastExpiry;
  const isVotingDisabled = isClosed || isExpired;

  const isCreator = Boolean(currentUserId && poll.creatorId === currentUserId);

  const handleOptionPress = (optionId: string) => {
    if (isExpired) {
      Alert.alert(
        'Space Expired',
        'This space has dissolved. Voting has been frozen in read-only mode.',
        [{ text: 'Understood' }],
      );
      return;
    }
    if (isClosed) {
      Alert.alert('Poll Closed', 'This poll is closed and no longer accepting votes.', [
        { text: 'Understood' },
      ]);
      return;
    }
    haptics.selection();
    onVote(poll.id, optionId);
  };

  const handleClosePress = () => {
    Alert.alert(
      'Close Poll',
      'Are you sure you want to close this poll? Members will no longer be able to vote.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Poll',
          style: 'destructive',
          onPress: () => onClosePoll && onClosePoll(poll.id),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, isClosed && styles.containerClosed]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.creatorRow}>
          <View style={styles.avatarMini}>
            <Text variant="caption" weight="bold" style={styles.avatarInitial}>
              {poll.creator?.displayName?.charAt(0).toUpperCase() || 'M'}
            </Text>
          </View>
          <View>
            <Text variant="caption" weight="semibold" style={styles.creatorName}>
              {poll.creator?.displayName || 'Member'}
            </Text>
            <Text variant="caption" style={styles.timestamp}>
              {formatRelativeTime(poll.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.headerBadges}>
          <View style={[styles.badge, poll.isMultipleChoice ? styles.badgeMulti : styles.badgeSingle]}>
            <Text variant="caption" weight="medium" style={styles.badgeText}>
              {poll.isMultipleChoice ? 'Multi-Choice' : 'Single Choice'}
            </Text>
          </View>

          {isClosed ? (
            <View style={[styles.badge, styles.badgeClosed]}>
              <LockIcon size={12} color="#94A3B8" />
              <Text variant="caption" weight="medium" style={styles.badgeClosedText}>
                Closed
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeActive]}>
              <Text variant="caption" weight="semibold" style={styles.badgeActiveText}>
                Active
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Question */}
      <Text variant="body" weight="bold" style={styles.question}>
        {poll.question}
      </Text>

      {/* Winner / Tie Banner when closed */}
      {isClosed && poll.totalVotes > 0 && (
        <View style={[styles.consensusBanner, poll.isTie && styles.consensusBannerTie]}>
          <TrophyIcon size={16} color={poll.isTie ? '#A78BFA' : '#F59E0B'} />
          <Text
            variant="caption"
            weight="semibold"
            style={[styles.consensusText, poll.isTie && styles.consensusTextTie]}
          >
            {poll.isTie
              ? 'Consensus: Tie between top choices'
              : `Consensus: ${poll.options.find((o) => o.isWinner)?.optionText || 'Leading choice'}`}
          </Text>
        </View>
      )}

      {/* Options List */}
      <View style={styles.optionsList}>
        {poll.options.map((option) => (
          <Pressable
            key={option.id}
            testID={`poll-option-${option.id}`}
            style={[
              styles.optionButton,
              option.isUserVoted && styles.optionButtonVoted,
              option.isWinner && isClosed && styles.optionButtonWinner,
            ]}
            onPress={() => handleOptionPress(option.id)}
            disabled={isVotingDisabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: option.isUserVoted }}
            accessibilityLabel={`${option.optionText}, ${option.percentage}% with ${option.voteCount} votes`}
          >
            {/* Animated Percentage Bar Fill */}
            <AnimatedProgressBar
              percentage={option.percentage}
              isUserVoted={option.isUserVoted}
              isWinner={Boolean(option.isWinner)}
              isClosed={isClosed}
              prefersReducedMotion={prefersReducedMotion}
            />

            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                {poll.isMultipleChoice ? (
                  option.isUserVoted ? (
                    <CheckboxCheckedIcon size={18} />
                  ) : (
                    <CheckboxUncheckedIcon size={18} />
                  )
                ) : option.isUserVoted ? (
                  <RadioCheckedIcon size={18} />
                ) : (
                  <RadioUncheckedIcon size={18} />
                )}

                <Text
                  variant="body"
                  weight={option.isUserVoted ? 'semibold' : 'regular'}
                  style={[styles.optionText, option.isUserVoted && styles.optionTextVoted]}
                >
                  {option.optionText}
                </Text>
              </View>

              <View style={styles.optionRight}>
                {option.isWinner && isClosed && (
                  <View style={styles.winnerIconWrapper}>
                    <TrophyIcon size={14} color="#F59E0B" />
                  </View>
                )}
                <Text
                  variant="caption"
                  weight="semibold"
                  style={[styles.percentageText, option.isUserVoted && styles.percentageTextVoted]}
                >
                  {option.percentage}% ({option.voteCount})
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text variant="caption" style={styles.voteStats}>
            {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
            {poll.totalVoters > 0 && ` • ${poll.totalVoters} ${poll.totalVoters === 1 ? 'member' : 'members'}`}
          </Text>
        </View>

        {!isClosed && isCreator && onClosePoll && !isExpired && (
          <Pressable
            testID="close-poll-button"
            style={styles.closeButton}
            onPress={handleClosePress}
            hitSlop={8}
          >
            <ClosePollIcon size={14} color="#F59E0B" />
            <Text variant="caption" weight="medium" style={styles.closeButtonText}>
              Close Poll
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  containerClosed: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0E1422',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  creatorName: {
    color: tokens.colors.text.primary,
    fontSize: 12,
  },
  timestamp: {
    color: tokens.colors.text.secondary,
    fontSize: 10,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
  },
  badgeSingle: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  badgeMulti: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  badgeText: {
    color: '#A5B4FC',
    fontSize: 10,
  },
  badgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeActiveText: {
    color: '#34D399',
    fontSize: 10,
  },
  badgeClosed: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  badgeClosedText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  question: {
    color: tokens.colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: tokens.spacing.sm,
  },
  consensusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    marginBottom: tokens.spacing.sm,
  },
  consensusBannerTie: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  consensusText: {
    color: '#F59E0B',
    fontSize: 12,
  },
  consensusTextTie: {
    color: '#C4B5FD',
  },
  optionsList: {
    gap: 8,
  },
  optionButton: {
    position: 'relative',
    height: 48,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  optionButtonVoted: {
    borderColor: tokens.colors.primary.default,
  },
  optionButtonWinner: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  percentageBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  percentageBarVoted: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  percentageBarWinner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    zIndex: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
    paddingRight: 8,
  },
  optionText: {
    color: tokens.colors.text.secondary,
    fontSize: 13,
  },
  optionTextVoted: {
    color: tokens.colors.text.primary,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  winnerIconWrapper: {
    paddingRight: 2,
  },
  percentageText: {
    color: tokens.colors.text.secondary,
    fontSize: 12,
  },
  percentageTextVoted: {
    color: '#818CF8',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteStats: {
    color: tokens.colors.text.secondary,
    fontSize: 11,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  closeButtonText: {
    color: '#F59E0B',
    fontSize: 11,
  },
});
