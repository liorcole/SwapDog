import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from './types';
import { useAuthContext } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import ReferralCodeScreen, { REFERRAL_STORAGE_KEY } from '../screens/auth/ReferralCodeScreen';
import ConductStandardsScreen from '../screens/onboarding/ConductStandardsScreen';
import VettingCallScreen from '../screens/onboarding/VettingCallScreen';
import WaitingApprovalScreen from '../screens/onboarding/WaitingApprovalScreen';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isOnboarded, userProfile, loading } = useAuthContext();
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

  const accountStatus = userProfile?.accountStatus ?? 'pending_referral';
  const conductAgreed = !!userProfile?.conductAgreedAt;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!user ? (
        // ── Unauthenticated: referral gate → auth ──────────────────────────
        !hasReferral ? (
          <Stack.Screen name="Referral" component={ReferralCodeScreen} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )
      ) : !isOnboarded ? (
        // ── Authenticated, onboarding not complete ─────────────────────────
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : !conductAgreed ? (
        // ── Onboarded but conduct not yet agreed ───────────────────────────
        <Stack.Screen name="ConductStandards">
          {() => <ConductStandardsScreen />}
        </Stack.Screen>
      ) : accountStatus === 'pending_vetting' ? (
        // ── Conduct agreed, vetting call not yet scheduled ─────────────────
        <Stack.Screen name="VettingCall" component={VettingCallScreen} />
      ) : accountStatus === 'pending_approval' ? (
        // ── Vetting scheduled, awaiting review ────────────────────────────
        <Stack.Screen name="WaitingApproval" component={WaitingApprovalScreen} />
      ) : (
        // ── Active (and future: contract gate in Wave 3) ───────────────────
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
