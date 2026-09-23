import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Text, Button, Input, Card } from '../../../components';
import { tokens } from '../../../design';
import { useAuth } from '../../../hooks/useAuth';
import { groupService } from '../services/groupService';
import { CircularDurationDial } from '../components/CircularDurationDial';
import { PurposeSelector } from '../components/PurposeSelector';
import { FriendInviteSelector } from '../components/FriendInviteSelector';
import { GroupPurpose, DurationValue } from '../types';
import type { RootStackParamList } from '../../../navigation/types';

export const CreateGroupScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [purpose, setPurpose] = useState<GroupPurpose>('OUTING');
  const [duration, setDuration] = useState<{ months: number; days: number; hours: number }>({
    months: 0,
    days: 0,
    hours: 4,
  });
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId],
    );
  };

  const handleDurationChange = (val: DurationValue) => {
    setDuration({
      months: val.months,
      days: val.days,
      hours: val.hours,
    });
  };

  const handleLaunchSpace = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Space name is required.');
      return;
    }

    if (!user?.id) {
      setErrorMessage('You must be signed in to create a space.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await groupService.createGroup(
      {
        name: trimmedName,
        description: description.trim() || undefined,
        purpose,
        duration,
        initialMemberIds: selectedFriendIds,
      },
      user.id,
    );

    setIsSubmitting(false);

    if (res.error || !res.group) {
      setErrorMessage(res.error || 'Failed to create temporary space.');
      return;
    }

    // Reset fields
    setName('');
    setDescription('');
    setSelectedFriendIds([]);
    setErrorMessage(null);

    // Direct transition to the newly created group interior
    navigation.navigate('GroupDetail', {
      groupId: res.group.id,
      groupName: res.group.name,
    });
  };

  const isFormValid = name.trim().length > 0 && !isSubmitting;

  return (
    <Screen scrollable={false} contentContainerStyle={styles.screenContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header & Ephemeral Mission */}
        <View style={styles.header}>
          <Text variant="title1" weight="bold" style={styles.headerTitle}>
            Create Temporary Space
          </Text>
          <Text variant="caption" style={styles.headerSubtitle}>
            Finite lifespan • Privacy first • Dissolves completely on expiry
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <Card variant="outlined" style={styles.errorCard}>
            <Text variant="footnote" weight="medium" style={styles.errorText}>
              {errorMessage}
            </Text>
          </Card>
        )}

        {/* Section 1: Space Identity */}
        <View style={styles.section}>
          <Text variant="caption" weight="semibold" style={styles.sectionLabel}>
            SPACE IDENTITY
          </Text>

          <Input
            label="SPACE NAME *"
            placeholder="e.g. Weekend Hike, Hackathon Team Alpha..."
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMessage) setErrorMessage(null);
            }}
            maxLength={80}
            editable={!isSubmitting}
            suffix={
              <Text variant="caption" style={styles.charCountText}>
                {name.length}/80
              </Text>
            }
          />

          <Input
            label="DESCRIPTION (OPTIONAL)"
            placeholder="What are we doing? Where are we meeting?"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={3}
            editable={!isSubmitting}
            suffix={
              <Text variant="caption" style={styles.charCountText}>
                {description.length}/500
              </Text>
            }
          />
        </View>

        {/* Section 2: Purpose & Archetype */}
        <PurposeSelector
          selectedPurpose={purpose}
          onSelectPurpose={setPurpose}
          disabled={isSubmitting}
        />

        {/* Section 3: Lifespan & Expiry Dial */}
        <View style={styles.section}>
          <Text variant="caption" weight="semibold" style={styles.sectionLabel}>
            LIFESPAN CONFIGURATION
          </Text>
          <CircularDurationDial
            value={duration}
            onChange={handleDurationChange}
            disabled={isSubmitting}
          />
        </View>

        {/* Section 4: Mutual Friends Invitee Selector */}
        <FriendInviteSelector
          userId={user?.id || ''}
          selectedFriendIds={selectedFriendIds}
          onToggleFriend={handleToggleFriend}
          disabled={isSubmitting}
        />

        {/* Section 5: Launch Primary Action */}
        <View style={styles.actionContainer}>
          <Button
            title={isSubmitting ? 'Initializing Space...' : 'Launch Temporary Space'}
            size="lg"
            variant="primary"
            loading={isSubmitting}
            disabled={!isFormValid}
            onPress={handleLaunchSpace}
            accessibilityLabel="Launch Temporary Space"
          />
          <Text variant="caption" style={styles.actionDisclaimer}>
            Groups cannot be extended past maximum bounds after dissolution.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    backgroundColor: '#0B0F19',
    padding: 0,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  header: {
    marginBottom: tokens.spacing.md,
  },
  headerTitle: {
    color: '#F8FAFC',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#64748B',
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
  },
  section: {
    marginBottom: tokens.spacing.md,
  },
  sectionLabel: {
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  charCountText: {
    color: '#64748B',
    fontSize: 10,
  },
  actionContainer: {
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
  },
  actionDisclaimer: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    lineHeight: 16,
  },
});

export default CreateGroupScreen;
