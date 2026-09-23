import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { JoinGroupModal } from '../components/JoinGroupModal';

export const JoinGroupScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'JoinGroup'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [modalVisible, setModalVisible] = useState(true);

  const token = route.params?.token || '';

  const handleClose = () => {
    setModalVisible(false);
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs', { screen: 'HomeTab' });
    }
  };

  const handleSuccess = (groupId: string, groupName: string) => {
    setModalVisible(false);
    navigation.replace('GroupDetail', { groupId, groupName });
  };

  return (
    <View style={styles.container}>
      <JoinGroupModal
        visible={modalVisible}
        token={token}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});

export default JoinGroupScreen;
