import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { tokens } from '../design';

export type CardVariant = 'elevated' | 'outlined' | 'subtle';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'outlined',
  style,
  onPress,
  accessibilityLabel,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: tokens.colors.surface,
          borderWidth: 0,
          ...tokens.elevation.md,
        };
      case 'subtle':
        return {
          backgroundColor: tokens.colors.surfaceSubtle,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          ...tokens.elevation.sm,
        };
    }
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          getVariantStyles(),
          { opacity: pressed ? 0.85 : 1 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.base, getVariantStyles(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  },
});

export default Card;
