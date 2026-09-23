import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { tokens } from '../../../design';
import { useAuth } from '../../../hooks/useAuth';
import { searchExactUsername, type ExactProfileSearchResult } from '../../profile/services/profileSearch';
import { friendsService } from '../services/friendsService';
import type { RelationshipStatus } from '../../../types/friends';
import Text from '../../../components/Text';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

export interface AddFriendSectionProps {
  onFriendAdded?: () => void;
}

export const AddFriendSection: React.FC<AddFriendSectionProps> = ({ onFriendAdded }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<ExactProfileSearchResult | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>('NONE');
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(
    null,
  );

  // Debounced exact username search with race-condition prevention
  useEffect(() => {
    let isCurrent = true;
    const trimmed = query.trim().replace(/^@/, '');
    setFeedback(null);

    if (trimmed.length < 3) {
      setSearchResult(null);
      setRelationship('NONE');
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { result, error } = await searchExactUsername(trimmed);
        if (!isCurrent) return;
        if (error) {
          setSearchResult(null);
          setHasSearched(true);
          return;
        }

        setSearchResult(result);
        setHasSearched(true);

        if (result && user) {
          const rel = await friendsService.getRelationshipStatus(user.id, result.userId);
          if (!isCurrent) return;
          setRelationship(rel);
        }
      } catch {
        if (isCurrent) setSearchResult(null);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 400);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query, user]);

  const handleSendRequest = async () => {
    if (!user || !searchResult || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const res = await friendsService.sendFriendRequest(user.id, searchResult.userId);
      if (!res.success) {
        setFeedback({ message: res.error || 'Failed to send request.', isError: true });
        return;
      }

      setFeedback({ message: 'Friend request sent successfully!', isError: false });
      setRelationship('REQUEST_SENT');
      if (onFriendAdded) {
        onFriendAdded();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error sending request.';
      setFeedback({ message: msg, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  const cleanHandle = query.trim().replace(/^@/, '');

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <Input
        label="Search Exact Handle"
        value={query}
        onChangeText={(text) => setQuery(text.toLowerCase())}
        placeholder="username"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        prefix={<Text style={styles.prefixText}>@</Text>}
        suffix={isSearching ? <ActivityIndicator size="small" color="#818CF8" /> : null}
        hint="Neram does not allow fuzzy search. Type the exact handle."
        accessibilityLabel="Search Exact Handle"
      />

      {/* Feedback Banner */}
      {feedback && (
        <View
          style={[
            styles.banner,
            feedback.isError ? styles.bannerError : styles.bannerSuccess,
          ]}
          accessibilityRole="alert"
        >
          <Text
            style={[
              styles.bannerText,
              feedback.isError ? styles.bannerTextError : styles.bannerTextSuccess,
            ]}
          >
            {feedback.message}
          </Text>
          <Pressable
            onPress={() => setFeedback(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss feedback"
          >
            <Text
              style={[
                styles.dismissText,
                feedback.isError ? styles.bannerTextError : styles.bannerTextSuccess,
              ]}
            >
              ✕
            </Text>
          </Pressable>
        </View>
      )}

      {/* Search Result Card */}
      {searchResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {searchResult.avatarPath ? (
                <Image
                  source={{ uri: searchResult.avatarPath }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text weight="bold" style={styles.avatarInitials}>
                  {getInitials(searchResult.displayName)}
                </Text>
              )}
            </View>

            {/* Profile Info */}
            <View style={styles.infoCol}>
              <Text weight="semibold" style={styles.displayName}>
                {searchResult.displayName}
              </Text>
              <Text style={styles.handleText}>@{searchResult.username}</Text>
              {searchResult.bio ? (
                <Text style={styles.bioText} numberOfLines={2}>
                  "{searchResult.bio}"
                </Text>
              ) : null}
            </View>
          </View>

          {/* Action / Relationship Badge */}
          <View style={styles.actionRow}>
            {relationship === 'SELF' && (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>This is your account</Text>
              </View>
            )}

            {relationship === 'FRIENDS' && (
              <View style={[styles.statusPill, styles.pillSuccess]}>
                <Text style={styles.pillTextSuccess}>✓ Mutual Friends</Text>
              </View>
            )}

            {relationship === 'REQUEST_SENT' && (
              <View style={[styles.statusPill, styles.pillMuted]}>
                <Text style={styles.pillTextMuted}>Request Pending</Text>
              </View>
            )}

            {relationship === 'REQUEST_RECEIVED' && (
              <View style={[styles.statusPill, styles.pillIndigo]}>
                <Text style={styles.pillTextIndigo}>Sent you a request</Text>
              </View>
            )}

            {relationship === 'BLOCKED' && (
              <View style={[styles.statusPill, styles.pillDanger]}>
                <Text style={styles.pillTextDanger}>User Blocked</Text>
              </View>
            )}

            {relationship === 'NONE' && (
              <Button
                title="Send Friend Request"
                variant="primary"
                size="md"
                onPress={handleSendRequest}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.sendButton}
                accessibilityLabel={`Send friend request to ${searchResult.displayName}`}
              />
            )}
          </View>
        </View>
      )}

      {/* No Match State */}
      {!isSearching && hasSearched && !searchResult && cleanHandle.length >= 3 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No user found</Text>
          <Text style={styles.emptySubtitle}>
            No user exists with the exact handle '@{cleanHandle}'. Double-check the handle with your friend.
          </Text>
        </View>
      )}

      {/* Privacy Architecture Notice */}
      <View style={styles.noticeCard}>
        <Text weight="semibold" style={styles.noticeTitle}>
          Safe Discovery Architecture
        </Text>
        <Text style={styles.noticeBody}>
          Nēram does not upload or scan your address book, and never displays public follower lists.
          Connections are deliberate, private, and formed strictly through exact usernames.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing.sm,
  },
  prefixText: {
    color: '#818CF8',
    fontSize: tokens.typography.sizes.body,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  bannerError: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  bannerText: {
    flex: 1,
    fontSize: tokens.typography.sizes.footnote,
  },
  bannerTextSuccess: {
    color: '#6EE7B7',
  },
  bannerTextError: {
    color: '#FCA5A5',
  },
  dismissText: {
    fontWeight: 'bold',
    marginLeft: tokens.spacing.sm,
  },
  resultCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: tokens.spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: tokens.spacing.md,
    borderWidth: 1.5,
    borderColor: '#818CF8',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 20,
    color: '#818CF8',
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
    width: '100%',
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    borderRadius: tokens.radius.full,
  },
  statusPill: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  statusPillText: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#94A3B8',
  },
  pillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pillTextSuccess: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#34D399',
    fontWeight: '600',
  },
  pillMuted: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  pillTextMuted: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#94A3B8',
  },
  pillIndigo: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  pillTextIndigo: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#818CF8',
    fontWeight: '600',
  },
  pillDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  pillTextDanger: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#F87171',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.lg,
  },
  emptyTitle: {
    fontSize: tokens.typography.sizes.callout,
    color: '#E2E8F0',
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    marginTop: tokens.spacing.md,
  },
  noticeTitle: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#CBD5E1',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    lineHeight: 18,
  },
});

export default AddFriendSection;
