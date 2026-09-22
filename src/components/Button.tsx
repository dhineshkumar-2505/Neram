import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { tokens } from '../design';
import Text from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
    sm: { height: 36, paddingHorizontal: tokens.spacing.md, fontSize: tokens.typography.sizes.footnote },
    md: { height: tokens.layout.buttonHeight, paddingHorizontal: tokens.spacing.lg, fontSize: tokens.typography.sizes.body },
    lg: { height: tokens.layout.primaryTouchTarget, paddingHorizontal: tokens.spacing.xl, fontSize: tokens.typography.sizes.title3 },
  };

  const getVariantStyles = (pressed: boolean): { container: ViewStyle; textColor: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: pressed ? tokens.colors.secondary.dark : tokens.colors.secondary.default,
            borderWidth: 0,
          },
          textColor: { color: tokens.colors.text.inverse },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: pressed ? tokens.colors.surfaceSubtle : 'transparent',
            borderWidth: 1,
            borderColor: tokens.colors.border.default,
          },
          textColor: { color: tokens.colors.text.primary },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: pressed ? tokens.colors.surfaceSubtle : 'transparent',
            borderWidth: 0,
          },
          textColor: { color: tokens.colors.primary.default },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: pressed ? '#B91C1C' : tokens.colors.status.danger,
            borderWidth: 0,
          },
          textColor: { color: tokens.colors.text.inverse },
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: pressed ? tokens.colors.primary.dark : tokens.colors.primary.default,
            borderWidth: 0,
          },
          textColor: { color: tokens.colors.text.inverse },
        };
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => {
        const currentVariant = getVariantStyles(pressed);
        return [
          styles.base,
          {
            height: sizeStyles[size].height,
            paddingHorizontal: sizeStyles[size].paddingHorizontal,
            borderRadius: tokens.radius.md,
            opacity: isDisabled ? 0.5 : 1,
          },
          currentVariant.container,
          style,
        ];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? tokens.colors.primary.default : '#FFFFFF'}
        />
      ) : (
        <>
          {icon}
          <Text
            weight="semibold"
            style={[
              styles.text,
              { fontSize: sizeStyles[size].fontSize },
              getVariantStyles(false).textColor,
              icon ? styles.textWithIcon : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: tokens.layout.minTouchTarget,
  },
  text: {
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: tokens.spacing.sm,
  },
});

export default Button;
