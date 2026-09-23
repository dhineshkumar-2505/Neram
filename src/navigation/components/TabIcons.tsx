import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export interface TabIconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

/**
 * Cohesive 24pt custom vector icon family for Neram Bottom Navigation.
 * Adheres strictly to DEVELOPMENT_RULES.md & UI_PLAN.md:
 * - 24pt optical size
 * - Uniform 2pt stroke weight
 * - Rounded line caps and joins
 * - Zero emojis
 */

export const HomeIcon: React.FC<TabIconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FriendsIcon: React.FC<TabIconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path
      d="M2 20C2 16.6863 5.13401 14 9 14C12.866 14 16 16.6863 16 20"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M16 3.13C17.2 3.86 18 5.2 18 6.7C18 8.2 17.2 9.54 16 10.27"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M19 14.5C20.8 15.6 22 17.2 22 19"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const CreateIcon: React.FC<TabIconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
    <Path
      d="M12 8V16M8 12H16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ActivityIcon: React.FC<TabIconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.73 21A2 2 0 0 1 10.27 21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ProfileIcon: React.FC<TabIconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="5" stroke={color} strokeWidth={2} />
    <Path
      d="M3 21C3 16.5817 7.02944 13 12 13C16.9706 13 21 16.5817 21 21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);
