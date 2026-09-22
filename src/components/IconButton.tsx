import React from 'react';
import { Pressable, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { tokens } from '../design';

export type IconButtonVariant = 'default' | 'filled' | 'subtle';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: React.ReactNode;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  accessibilityLabel,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
  ...rest
}) => {
  const sizeMap: Record<IconButtonSize, number> = {
    sm: 36,
    md: tokens.layout.minTouchTarget, // 44pt minimum
    lg: tokens.layout.primaryTouchTarget, // 52pt
  };

  const dimension = sizeMap[size];

  const getVariantStyles = (pressed: boolean): ViewStyle => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: pressed ? tokens.colors.primary.dark : tokens.colors.primary.default,
          borderWidth: 0,
        };
      case 'subtle':
        return {
          backgroundColor: pressed ? tokens.colors.border.subtle : tokens.colors.surfaceSubtle,
          borderWidth: 0,
        };
      case 'default':
      default:
        return {
          backgroundColor: pressed ? tokens.colors.surfaceSubtle : 'transparent',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        };
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          width: dimension,
          height: dimension,
          borderRadius: tokens.radius.full,
          opacity: disabled ? 0.4 : 1,
        },
        getVariantStyles(pressed),
        style,
      ]}
      hitSlop={size === 'sm' ? 6 : 0}
      {...rest}
    >
      {icon}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IconButton;
