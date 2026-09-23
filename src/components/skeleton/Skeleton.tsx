import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { tokens } from '../../design';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * Base Shimmer component providing a smooth, looped high-contrast light sweep.
 * Powered by React Native native-driver animated transforms.
 */
export const SkeletonShimmer: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = tokens.radius.sm,
  style,
  testID,
  children,
}) => {
  const isReducedMotion = useReducedMotion();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReducedMotion) {
      animatedValue.setValue(0.5);
      return;
    }

    const shimmerAnimation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      }),
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [animatedValue, isReducedMotion]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 150],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.7, 0.35],
  });

  return (
    <View
      testID={testID}
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      {!isReducedMotion && (
        <Animated.View
          style={[
            styles.shimmerSweep,
            {
              transform: [{ translateX }],
              opacity,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
};

export const SkeletonBox: React.FC<SkeletonProps> = (props) => (
  <SkeletonShimmer {...props} />
);

export const SkeletonCircle: React.FC<{ size?: number; style?: StyleProp<ViewStyle>; testID?: string }> = ({
  size = 40,
  style,
  testID,
}) => (
  <SkeletonShimmer
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
    testID={testID}
  />
);

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  spacing?: number;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 1,
  lineHeight = 14,
  spacing = 8,
  width = '100%',
  style,
  testID,
}) => {
  return (
    <View style={style} testID={testID}>
      {Array.from({ length: lines }).map((_, index) => {
        // Vary line widths for authentic paragraph feel
        const lineWidth: DimensionValue =
          lines === 1
            ? width
            : index === lines - 1
            ? '65%'
            : index % 2 === 1
            ? '85%'
            : width;

        return (
          <SkeletonBox
            key={index}
            width={lineWidth}
            height={lineHeight}
            borderRadius={tokens.radius.xs}
            style={index > 0 ? { marginTop: spacing } : undefined}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: tokens.colors.skeleton.base,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: tokens.colors.skeleton.border,
  },
  shimmerSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '25%',
    right: '25%',
    backgroundColor: tokens.colors.skeleton.highlight,
    borderRadius: tokens.radius.sm,
  },
});

export default SkeletonBox;
