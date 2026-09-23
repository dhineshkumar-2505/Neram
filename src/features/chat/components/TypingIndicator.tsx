import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';

export interface TypingIndicatorProps {
  typingLabel: string;
  accentColor?: string;
}

/**
 * Animated 3-dot pulse typing indicator with WhatsApp-style multi-user label.
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingLabel,
  accentColor = '#818CF8',
}) => {
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!typingLabel) return;

    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 350,
              useNativeDriver: true,
            }),
          ]),
        ),
      ]);

    const pulse1 = createPulse(dot1Anim, 0);
    const pulse2 = createPulse(dot2Anim, 180);
    const pulse3 = createPulse(dot3Anim, 360);

    pulse1.start();
    pulse2.start();
    pulse3.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
      dot1Anim.setValue(0.3);
      dot2Anim.setValue(0.3);
      dot3Anim.setValue(0.3);
    };
  }, [typingLabel, dot1Anim, dot2Anim, dot3Anim]);

  if (!typingLabel) {
    return null;
  }

  return (
    <View
      style={styles.container}
      testID="typing-indicator"
      accessibilityRole="text"
      accessibilityLabel={typingLabel}
    >
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[styles.dot, { backgroundColor: accentColor, opacity: dot1Anim }]}
        />
        <Animated.View
          style={[styles.dot, { backgroundColor: accentColor, opacity: dot2Anim }]}
        />
        <Animated.View
          style={[styles.dot, { backgroundColor: accentColor, opacity: dot3Anim }]}
        />
      </View>

      <Text variant="caption" weight="medium" style={styles.label} numberOfLines={1}>
        {typingLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    backgroundColor: '#0D111C',
    gap: tokens.spacing.xs,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    color: '#818CF8',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
