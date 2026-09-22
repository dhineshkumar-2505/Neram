import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { tokens } from '../design';

export type TextVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'body'
  | 'callout'
  | 'footnote'
  | 'caption';

export type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'danger';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: keyof typeof tokens.typography.weights;
  align?: TextStyle['textAlign'];
  children?: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'primary',
  weight,
  align,
  style,
  children,
  ...rest
}) => {
  const textColorMap: Record<TextColor, string> = {
    primary: tokens.colors.text.primary,
    secondary: tokens.colors.text.secondary,
    tertiary: tokens.colors.text.tertiary,
    inverse: tokens.colors.text.inverse,
    accent: tokens.colors.primary.default,
    danger: tokens.colors.status.danger,
  };

  const textStyle: TextStyle = {
    fontSize: tokens.typography.sizes[variant],
    lineHeight: tokens.typography.lineHeights[variant],
    color: textColorMap[color],
    fontWeight: weight ? tokens.typography.weights[weight] : undefined,
    textAlign: align,
  };

  return (
    <RNText style={[styles.base, textStyle, style]} allowFontScaling={true} {...rest}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: undefined, // Uses system font (San Francisco / Roboto) for optimal native rendering
  },
});

export default Text;
