import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

interface TimeGlyphProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Bespoke temporal emblem representing Neram ("Time" in Tamil).
 * An analog-inspired circular dial with concentric rings and cardinal ticks,
 * symbolizing finite, conscious presence and the dissolution of digital noise.
 */
export const TimeGlyph: React.FC<TimeGlyphProps> = ({
  size = 72,
  color = '#4F46E5',
  accentColor = '#14B8A6',
}) => {
  const center = size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = size * 0.30;
  const coreRadius = size * 0.09;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer subtle ring */}
        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.4"
          fill="none"
        />

        {/* Inner concentric ring */}
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.8"
          strokeDasharray="3 3"
          fill="none"
        />

        {/* Cardinal tick markers representing the 4 quarters of an ephemeral cycle */}
        {/* 12 o'clock */}
        <Line
          x1={center}
          y1={center - outerRadius - 2}
          x2={center}
          y2={center - outerRadius + 4}
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* 3 o'clock */}
        <Line
          x1={center + outerRadius - 4}
          y1={center}
          x2={center + outerRadius + 2}
          y2={center}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
        {/* 6 o'clock */}
        <Line
          x1={center}
          y1={center + outerRadius - 4}
          x2={center}
          y2={center + outerRadius + 2}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
        {/* 9 o'clock */}
        <Line
          x1={center - outerRadius - 2}
          y1={center}
          x2={center - outerRadius + 4}
          y2={center}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />

        {/* Finite time indicator hand pointing forward */}
        <Line
          x1={center}
          y1={center}
          x2={center + innerRadius * 0.7}
          y2={center - innerRadius * 0.7}
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Core pivot */}
        <Circle cx={center} cy={center} r={coreRadius} fill={color} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TimeGlyph;
