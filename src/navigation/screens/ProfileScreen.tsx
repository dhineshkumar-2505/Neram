import React from 'react';
import type { MainTabScreenProps } from '../types';
import { ProfileScreen as FeatureProfileScreen } from '../../features/profile/screens/ProfileScreen';

export const ProfileScreen: React.FC<MainTabScreenProps<'ProfileTab'>> = () => {
  return <FeatureProfileScreen />;
};

export default ProfileScreen;
