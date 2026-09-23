import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import { useAuth } from '../../../hooks/useAuth';
import {
  AVATAR_PRESETS,
  type AvatarPreset,
} from '../services/avatarService';
import Text from '../../../components/Text';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import TimeGlyph from '../../auth/components/TimeGlyph';

export const ProfileScreen: React.FC = () => {
  const { profile, updateProfile, signOut, isLoading } = useAuth();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>(profile?.display_name || '');
  const [bio, setBio] = useState<string>(profile?.bio || '');
  const [selectedPreset, setSelectedPreset] = useState<AvatarPreset>(AVATAR_PRESETS[0]!);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  const handleStartEdit = () => {
    setDisplayName(profile?.display_name || '');
    setBio(profile?.bio || '');
    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDisplayName(profile?.display_name || '');
    setBio(profile?.bio || '');
    setErrorMessage(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    const trimmedName = displayName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 50) {
      setErrorMessage('Display name must be between 1 and 50 characters.');
      return;
    }

    if (bio.length > 160) {
      setErrorMessage('Presence note cannot exceed 160 characters.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const updated = await updateProfile({
        display_name: trimmedName,
        bio: bio.trim() ? bio.trim() : null,
      });

      if (!updated) {
        setErrorMessage('Failed to update profile. Please try again.');
        return;
      }

      setFeedbackMessage('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating profile.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setErrorMessage(msg);
      setIsSigningOut(false);
    }
  };

  const formattedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title & Branding */}
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Profile & Identity</Text>
          <View style={styles.headerGlyph}>
            <TimeGlyph size={32} color="#818CF8" accentColor="#2DD4BF" />
          </View>
        </View>

        {/* Feedback / Alert Banners */}
        {feedbackMessage && (
          <View style={styles.successBanner} accessibilityRole="alert">
            <Text style={styles.successText}>{feedbackMessage}</Text>
            <Pressable
              onPress={() => setFeedbackMessage(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss success notification"
            >
              <Text style={styles.successDismissText}>✕</Text>
            </Pressable>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => setErrorMessage(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error notification"
            >
              <Text style={styles.errorDismissText}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Identity Showcase Card */}
        <View style={styles.showcaseCard}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: selectedPreset.backgroundColor },
            ]}
          >
            {profile?.avatar_path ? (
              <Image source={{ uri: profile.avatar_path }} style={styles.avatarImage} />
            ) : (
              <Text
                weight="bold"
                style={[styles.avatarInitials, { color: selectedPreset.accentColor }]}
              >
                {getInitials(profile?.display_name || 'Nēram')}
              </Text>
            )}
          </View>

          <Text style={styles.profileName}>
            {profile?.display_name || 'Anonymous User'}
          </Text>

          <View style={styles.handleBadge}>
            <Text weight="semibold" style={styles.handleText}>
              @{profile?.username || 'user'}
            </Text>
          </View>

          {profile?.bio ? (
            <Text style={styles.bioText}>"{profile.bio}"</Text>
          ) : (
            <Text style={styles.bioPlaceholder}>No presence note set</Text>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Member since {formattedDate}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>Android KeyStore Secured</Text>
          </View>

          {!isEditing && (
            <Button
              title="Edit Profile"
              variant="outline"
              size="sm"
              onPress={handleStartEdit}
              style={styles.editButton}
              accessibilityLabel="Edit Profile"
            />
          )}
        </View>

        {/* Edit Profile Form */}
        {isEditing && (
          <Card variant="elevated" style={styles.editCard}>
            <Text weight="bold" style={styles.sectionTitle}>
              Update Identity
            </Text>

            <Input
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name or nickname"
              maxLength={50}
              hint="Visible to friends in active groups (1-50 characters)"
              accessibilityLabel="Edit Display Name"
            />

            <Input
              label="Presence Note"
              value={bio}
              onChangeText={setBio}
              placeholder="e.g. Exploring coffee spots in Chennai"
              maxLength={160}
              hint={`${bio.length}/160 characters`}
              accessibilityLabel="Edit Presence Note"
            />

            <Text style={styles.presetLabel}>Presence Theme</Text>
            <View style={styles.presetRow}>
              {AVATAR_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => setSelectedPreset(preset)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${preset.name} theme`}
                  style={[
                    styles.presetCircle,
                    { backgroundColor: preset.backgroundColor },
                    selectedPreset.id === preset.id && [
                      styles.presetCircleActive,
                      { borderColor: preset.accentColor },
                    ],
                  ]}
                >
                  <View
                    style={[styles.presetInnerDot, { backgroundColor: preset.accentColor }]}
                  />
                </Pressable>
              ))}
            </View>

            <View style={styles.editActionRow}>
              <Button
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={handleCancelEdit}
                disabled={isSaving}
                style={styles.cancelBtn}
                accessibilityLabel="Cancel editing"
              />
              <Button
                title="Save Changes"
                variant="primary"
                size="md"
                onPress={handleSaveProfile}
                loading={isSaving}
                disabled={isSaving}
                style={styles.saveBtn}
                accessibilityLabel="Save profile changes"
              />
            </View>
          </Card>
        )}

        {/* Privacy & Social Philosophy Card */}
        <Card variant="outlined" style={styles.philosophyCard}>
          <Text weight="semibold" style={styles.cardHeaderTitle}>
            Privacy & Identity Architecture
          </Text>

          <View style={styles.principleRow}>
            <View style={styles.principleBullet} />
            <View style={styles.principleTextCol}>
              <Text weight="medium" style={styles.principleHead}>
                Exact Username Lookup Only
              </Text>
              <Text style={styles.principleBody}>
                You can only be discovered by someone entering your exact @handle.
                No contact book scraping, phone verification, or algorithmic feeds.
              </Text>
            </View>
          </View>

          <View style={styles.principleRow}>
            <View style={[styles.principleBullet, { backgroundColor: '#2DD4BF' }]} />
            <View style={styles.principleTextCol}>
              <Text weight="medium" style={styles.principleHead}>
                Finite Presence
              </Text>
              <Text style={styles.principleBody}>
                When a temporary group expires, all live GPS transmissions and chat
                histories dissolve—leaving zero digital footprint.
              </Text>
            </View>
          </View>

          <View style={styles.principleRow}>
            <View style={[styles.principleBullet, { backgroundColor: '#818CF8' }]} />
            <View style={styles.principleTextCol}>
              <Text weight="medium" style={styles.principleHead}>
                Hardware-Encrypted Auth
              </Text>
              <Text style={styles.principleBody}>
                JWT access and refresh tokens are encrypted on-device via Android KeyStore
                (AES-256 GCM).
              </Text>
            </View>
          </View>
        </Card>

        {/* Sign Out Section */}
        <View style={styles.signOutContainer}>
          <Button
            title="Sign Out of Nēram"
            variant="danger"
            size="lg"
            onPress={handleSignOut}
            loading={isSigningOut || isLoading}
            disabled={isSigningOut || isLoading}
            accessibilityLabel="Sign Out of Nēram"
            style={styles.signOutButton}
          />
          <Text style={styles.footerNote}>
            Nēram v1.0.0 (Android) • Built for real-world presence
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  headerTitle: {
    fontSize: tokens.typography.sizes.title1,
    lineHeight: tokens.typography.lineHeights.title1,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  headerGlyph: {
    padding: tokens.spacing.xs,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  successText: {
    flex: 1,
    fontSize: tokens.typography.sizes.footnote,
    color: '#6EE7B7',
  },
  successDismissText: {
    color: '#6EE7B7',
    fontWeight: 'bold',
    marginLeft: tokens.spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: tokens.typography.sizes.footnote,
    color: '#FCA5A5',
  },
  errorDismissText: {
    color: '#FCA5A5',
    fontWeight: 'bold',
    marginLeft: tokens.spacing.sm,
  },
  showcaseCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  avatarContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 28,
  },
  profileName: {
    fontSize: tokens.typography.sizes.title2,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 4,
  },
  handleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
    marginBottom: tokens.spacing.sm,
  },
  handleText: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#818CF8',
  },
  bioText: {
    fontSize: tokens.typography.sizes.body,
    lineHeight: 22,
    color: '#CBD5E1',
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    fontStyle: 'italic',
  },
  bioPlaceholder: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#64748B',
    marginBottom: tokens.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  metaText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
  },
  metaDot: {
    color: '#64748B',
    marginHorizontal: tokens.spacing.xs,
  },
  editButton: {
    width: 140,
    marginTop: tokens.spacing.xs,
  },
  editCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: tokens.typography.sizes.title3,
    color: '#F8FAFC',
    marginBottom: tokens.spacing.md,
  },
  presetLabel: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#CBD5E1',
    marginBottom: tokens.spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  presetCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetCircleActive: {
    borderWidth: 2,
  },
  presetInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  philosophyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: tokens.spacing.xl,
  },
  cardHeaderTitle: {
    fontSize: tokens.typography.sizes.callout,
    color: '#F1F5F9',
    marginBottom: tokens.spacing.md,
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  principleBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginTop: 6,
    marginRight: tokens.spacing.sm,
  },
  principleTextCol: {
    flex: 1,
  },
  principleHead: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#E2E8F0',
    marginBottom: 2,
  },
  principleBody: {
    fontSize: tokens.typography.sizes.caption,
    lineHeight: 16,
    color: '#94A3B8',
  },
  signOutContainer: {
    alignItems: 'center',
    paddingTop: tokens.spacing.xs,
  },
  signOutButton: {
    width: '100%',
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  footerNote: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    marginTop: tokens.spacing.md,
    textAlign: 'center',
  },
});

export default ProfileScreen;
