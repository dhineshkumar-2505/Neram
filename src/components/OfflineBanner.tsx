import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../design';
import Text from './Text';
import { OfflineIcon, WifiIcon } from './icons/CommonIcons';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Floating, non-intrusive network status banner for Neram.
 * Zero emoji. Uses SVG vector indicators and auto-dismisses on reconnection.
 */
export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isOffline, isRestored } = useNetworkStatus();
  const prefersReducedMotion = useReducedMotion();

  const [visible, setVisible] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOffline) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setShowRestored(false);
      setVisible(true);

      if (prefersReducedMotion) {
        translateY.setValue(0);
        opacity.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (isRestored) {
      setShowRestored(true);
      setVisible(true);

      // Auto-dismiss after 2500ms
      dismissTimerRef.current = setTimeout(() => {
        if (prefersReducedMotion) {
          setVisible(false);
          setShowRestored(false);
        } else {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -60,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setVisible(false);
            setShowRestored(false);
          });
        }
      }, 2500);
    } else {
      setVisible(false);
      setShowRestored(false);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isOffline, isRestored, prefersReducedMotion, translateY, opacity]);

  if (!visible) return null;

  const isRestoredView = showRestored && !isOffline;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        { top: Math.max(insets.top, 12) + 6 },
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      testID="offline-banner"
    >
      <Pressable
        style={[
          styles.pillContainer,
          isRestoredView ? styles.pillRestored : styles.pillOffline,
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          isRestoredView
            ? 'Connection restored. Realtime synchronization active.'
            : 'No internet connection. Realtime synchronization paused.'
        }
      >
        {isRestoredView ? (
          <WifiIcon size={14} color="#34D399" />
        ) : (
          <OfflineIcon size={14} color="#F87171" />
        )}
        <Text
          variant="caption"
          weight="semibold"
          style={[
            styles.bannerText,
            isRestoredView ? styles.textRestored : styles.textOffline,
          ]}
        >
          {isRestoredView
            ? 'Connection Restored'
            : 'No Internet Connection • Realtime paused'}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  pillOffline: {
    backgroundColor: '#1E1616',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  pillRestored: {
    backgroundColor: '#0F231D',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  bannerText: {
    fontSize: 12,
  },
  textOffline: {
    color: '#FCA5A5',
  },
  textRestored: {
    color: '#6EE7B7',
  },
});

export default OfflineBanner;
