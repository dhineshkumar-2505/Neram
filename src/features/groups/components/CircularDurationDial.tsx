import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Path, Line, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  DurationUnit,
  DurationValue,
  DURATION_LIMITS,
  DURATION_PRESETS,
  DurationPreset,
  clampDurationUnit,
  calculateExpiryDate,
  formatDurationHuman,
  durationToTotalHours,
} from '../types';

export interface CircularDurationDialProps {
  value?: { months: number; days: number; hours: number };
  onChange?: (duration: DurationValue) => void;
  startsAt?: Date;
  disabled?: boolean;
}

const DIAL_SIZE = 260;
const RADIUS = 96;
const STROKE_WIDTH = 8;
const CENTER = DIAL_SIZE / 2;

/**
 * Signature Circular Duration Dial for Neram.
 * Satisfies UI_PLAN.md Section 5:
 * - Angular trigonometric tracking (atan2) with discrete snap settling
 * - Three synchronized units: Hours (0-24), Days (0-31), Months (0-12)
 * - Tactile haptics on step crossing and release
 * - Accessible steppers (+ / -) and quick preset archetypes
 * - Live expiration timestamp preview
 */
export const CircularDurationDial: React.FC<CircularDurationDialProps> = ({
  value = { months: 0, days: 0, hours: 4 },
  onChange,
  startsAt = new Date(),
  disabled = false,
}) => {
  const [activeUnit, setActiveUnit] = useState<DurationUnit>('hours');
  const [months, setMonths] = useState<number>(value.months);
  const [days, setDays] = useState<number>(value.days);
  const [hours, setHours] = useState<number>(value.hours);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const lastHapticValueRef = useRef<number>(-1);

  // Sync internal state if prop changes from outside
  useEffect(() => {
    setMonths(value.months);
    setDays(value.days);
    setHours(value.hours);
  }, [value.months, value.days, value.hours]);

  const currentUnitValue = useMemo(() => {
    switch (activeUnit) {
      case 'hours':
        return hours;
      case 'days':
        return days;
      case 'months':
        return months;
    }
  }, [activeUnit, hours, days, months]);

  const maxForActiveUnit = useMemo(() => DURATION_LIMITS[activeUnit].max, [activeUnit]);

  const triggerHapticTick = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // Graceful fallback for environments without haptics
    }
  }, []);

  const triggerHapticConfirm = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      // Graceful fallback
    }
  }, []);

  const emitChange = useCallback(
    (m: number, d: number, h: number) => {
      // Ensure at least 1 hour total if all zeros
      let effectiveHours = h;
      if (m === 0 && d === 0 && h === 0) {
        effectiveHours = 1;
        setHours(1);
      }

      if (onChange) {
        onChange({
          months: m,
          days: d,
          hours: effectiveHours,
          totalHours: durationToTotalHours({ months: m, days: d, hours: effectiveHours }),
        });
      }
    },
    [onChange],
  );

  const updateActiveUnitValue = useCallback(
    (newVal: number) => {
      const clamped = clampDurationUnit(activeUnit, newVal);
      if (clamped === currentUnitValue) return;

      if (clamped !== lastHapticValueRef.current) {
        triggerHapticTick();
        lastHapticValueRef.current = clamped;
      }

      switch (activeUnit) {
        case 'hours':
          setHours(clamped);
          emitChange(months, days, clamped);
          break;
        case 'days':
          setDays(clamped);
          emitChange(months, clamped, hours);
          break;
        case 'months':
          setMonths(clamped);
          emitChange(clamped, days, hours);
          break;
      }
    },
    [activeUnit, currentUnitValue, emitChange, hours, days, months, triggerHapticTick],
  );

  // Angular gesture tracking using atan2
  const handleTouchAt = useCallback(
    (locationX: number, locationY: number) => {
      if (disabled) return;

      const dx = locationX - CENTER;
      const dy = locationY - CENTER;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Discard touches too close to center to prevent wild angle spinning
      if (distance < 24) return;

      // Calculate angle from 12 o'clock clockwise in degrees (0 to 360)
      const rad = Math.atan2(dy, dx);
      let deg = (rad * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      const fraction = deg / 360;
      const targetVal = Math.round(fraction * maxForActiveUnit);
      updateActiveUnitValue(targetVal);
    },
    [disabled, maxForActiveUnit, updateActiveUnitValue],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          setIsInteracting(true);
          const { locationX, locationY } = evt.nativeEvent;
          handleTouchAt(locationX, locationY);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          handleTouchAt(locationX, locationY);
        },
        onPanResponderRelease: () => {
          setIsInteracting(false);
          triggerHapticConfirm();
          lastHapticValueRef.current = -1;
        },
        onPanResponderTerminate: () => {
          setIsInteracting(false);
          lastHapticValueRef.current = -1;
        },
      }),
    [disabled, handleTouchAt, triggerHapticConfirm],
  );

  const handleStepIncrement = () => {
    if (disabled) return;
    updateActiveUnitValue(currentUnitValue + 1);
    triggerHapticConfirm();
  };

  const handleStepDecrement = () => {
    if (disabled) return;
    updateActiveUnitValue(currentUnitValue - 1);
    triggerHapticConfirm();
  };

  const handleSelectPreset = (preset: DurationPreset) => {
    if (disabled) return;
    setMonths(preset.duration.months);
    setDays(preset.duration.days);
    setHours(preset.duration.hours);
    emitChange(preset.duration.months, preset.duration.days, preset.duration.hours);
    triggerHapticConfirm();
  };

  // Convert current value to angle for SVG rendering
  const angleDeg = useMemo(() => {
    if (maxForActiveUnit === 0) return 0;
    return (currentUnitValue / maxForActiveUnit) * 360;
  }, [currentUnitValue, maxForActiveUnit]);

  const angleRad = useMemo(() => ((angleDeg - 90) * Math.PI) / 180, [angleDeg]);

  // Thumb knob coordinates
  const knobX = useMemo(() => CENTER + RADIUS * Math.cos(angleRad), [angleRad]);
  const knobY = useMemo(() => CENTER + RADIUS * Math.sin(angleRad), [angleRad]);

  // Active SVG Arc Path
  const arcPath = useMemo(() => {
    if (angleDeg <= 0) return '';
    if (angleDeg >= 359.9) {
      // Full circle sweep
      return `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS}`;
    }

    const largeArc = angleDeg > 180 ? 1 : 0;
    return `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${knobX} ${knobY}`;
  }, [angleDeg, knobX, knobY]);

  // Graduation tick marks
  const tickMarks = useMemo(() => {
    const ticks: Array<{ x1: number; y1: number; x2: number; y2: number; isMajor: boolean; key: number }> = [];
    const count = activeUnit === 'hours' ? 24 : activeUnit === 'days' ? 31 : 12;

    for (let i = 0; i < count; i++) {
      const tickAngle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const isMajor = i % (activeUnit === 'hours' ? 6 : activeUnit === 'days' ? 7 : 3) === 0;
      const length = isMajor ? 10 : 5;

      const x1 = CENTER + (RADIUS + 14) * Math.cos(tickAngle);
      const y1 = CENTER + (RADIUS + 14) * Math.sin(tickAngle);
      const x2 = CENTER + (RADIUS + 14 - length) * Math.cos(tickAngle);
      const y2 = CENTER + (RADIUS + 14 - length) * Math.sin(tickAngle);

      ticks.push({ x1, y1, x2, y2, isMajor, key: i });
    }
    return ticks;
  }, [activeUnit]);

  // Calculated expiration timestamp
  const expiryDate = useMemo(() => {
    return calculateExpiryDate(startsAt, { months, days, hours });
  }, [startsAt, months, days, hours]);

  const formattedExpiry = useMemo(() => {
    return expiryDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [expiryDate]);

  return (
    <View style={styles.container}>
      {/* Unit Segment Switcher */}
      <View style={styles.segmentContainer}>
        {(['hours', 'days', 'months'] as DurationUnit[]).map((unit) => {
          const val = unit === 'hours' ? hours : unit === 'days' ? days : months;
          const isSelected = activeUnit === unit;

          return (
            <Pressable
              key={unit}
              onPress={() => {
                setActiveUnit(unit);
                triggerHapticTick();
              }}
              accessibilityRole="tab"
              accessibilityLabel={`Configure ${unit}`}
              accessibilityState={{ selected: isSelected }}
              style={[styles.segmentTab, isSelected && styles.segmentTabActive]}
            >
              <Text
                weight={isSelected ? 'bold' : 'medium'}
                style={[styles.segmentUnitText, isSelected && styles.segmentUnitTextActive]}
              >
                {unit.toUpperCase()}
              </Text>
              <Text
                weight={isSelected ? 'bold' : 'regular'}
                style={[styles.segmentValueText, isSelected && styles.segmentValueTextActive]}
              >
                {val}
                {unit[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Main Interactive Dial */}
      <View
        style={styles.dialWrapper}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Duration Dial: ${currentUnitValue} ${activeUnit}`}
        accessibilityValue={{ min: 0, max: maxForActiveUnit, now: currentUnitValue }}
      >
        <Svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
          {/* Subtle Outer Boundary Ring */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS + 16}
            stroke={isInteracting ? 'rgba(129, 140, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)'}
            strokeWidth={1}
            fill="none"
          />

          {/* Graduation Ticks */}
          <G>
            {tickMarks.map((tick) => (
              <Line
                key={tick.key}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={tick.isMajor ? '#818CF8' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth={tick.isMajor ? 2 : 1}
                strokeLinecap="round"
              />
            ))}
          </G>

          {/* Background Track Ring */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="#161F30"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />

          {/* Active Colored Arc Sweep */}
          {arcPath ? (
            <Path
              d={arcPath}
              stroke="#4F46E5"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}

          {/* Glow Knob Thumb */}
          {angleDeg > 0 ? (
            <G>
              <Circle
                cx={knobX}
                cy={knobY}
                r={16}
                fill="rgba(79, 70, 229, 0.25)"
              />
              <Circle
                cx={knobX}
                cy={knobY}
                r={10}
                fill="#818CF8"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <Circle
                cx={knobX}
                cy={knobY}
                r={3}
                fill="#2DD4BF"
              />
            </G>
          ) : (
            /* Idle knob marker at 12 o'clock */
            <Circle
              cx={CENTER}
              cy={CENTER - RADIUS}
              r={6}
              fill="#64748B"
              stroke="#111827"
              strokeWidth={2}
            />
          )}
        </Svg>

        {/* Center Digital Display & Stepper Controls */}
        <View style={styles.centerContainer} pointerEvents="box-none">
          <Text variant="caption" style={styles.centerSubLabel}>
            ADJUSTING
          </Text>
          <Text variant="display" weight="bold" style={styles.centerValueText}>
            {currentUnitValue}
          </Text>
          <Text variant="footnote" weight="semibold" style={styles.centerUnitText}>
            {activeUnit.toUpperCase()}
          </Text>

          {/* Micro Accessible Steppers */}
          <View style={styles.stepperRow}>
            <Pressable
              onPress={handleStepDecrement}
              disabled={disabled || currentUnitValue <= 0}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${activeUnit}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.stepperButton,
                pressed && styles.stepperButtonPressed,
                currentUnitValue <= 0 && styles.stepperButtonDisabled,
              ]}
            >
              <Text weight="bold" style={styles.stepperIconText}>
                −
              </Text>
            </Pressable>

            <View style={styles.stepperDivider} />

            <Pressable
              onPress={handleStepIncrement}
              disabled={disabled || currentUnitValue >= maxForActiveUnit}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${activeUnit}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.stepperButton,
                pressed && styles.stepperButtonPressed,
                currentUnitValue >= maxForActiveUnit && styles.stepperButtonDisabled,
              ]}
            >
              <Text weight="bold" style={styles.stepperIconText}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Quick Duration Presets Rail */}
      <View style={styles.presetsSection}>
        <Text variant="caption" style={styles.presetsLabel}>
          QUICK ARCHETYPES
        </Text>
        <View style={styles.presetsRow}>
          {DURATION_PRESETS.map((preset) => {
            const isMatch =
              months === preset.duration.months &&
              days === preset.duration.days &&
              hours === preset.duration.hours;

            return (
              <Pressable
                key={preset.id}
                onPress={() => handleSelectPreset(preset)}
                accessibilityRole="button"
                accessibilityLabel={`Set duration to ${preset.label} for ${preset.archetype}`}
                style={[styles.presetChip, isMatch && styles.presetChipActive]}
              >
                <Text
                  variant="caption"
                  weight={isMatch ? 'bold' : 'medium'}
                  style={[styles.presetChipText, isMatch && styles.presetChipTextActive]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Calculated Expiration Card */}
      <View style={styles.expiryCard}>
        <View style={styles.expiryHeader}>
          <View style={styles.expiryPulseDot} />
          <Text variant="caption" weight="semibold" style={styles.expiryHeaderTitle}>
            TOTAL LIFESPAN: {formatDurationHuman({ months, days, hours }).toUpperCase()}
          </Text>
        </View>
        <Text variant="title3" weight="semibold" style={styles.expiryDateText}>
          Dissolves {formattedExpiry}
        </Text>
        <Text variant="caption" style={styles.expirySubNote}>
          Server-enforced closure • Automatic data dissolve on expiry
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: tokens.spacing.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: tokens.spacing.xxs,
    marginBottom: tokens.spacing.md,
    width: '100%',
    maxWidth: 320,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
  },
  segmentTabActive: {
    backgroundColor: '#1E293B',
  },
  segmentUnitText: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  segmentUnitTextActive: {
    color: '#818CF8',
  },
  segmentValueText: {
    fontSize: tokens.typography.sizes.body,
    color: '#94A3B8',
  },
  segmentValueTextActive: {
    color: '#F8FAFC',
  },
  dialWrapper: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.xs,
  },
  centerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  centerSubLabel: {
    fontSize: 9,
    color: '#64748B',
    letterSpacing: 1,
  },
  centerValueText: {
    fontSize: 44,
    lineHeight: 48,
    color: '#F8FAFC',
    marginVertical: 0,
  },
  centerUnitText: {
    color: '#818CF8',
    letterSpacing: 1,
    marginBottom: tokens.spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: tokens.spacing.xs,
  },
  stepperButton: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    opacity: 0.6,
  },
  stepperButtonDisabled: {
    opacity: 0.25,
  },
  stepperIconText: {
    color: '#F8FAFC',
    fontSize: 16,
    lineHeight: 18,
  },
  stepperDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  presetsSection: {
    width: '100%',
    marginVertical: tokens.spacing.md,
  },
  presetsLabel: {
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  presetChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: '#111827',
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderColor: '#818CF8',
  },
  presetChipText: {
    color: '#94A3B8',
  },
  presetChipTextActive: {
    color: '#F8FAFC',
  },
  expiryCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  expiryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xxs,
  },
  expiryPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2DD4BF',
  },
  expiryHeaderTitle: {
    color: '#2DD4BF',
    letterSpacing: 0.8,
  },
  expiryDateText: {
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xxs,
  },
  expirySubNote: {
    color: '#64748B',
  },
});

export default CircularDurationDial;
