import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../design';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  spacingSize?: keyof typeof tokens.spacing;
  color?: string;
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  spacingSize = 'md',
  color = tokens.colors.border.subtle,
  style,
}) => {
  const margin = tokens.spacing[spacingSize];

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          styles.vertical,
          { backgroundColor: color, marginHorizontal: margin },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.horizontal,
        { backgroundColor: color, marginVertical: margin },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
  },
  vertical: {
    width: 1,
    height: '100%',
  },
});

export default Divider;
