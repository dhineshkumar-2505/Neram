import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import { GoogleIcon } from '../components/GoogleIcon';
import { TimeGlyph } from '../components/TimeGlyph';
import { signInWithGoogle } from '../../../services/auth/googleAuth';
import Text from '../../../components/Text';

export interface LoginScreenProps {
  onSuccess?: () => void;
}

/**
 * Human-centered Welcome & Authentication Screen for Neram.
 * Emphasizes presence, ephemeral privacy, and authentic human connection.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setErrorMessage(null);

      const result = await signInWithGoogle();

      if (result.cancelled) {
        // User cancelled the auth sheet; no jarring error needed
        return;
      }

      if (!result.success) {
        setErrorMessage(
          result.error || 'Unable to complete Google Sign-In. Please try again.',
        );
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected authentication error.';
      setErrorMessage(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Spacer for vertical balance */}
        <View style={styles.topSpacer} />

        {/* Brand Temporal Mark & Identity */}
        <View style={styles.brandContainer}>
          <View style={styles.glyphWrapper}>
            <TimeGlyph size={76} color="#818CF8" accentColor="#2DD4BF" />
          </View>

          <Text style={styles.brandTitle}>Nēram</Text>
          <Text style={styles.brandTagline}>Ephemeral circles. Real moments.</Text>

          <Text style={styles.manifestoText}>
            A quiet sanctuary for real-world plans. Groups exist only while you are together.
            When your plan concludes, the space dissolves—leaving zero permanent logs or digital trails.
          </Text>
        </View>

        {/* Human-crafted Core Principles */}
        <View style={styles.pillarsContainer}>
          <View style={styles.pillarItem}>
            <View style={styles.pillarDot} />
            <View style={styles.pillarTextGroup}>
              <Text weight="semibold" style={styles.pillarTitle}>
                Finite Presence
              </Text>
              <Text style={styles.pillarDescription}>
                Spaces automatically dissolve when your meetup ends.
              </Text>
            </View>
          </View>

          <View style={styles.pillarItem}>
            <View style={[styles.pillarDot, { backgroundColor: '#2DD4BF' }]} />
            <View style={styles.pillarTextGroup}>
              <Text weight="semibold" style={styles.pillarTitle}>
                Live On-Demand GPS
              </Text>
              <Text style={styles.pillarDescription}>
                Shared coordinates operate strictly during active plans. Never backgrounded.
              </Text>
            </View>
          </View>

          <View style={styles.pillarItem}>
            <View style={[styles.pillarDot, { backgroundColor: '#818CF8' }]} />
            <View style={styles.pillarTextGroup}>
              <Text weight="semibold" style={styles.pillarTitle}>
                Zero Retention
              </Text>
              <Text style={styles.pillarDescription}>
                No permanent social feeds, algorithmic ranking, or metadata harvesting.
              </Text>
            </View>
          </View>
        </View>

        {/* Error Feedback Banner */}
        {errorMessage && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => setErrorMessage(null)}
              hitSlop={8}
              style={styles.errorDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.errorDismissText}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Interactive Action Area */}
        <View style={styles.actionContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ busy: isSigningIn, disabled: isSigningIn }}
            disabled={isSigningIn}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              isSigningIn && styles.googleButtonDisabled,
            ]}
          >
            {isSigningIn ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#1F2937" />
                <Text weight="medium" style={styles.loadingLabel}>
                  Connecting securely...
                </Text>
              </View>
            ) : (
              <View style={styles.googleContentRow}>
                <GoogleIcon size={20} />
                <Text weight="semibold" style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </View>
            )}
          </Pressable>

          {/* Privacy Trust Guarantee */}
          <Text style={styles.privacyNote}>
            Android Protected • No phone numbers required • Instant Google verification
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
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xl,
    justifyContent: 'space-between',
  },
  topSpacer: {
    height: tokens.spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  glyphWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.lg,
  },
  brandTitle: {
    fontSize: tokens.typography.sizes.display,
    lineHeight: tokens.typography.lineHeights.display,
    color: '#F8FAFC',
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: tokens.spacing.xs,
  },
  brandTagline: {
    fontSize: tokens.typography.sizes.body,
    lineHeight: tokens.typography.lineHeights.body,
    color: '#818CF8',
    fontWeight: '500',
    marginBottom: tokens.spacing.md,
  },
  manifestoText: {
    fontSize: tokens.typography.sizes.footnote,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  pillarsContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: tokens.spacing.xl,
  },
  pillarItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  pillarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginTop: 6,
    marginRight: tokens.spacing.sm,
  },
  pillarTextGroup: {
    flex: 1,
  },
  pillarTitle: {
    fontSize: tokens.typography.sizes.callout,
    color: '#F1F5F9',
    marginBottom: 2,
  },
  pillarDescription: {
    fontSize: tokens.typography.sizes.footnote,
    lineHeight: 18,
    color: '#94A3B8',
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
    lineHeight: 18,
    color: '#FCA5A5',
  },
  errorDismiss: {
    marginLeft: tokens.spacing.sm,
    padding: tokens.spacing.xs,
  },
  errorDismissText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonPressed: {
    backgroundColor: '#F1F5F9',
    transform: [{ scale: 0.99 }],
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: tokens.typography.sizes.body,
    color: '#1F2937',
    marginLeft: tokens.spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    fontSize: tokens.typography.sizes.body,
    color: '#374151',
    marginLeft: tokens.spacing.sm,
  },
  privacyNote: {
    fontSize: tokens.typography.sizes.caption,
    lineHeight: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
});

export default LoginScreen;
