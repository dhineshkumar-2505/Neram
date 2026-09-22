import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../design';
import Text from './Text';
import Button from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error while processing your request. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  style,
}) => {
  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={styles.badge}>
        <View style={styles.dot} />
      </View>
      <Text variant="title2" weight="semibold" align="center" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color="secondary" align="center" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          title={retryLabel}
          variant="outline"
          size="md"
          onPress={onRetry}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xxl,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.status.danger,
  },
  title: {
    marginBottom: tokens.spacing.xs,
  },
  message: {
    marginBottom: tokens.spacing.lg,
    maxWidth: 320,
  },
  retryButton: {
    minWidth: 160,
  },
});

export default ErrorState;
