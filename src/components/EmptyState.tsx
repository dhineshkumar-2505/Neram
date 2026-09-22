import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../design';
import Text from './Text';
import Button from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text variant="title2" weight="semibold" align="center" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color="secondary" align="center" style={styles.description}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="primary"
          size="md"
          onPress={onAction}
          style={styles.actionButton}
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
  iconContainer: {
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: tokens.spacing.xs,
  },
  description: {
    marginBottom: tokens.spacing.lg,
    maxWidth: 320,
  },
  actionButton: {
    minWidth: 160,
  },
});

export default EmptyState;
