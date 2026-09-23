import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/**
 * Bottom Tab Navigator parameter list
 */
export type MainTabParamList = {
  HomeTab: undefined;
  FriendsTab: undefined;
  CreateTab: undefined;
  ActivityTab: undefined;
  ProfileTab: undefined;
};

/**
 * Authentication Native Stack Navigator parameter list
 */
export type AuthStackParamList = {
  Login: undefined;
  Onboarding: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

/**
 * Root Native Stack Navigator parameter list
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  GroupDetail: { groupId: string; groupName?: string };
  Chat: { groupId: string; groupName?: string };
  TaskBoard: { groupId: string; groupName?: string };
  Polls: { groupId: string; groupName?: string };
  Events: { groupId: string; groupName?: string };
  MediaVault: { groupId: string; groupName?: string };
  LocationSession: { groupId: string; groupName?: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
