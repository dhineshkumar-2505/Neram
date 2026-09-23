import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tokens } from '../design';
import type { MainTabParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../features/notifications';

import HomeScreen from './screens/HomeScreen';
import FriendsScreen from './screens/FriendsScreen';
import CreateScreen from './screens/CreateScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import {
  HomeIcon,
  FriendsIcon,
  CreateIcon,
  ActivityIcon,
  ProfileIcon,
} from './components/TabIcons';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0D111C',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          height: tokens.layout.bottomNavHeight,
          paddingBottom: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: tokens.typography.sizes.caption,
          fontWeight: tokens.typography.weights.medium,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home Command Center Tab',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarAccessibilityLabel: 'Friends Management Tab',
          tabBarIcon: ({ color, size }) => <FriendsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarAccessibilityLabel: 'Create Temporary Group Tab',
          tabBarIcon: ({ color, size }) => <CreateIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarAccessibilityLabel: 'Activity and Notifications Tab',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#818CF8',
            color: '#FFFFFF',
            fontSize: 10,
            lineHeight: 12,
          },
          tabBarIcon: ({ color, size }) => <ActivityIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'User Profile and Settings Tab',
          tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
