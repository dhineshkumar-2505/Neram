import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export interface IconProps {
  color?: string;
  size?: number;
}

/**
 * Clean directional dispatch arrow icon.
 */
export const SendIcon: React.FC<IconProps> = ({ color = '#FFFFFF', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 2L11 13"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M22 2L15 22L11 13L2 9L22 2Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Return arrow icon for threaded replies.
 */
export const ReplyIcon: React.FC<IconProps> = ({ color = '#818CF8', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 14L4 9L9 4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20 20V13C20 11.9391 19.5786 10.9217 18.8284 10.1716C18.0783 9.42143 17.0609 9 16 9H4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Dismiss cross icon for reply chips.
 */
export const CloseIcon: React.FC<IconProps> = ({ color = '#94A3B8', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6 6L18 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Single checkmark icon for sent messages.
 */
export const CheckIcon: React.FC<IconProps> = ({ color = 'rgba(255, 255, 255, 0.7)', size = 14 }) => (
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

/**
 * Clock indicator icon for pending messages.
 */
export const ClockIcon: React.FC<IconProps> = ({ color = 'rgba(255, 255, 255, 0.5)', size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
    <Path d="M12 6V12L16 14" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

/**
 * Lock icon for expired / read-only space banner.
 */
export const LockIcon: React.FC<IconProps> = ({ color = '#F59E0B', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="3"
      y="11"
      width="18"
      height="11"
      rx="2"
      ry="2"
      stroke={color}
      strokeWidth={2}
    />
    <Path
      d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Soft delete trash icon for message author.
 */
export const TrashIcon: React.FC<IconProps> = ({ color = '#EF4444', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6H5H21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Microphone icon for voice note recording.
 */
export const MicIcon: React.FC<IconProps> = ({ color = '#00FF9D', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="2" width="6" height="12" rx="3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 10V11C5 14.866 8.134 18 12 18C15.866 18 19 14.866 19 11V10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 18V22M8 22H16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Audio playback play icon.
 */
export const PlayIcon: React.FC<IconProps> = ({ color = '#F8FAFC', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4L19 12L6 20V4Z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
);

/**
 * Audio playback pause icon.
 */
export const PauseIcon: React.FC<IconProps> = ({ color = '#F8FAFC', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="6" y="4" width="4" height="16" rx="1" fill={color} />
    <Rect x="14" y="4" width="4" height="16" rx="1" fill={color} />
  </Svg>
);

/**
 * Audio playback stop icon.
 */
export const StopIcon: React.FC<IconProps> = ({ color = '#EF4444', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="5" width="14" height="14" rx="2" fill={color} stroke={color} strokeWidth={2} />
  </Svg>
);

