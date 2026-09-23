import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../../design';
import { haptics } from '../../../utils/haptics';
import { MicIcon, CloseIcon, CheckIcon } from './ChatIcons';
import { audioRecordingService } from '../services/audioRecordingService';

export interface VoiceRecordButtonProps {
  onAudioRecorded: (uri: string, durationMillis: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
}

export const VoiceRecordButton: React.FC<VoiceRecordButtonProps> = ({
  onAudioRecorded,
  onRecordingStateChange,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [durationMillis, setDurationMillis] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Pulsing animation for active recording
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseLoop) {
        pulseLoop.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  const handleStart = async () => {
    if (disabled || isProcessing) return;

    haptics.selection();
    const success = await audioRecordingService.startRecording(
      (millis) => {
        setDurationMillis(millis);
      },
      () => {
        // Max limit (120s) reached -> auto-commit
        handleStopAndSend();
      },
    );

    if (success) {
      setIsRecording(true);
      setDurationMillis(0);
      haptics.tick();
    } else {
      haptics.error();
    }
  };

  const handleStopAndSend = useCallback(async () => {
    if (!isRecording || isProcessing) return;

    setIsProcessing(true);
    haptics.selection();

    const result = await audioRecordingService.stopRecording();
    setIsRecording(false);
    setIsProcessing(false);

    if (result && result.uri) {
      haptics.success();
      onAudioRecorded(result.uri, result.durationMillis);
    } else {
      haptics.warning();
    }
  }, [isRecording, isProcessing, onAudioRecorded]);

  const handleCancel = async () => {
    if (!isRecording) return;

    haptics.warning();
    await audioRecordingService.cancelRecording();
    setIsRecording(false);
    setDurationMillis(0);
    setIsProcessing(false);
  };

  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="small" color="#00FF9D" />
      </View>
    );
  }

  // Active recording UI overlay bar
  if (isRecording) {
    const formattedTime = audioRecordingService.formatDuration(durationMillis);

    return (
      <View style={styles.recordingBar}>
        {/* Cancel Discard Button */}
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelButton}
          accessibilityRole="button"
          accessibilityLabel="Cancel voice recording"
        >
          <CloseIcon size={16} color="#94A3B8" />
        </TouchableOpacity>

        {/* Live Pulse Indicator & Timer */}
        <View style={styles.recordingInfo}>
          <Animated.View
            style={[
              styles.recordingDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={styles.recordingTimer}>{formattedTime}</Text>
          <Text style={styles.limitLabel}>/ 2:00</Text>
        </View>

        {/* Send / Commit Button */}
        <TouchableOpacity
          onPress={handleStopAndSend}
          style={styles.confirmSendButton}
          accessibilityRole="button"
          accessibilityLabel="Send voice note"
        >
          <CheckIcon size={16} color="#0B0F19" />
        </TouchableOpacity>
      </View>
    );
  }

  // Idle Mic Button
  return (
    <TouchableOpacity
      onPress={handleStart}
      disabled={disabled}
      style={[styles.micButton, disabled && styles.micButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel="Record voice message"
    >
      <MicIcon size={20} color={disabled ? '#64748B' : '#00FF9D'} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 157, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  processingContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161F30',
    borderRadius: 20,
    paddingHorizontal: tokens.spacing.sm,
    height: 44,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimer: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
    fontVariant: ['tabular-nums'],
  },
  limitLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  confirmSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00FF9D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceRecordButton;
