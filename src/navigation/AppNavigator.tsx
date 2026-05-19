import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from './types';
import { useAuthContext } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import ApprovalNavigator from './ApprovalNavigator';
import MainTabNavigator from './MainTabNavigator';
import ReferralCodeScreen, { REFERRAL_STORAGE_KEY } from '../screens/auth/ReferralCodeScreen';
import ConductStandardsScreen from '../screens/onboarding/ConductStandardsScreen';
import VettingCallScreen from '../screens/onboarding/VettingCallScreen';
import WaitingApprovalScreen from '../screens/onboarding/WaitingApprovalScreen';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { sendWelcomeMessageIfNeeded } from '../hooks/useMessaging';

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

  // Send welcome message for any active+signed user who didn't receive it
  // at contract-signing time (e.g. users who signed before this feature shipped).
  useEffect(() => {
    if (!user || !userProfile) return;
    const isActiveAndSigned =
      userProfile.accountStatus === 'active' && !!userProfile.contractSignedAt;
    if (!isActiveAndSigned) return;

    sendWelcomeMessageIfNeeded(user.uid).catch((err) =>
      console.warn('[AppNavigator] sendWelcomeMessageIfNeeded failed:', err)
    );
  }, [user?.uid, userProfile?.accountStatus, userProfile?.contractSignedAt]);

  if (loading || !referralChecked) {
    return <LoadingSpinner />;
  }

  const accountStatus = userProfile?.accountStatus ?? 'pending_referral';
  const conductAgreed = !!userProfile?.conductAgreedAt;
  const contractSigned = !!userProfile?.contractSignedAt;

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
        // ── Vetting scheduled, awaiting admin review ───────────────────────
        <Stack.Screen name="WaitingApproval" component={WaitingApprovalScreen} />
      ) : accountStatus === 'active' && !contractSigned ? (
        // ── Approved! Show celebration → contract signing ──────────────────
        <Stack.Screen name="ApprovalFlow" component={ApprovalNavigator} />
      ) : (
        // ── Active + contract signed → full app access ─────────────────────
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
