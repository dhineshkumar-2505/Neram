import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import { useAuth } from '../../../hooks/useAuth';
import {
  validateUsernameSyntax,
  checkUsernameAvailability,
} from '../../profile/services/usernameService';
import {
  AVATAR_PRESETS,
  type AvatarPreset,
} from '../../profile/services/avatarService';
import Text from '../../../components/Text';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import { CloseIcon } from '../../../components/icons/CommonIcons';

export interface OnboardingScreenProps {
  onSuccess?: () => void;
}

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Onboarding screen for new users to craft their identity in Neram.
 * Enforces database constraints, live username availability check,
 * and curated avatar themes.
 */
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onSuccess }) => {
  const { user, profile, updateProfile } = useAuth();

  // Initial values populated from existing Google profile metadata
  const initialDisplayName =
    profile?.display_name && profile.display_name !== 'Anonymous User'
      ? profile.display_name
      : '';
  const initialUsername =
    profile?.username && !profile.username.startsWith('user_')
      ? profile.username
      : '';

  const [displayName, setDisplayName] = useState<string>(initialDisplayName);
  const [username, setUsername] = useState<string>(initialUsername);
  const [statusMessage, setStatusMessage] = useState<string>(profile?.bio || '');
  const [selectedPreset, setSelectedPreset] = useState<AvatarPreset>(AVATAR_PRESETS[0]!);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_path || null);

  const [availability, setAvailability] = useState<AvailabilityStatus>('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounced username availability checker with race-condition prevention
  useEffect(() => {
    let isCancelled = false;
    const trimmed = username.trim();
    if (!trimmed) {
      setAvailability('idle');
      setUsernameFeedback('');
      return;
    }

    const syntaxCheck = validateUsernameSyntax(trimmed);
    if (!syntaxCheck.isValid) {
      setAvailability('invalid');
      setUsernameFeedback(syntaxCheck.error || 'Invalid username');
      return;
    }

    setAvailability('checking');
    setUsernameFeedback('Checking availability...');

    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(trimmed, user?.id);
      if (isCancelled) return;
      if (result.available) {
        setAvailability('available');
        setUsernameFeedback(`@${trimmed} is available`);
      } else {
        setAvailability('taken');
        setUsernameFeedback(result.error || 'Username is not available');
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [username, user?.id]);

  const isFormValid =
    displayName.trim().length >= 1 &&
    displayName.trim().length <= 50 &&
    availability === 'available' &&
    statusMessage.length <= 160;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const updated = await updateProfile({
        display_name: displayName.trim(),
        username: username.trim(),
        avatar_path: avatarUrl,
        bio: statusMessage.trim() ? statusMessage.trim() : null,
      });

      if (!updated) {
        setSubmitError('Failed to save profile. Please check connection and try again.');
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating profile.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [isFormValid, isSubmitting, updateProfile, displayName, username, avatarUrl, statusMessage, onSuccess]);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.substring(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Craft Your Identity</Text>
          <Text style={styles.subtitle}>
            Choose how your circle sees you. Neram does not use phone numbers or public social graphs.
          </Text>
        </View>

        {/* Avatar Setup Section */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: selectedPreset.backgroundColor },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text
                weight="bold"
                style={[styles.avatarInitials, { color: selectedPreset.accentColor }]}
              >
                {getInitials(displayName || 'Nēram')}
              </Text>
            )}
          </View>

          <Text style={styles.presetLabel}>Select your presence color theme</Text>
          <View style={styles.presetRow}>
            {AVATAR_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => {
                  setSelectedPreset(preset);
                  // If user toggles preset, switch from external image to styled monogram
                  if (avatarUrl && !avatarUrl.startsWith('data:')) {
                    setAvatarUrl(null);
                  }
                }}
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
        </View>

        {/* Error Feedback */}
        {submitError && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{submitError}</Text>
            <Pressable
              onPress={() => setSubmitError(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <CloseIcon size={14} color="#EF4444" />
            </Pressable>
          </View>
        )}

        {/* Identity Inputs */}
        <View style={styles.formContainer}>
          {/* Display Name Input */}
          <Input
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Maya Lin"
            maxLength={50}
            hint="Your name as it appears to friends in active circles."
            accessibilityLabel="Display Name"
          />

          {/* Username Input with Live Availability Feedback */}
          <Input
            label="Unique Handle"
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase())}
            placeholder="handle"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            prefix={<Text style={styles.usernamePrefix}>@</Text>}
            suffix={
              availability === 'checking' ? (
                <ActivityIndicator size="small" color="#818CF8" />
              ) : null
            }
            hint="3-20 characters (letters, numbers, underscores)"
            accessibilityLabel="Unique Handle"
          />

          {/* Availability Status Text */}
          {usernameFeedback && availability !== 'checking' && (
            <Text
              style={[
                styles.availabilityText,
                availability === 'available' && styles.availabilitySuccess,
                (availability === 'taken' || availability === 'invalid') &&
                  styles.availabilityError,
              ]}
            >
              {usernameFeedback}
            </Text>
          )}

          {/* Optional Presence Status Message */}
          <Input
            label="Presence Note (Optional)"
            value={statusMessage}
            onChangeText={setStatusMessage}
            placeholder="e.g. Exploring coffee spots in Chennai"
            maxLength={160}
            hint={`${statusMessage.length}/160 characters`}
            accessibilityLabel="Presence Note"
          />
        </View>

        {/* Submit Action */}
        <View style={styles.footer}>
          <Button
            title="Complete & Enter Nēram"
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            loading={isSubmitting}
            size="lg"
            accessibilityLabel="Complete & Enter Nēram"
            style={styles.submitButton}
          />
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
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.sizes.title1,
    lineHeight: tokens.typography.lineHeights.title1,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.footnote,
    lineHeight: 20,
    color: '#94A3B8',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: tokens.spacing.md,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
  presetLabel: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    marginBottom: tokens.spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
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
  formContainer: {
    marginVertical: tokens.spacing.sm,
  },
  usernamePrefix: {
    color: '#818CF8',
    fontSize: tokens.typography.sizes.body,
    fontWeight: '600',
  },
  availabilityText: {
    fontSize: tokens.typography.sizes.caption,
    marginTop: -tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  availabilitySuccess: {
    color: '#34D399',
  },
  availabilityError: {
    color: '#F87171',
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
  footer: {
    marginTop: tokens.spacing.xl,
    marginBottom: tokens.spacing.md,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: tokens.radius.full,
  },
});

export default OnboardingScreen;
