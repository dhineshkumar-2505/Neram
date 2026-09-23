import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { tokens } from '../design';

export interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  edges?: Edge[];
  backgroundColor?: string;
  statusBarStyle?: 'light-content' | 'dark-content';
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  edges = ['top', 'left', 'right'],
  backgroundColor = tokens.colors.background,
  statusBarStyle = 'light-content',
}) => {
  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor }, style]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});

export default Screen;
