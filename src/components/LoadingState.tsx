import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../design';
import Text from './Text';

export interface LoadingStateProps {
  message?: string;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  style,
}) => {
  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={tokens.colors.primary.default} />
      {message ? (
        <Text variant="callout" color="secondary" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  message: {
    marginTop: tokens.spacing.md,
    textAlign: 'center',
  },
});

export default LoadingState;
