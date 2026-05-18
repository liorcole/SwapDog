import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApprovalStackParamList } from './types';
import CelebrationScreen from '../screens/onboarding/CelebrationScreen';
import ContractScreen from '../screens/onboarding/ContractScreen';

const Stack = createNativeStackNavigator<ApprovalStackParamList>();

const ApprovalNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Celebration" component={CelebrationScreen} />
    <Stack.Screen name="Contract">
      {() => <ContractScreen />}
    </Stack.Screen>
  </Stack.Navigator>
);

export default ApprovalNavigator;
