import React from 'react';
import { View, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import { TimeGlyph } from '../components/TimeGlyph';
import Text from '../../../components/Text';

export const AuthLoadingScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <View style={styles.centerContent}>
        <View style={styles.glyphWrapper}>
          <TimeGlyph size={68} color="#818CF8" accentColor="#2DD4BF" />
        </View>
        <Text style={styles.brandTitle}>Nēram</Text>
        <Text style={styles.brandSubtitle}>Ephemeral circles. Real moments.</Text>

        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#818CF8" />
          <Text style={styles.loadingText}>Restoring session...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  glyphWrapper: {
    marginBottom: tokens.spacing.md,
  },
  brandTitle: {
    fontSize: tokens.typography.sizes.title1,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#818CF8',
    marginBottom: tokens.spacing.xl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
  },
  loadingText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
    marginLeft: tokens.spacing.sm,
  },
});

export default AuthLoadingScreen;
