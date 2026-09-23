import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
}

export const CloseIcon: React.FC<IconProps> = ({ size = 20, color = '#94A3B8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6L18 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 20, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17L4 12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BackIcon: React.FC<IconProps> = ({ size = 20, color = '#F8FAFC' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MoreIcon: React.FC<IconProps> = ({ size = 20, color = '#94A3B8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={5} cy={12} r={2} fill={color} />
    <Circle cx={12} cy={12} r={2} fill={color} />
    <Circle cx={19} cy={12} r={2} fill={color} />
  </Svg>
);

export const OfflineIcon: React.FC<IconProps> = ({ size = 18, color = '#EF4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line
      x1="2"
      y1="2"
      x2="22"
      y2="22"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M8.5 16.5C9.5 15.6 10.7 15 12 15C13.3 15 14.5 15.6 15.5 16.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M5 13C7 11.2 9.4 10 12 10C13 10 14 10.2 15 10.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M2 9.5C4 7.5 7.5 6 12 6C13.5 6 15 6.2 16.3 6.7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx={12} cy={20} r={1.5} fill={color} />
  </Svg>
);

export const WifiIcon: React.FC<IconProps> = ({ size = 18, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12.55C7.03 10.66 9.47 9.5 12 9.5C14.53 9.5 16.97 10.66 19 12.55"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M8.5 16.03C9.5 15.11 10.72 14.5 12 14.5C13.28 14.5 14.5 15.11 15.5 16.03"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M1.42 9C4.42 6.18 8.08 4.5 12 4.5C15.92 4.5 19.58 6.18 22.58 9"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx={12} cy={20} r={1.5} fill={color} />
  </Svg>
);

export const SyncIcon: React.FC<IconProps> = ({ size = 18, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.5 2V8H15.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2.5 22V16H8.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20.49 15A9 9 0 0 1 5.64 19.36L2.5 16M3.51 9A9 9 0 0 1 18.36 4.64L21.5 8"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 20, color = '#94A3B8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={2} />
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const AlertCircleIcon: React.FC<IconProps> = ({ size = 20, color = '#EF4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
    <Line x1={12} y1={8} x2={12} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Circle cx={12} cy={16} r={1} fill={color} />
  </Svg>
);

export const SuccessCircleIcon: React.FC<IconProps> = ({ size = 20, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
    <Path
      d="M8 12L11 15L16 9"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
