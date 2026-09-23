import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../../design';
import { PlayIcon, PauseIcon } from './ChatIcons';
import { audioRecordingService, PlaybackState } from '../services/audioRecordingService';
import { haptics } from '../../../utils/haptics';

export interface VoiceMessagePlayerProps {
  messageId: string;
  storagePath?: string;
  localUri?: string;
  durationLabel?: string;
  isCurrentUser?: boolean;
}

// Pseudo-random but deterministic waveform bar heights based on messageId
function generateWaveformBars(seed: string, count = 22): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudo = Math.abs(Math.sin(hash + i * 9.7)) * 0.75 + 0.25;
    heights.push(Math.round(pseudo * 20) + 4);
  }
  return heights;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  messageId,
  storagePath,
  localUri,
  durationLabel,
  isCurrentUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [positionMillis, setPositionMillis] = useState<number>(0);
  const [totalDurationMillis, setTotalDurationMillis] = useState<number>(0);

  const waveformBars = useMemo(() => generateWaveformBars(messageId), [messageId]);

  // Sync with global playback state
  useEffect(() => {
    const activeId = audioRecordingService.getActiveAudioId();
    if (activeId !== messageId) {
      setIsPlaying(false);
      setPositionMillis(0);
    }
  }, [messageId]);

  const handlePlaybackUpdate = useCallback(
    (state: PlaybackState) => {
      if (state.activeId === messageId) {
        setIsPlaying(state.isPlaying);
        setPositionMillis(state.positionMillis);
        if (state.durationMillis > 0) {
          setTotalDurationMillis(state.durationMillis);
        }
      } else {
        setIsPlaying(false);
        setPositionMillis(0);
      }
    },
    [messageId],
  );

  const handleTogglePlay = async () => {
    haptics.selection();

    if (isPlaying) {
      await audioRecordingService.pauseAudio();
      setIsPlaying(false);
      return;
    }

    setLoading(true);

    let targetUri = localUri;
    if (!targetUri && storagePath) {
      targetUri = (await audioRecordingService.getAudioUrl(storagePath)) || undefined;
    }

    if (!targetUri) {
      setLoading(false);
      haptics.error();
      return;
    }

    const success = await audioRecordingService.playAudio(
      messageId,
      targetUri,
      handlePlaybackUpdate,
    );

    setLoading(false);
    if (success) {
      setIsPlaying(true);
    } else {
      haptics.error();
    }
  };

  const progressFraction =
    totalDurationMillis > 0
      ? Math.min(positionMillis / totalDurationMillis, 1)
      : isPlaying
      ? 0.5
      : 0;

  const currentDisplayTime = isPlaying
    ? audioRecordingService.formatDuration(positionMillis)
    : durationLabel || (totalDurationMillis > 0 ? audioRecordingService.formatDuration(totalDurationMillis) : '0:00');

  const activeAccentColor = isCurrentUser ? '#00FF9D' : '#818CF8';
  const inactiveBarColor = isCurrentUser ? 'rgba(0, 255, 157, 0.25)' : 'rgba(255, 255, 255, 0.2)';

  return (
    <View style={styles.container}>
      {/* Play / Pause Action Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          { backgroundColor: isCurrentUser ? 'rgba(0, 255, 157, 0.2)' : 'rgba(129, 140, 248, 0.2)' },
        ]}
        onPress={handleTogglePlay}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {loading ? (
          <ActivityIndicator size="small" color={activeAccentColor} />
        ) : isPlaying ? (
          <PauseIcon size={16} color={activeAccentColor} />
        ) : (
          <PlayIcon size={16} color={activeAccentColor} />
        )}
      </TouchableOpacity>

      {/* Waveform & Time Info */}
      <View style={styles.waveformContainer}>
        <View style={styles.barsRow}>
          {waveformBars.map((height, idx) => {
            const barFraction = idx / waveformBars.length;
            const isPlayed = barFraction <= progressFraction;

            return (
              <View
                key={idx}
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: isPlayed ? activeAccentColor : inactiveBarColor,
                  },
                ]}
              />
            );
          })}
        </View>

        <Text
          style={[
            styles.timeText,
            { color: isCurrentUser ? 'rgba(0, 255, 157, 0.9)' : '#94A3B8' },
          ]}
        >
          {currentDisplayTime}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: 4,
    minWidth: 190,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  timeText: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: tokens.typography.fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
});

export default VoiceMessagePlayer;
