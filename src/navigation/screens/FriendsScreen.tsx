import React from 'react';
import type { MainTabScreenProps } from '../types';
import { FriendsScreen as FeatureFriendsScreen } from '../../features/friends/screens/FriendsScreen';

export const FriendsScreen: React.FC<MainTabScreenProps<'FriendsTab'>> = () => {
  return <FeatureFriendsScreen />;
};

export default FriendsScreen;
