import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface FadeInContentProps {
  children: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Transitions newly loaded content into view with a smooth opacity fade.
 * Skips animation if reduced motion is enabled.
 */
export const FadeInContent: React.FC<FadeInContentProps> = ({
  children,
  duration = 250,
  style,
  testID,
}) => {
  const isReducedMotion = useReducedMotion();
  const opacityAnim = useRef(new Animated.Value(isReducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (isReducedMotion) {
      opacityAnim.setValue(1);
      return;
    }

    Animated.timing(opacityAnim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacityAnim, duration, isReducedMotion]);

  return (
    <Animated.View testID={testID} style={[{ opacity: opacityAnim, flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
};

export default FadeInContent;
