import React from 'react';
import { CreateGroupScreen } from '../../features/groups';
import type { MainTabScreenProps } from '../types';

export const CreateScreen: React.FC<MainTabScreenProps<'CreateTab'>> = () => {
  return <CreateGroupScreen />;
};

export default CreateScreen;
