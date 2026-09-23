import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './Skeleton';
import { tokens } from '../../design';

export const SkeletonChat: React.FC = () => {
  return (
    <View style={styles.container} testID="skeleton-chat">
      <View style={styles.messagesList}>
        {/* Other Member Message */}
        <View style={styles.otherMessageRow}>
          <SkeletonCircle size={32} style={styles.avatar} />
          <View style={styles.bubbleOther}>
            <SkeletonBox width={80} height={12} borderRadius={tokens.radius.xs} style={styles.senderName} />
            <SkeletonBox width={160} height={16} borderRadius={tokens.radius.xs} />
            <SkeletonBox width={110} height={16} borderRadius={tokens.radius.xs} style={styles.bubbleSecondLine} />
          </View>
        </View>

        {/* Self Message */}
        <View style={styles.selfMessageRow}>
          <View style={styles.bubbleSelf}>
            <SkeletonBox width={200} height={16} borderRadius={tokens.radius.xs} />
            <SkeletonBox width={140} height={16} borderRadius={tokens.radius.xs} style={styles.bubbleSecondLine} />
          </View>
        </View>

        {/* Other Short Message */}
        <View style={styles.otherMessageRow}>
          <SkeletonCircle size={32} style={styles.avatar} />
          <View style={styles.bubbleOtherShort}>
            <SkeletonBox width={70} height={12} borderRadius={tokens.radius.xs} style={styles.senderName} />
            <SkeletonBox width={120} height={16} borderRadius={tokens.radius.xs} />
          </View>
        </View>

        {/* Self Short Message */}
        <View style={styles.selfMessageRow}>
          <View style={styles.bubbleSelfShort}>
            <SkeletonBox width={90} height={16} borderRadius={tokens.radius.xs} />
          </View>
        </View>
      </View>

      {/* Input Bar Placeholder */}
      <View style={styles.inputBar}>
        <SkeletonBox width="82%" height={40} borderRadius={tokens.radius.full} />
        <SkeletonCircle size={40} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  messagesList: {
    flex: 1,
    padding: tokens.spacing.md,
    justifyContent: 'flex-end',
    gap: 16,
  },
  otherMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    marginBottom: 4,
  },
  bubbleOther: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.radius.md,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  bubbleOtherShort: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.radius.md,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '60%',
  },
  selfMessageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bubbleSelf: {
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    borderRadius: tokens.radius.md,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  bubbleSelfShort: {
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    borderRadius: tokens.radius.md,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  senderName: {
    marginBottom: 6,
  },
  bubbleSecondLine: {
    marginTop: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0F172A',
  },
});

export default SkeletonChat;
