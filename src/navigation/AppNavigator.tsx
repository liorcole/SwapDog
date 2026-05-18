import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from './types';
import { useAuthContext } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import ReferralCodeScreen, { REFERRAL_STORAGE_KEY } from '../screens/auth/ReferralCodeScreen';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isOnboarded, loading } = useAuthContext();
  const [referralChecked, setReferralChecked] = useState(false);
  const [hasReferral, setHasReferral] = useState(false);

  useEffect(() => {
    const checkReferral = async () => {
      try {
        const stored = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
        setHasReferral(!!stored);
      } catch {
        setHasReferral(false);
      } finally {
        setReferralChecked(true);
      }
    };
    checkReferral();
  }, []);

  if (loading || !referralChecked) {
    return <LoadingSpinner />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!user ? (
        // Unauthenticated flow: referral gate → auth
        !hasReferral ? (
          <Stack.Screen name="Referral" component={ReferralCodeScreen} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )
      ) : !isOnboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
