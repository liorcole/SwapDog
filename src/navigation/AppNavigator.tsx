import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuthContext } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import ApprovalNavigator from './ApprovalNavigator';
import MainTabNavigator from './MainTabNavigator';
import ConductStandardsScreen from '../screens/onboarding/ConductStandardsScreen';
import WaitingApprovalScreen from '../screens/onboarding/WaitingApprovalScreen';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { requestNotificationPermissions } from '../services/ReminderService';
import { sendWelcomeMessageIfNeeded } from '../hooks/useMessaging';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isOnboarded, userProfile, loading } = useAuthContext();

  // Request notification permissions when an active user lands in the app
  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.accountStatus !== 'active') return;
    requestNotificationPermissions().catch((e) =>
      console.warn('[AppNavigator] requestNotificationPermissions failed:', e)
    );
  }, [user?.uid, userProfile?.accountStatus]);

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

  if (loading) {
    return <LoadingSpinner />;
  }

  const accountStatus = userProfile?.accountStatus ?? 'pending_referral';
  const conductAgreed = !!userProfile?.conductAgreedAt;
  const contractSigned = !!userProfile?.contractSignedAt;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!user ? (
        // ── Unauthenticated: go straight to auth ──────────────────────────
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !isOnboarded ? (
        // ── Authenticated, onboarding not complete ─────────────────────────
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : !conductAgreed ? (
        // ── Onboarded but conduct not yet agreed ───────────────────────────
        <Stack.Screen name="ConductStandards">
          {() => <ConductStandardsScreen />}
        </Stack.Screen>
      ) : (accountStatus === 'pending_vetting' || accountStatus === 'pending_approval') ? (
        // ── Conduct agreed, awaiting admin review ─────────────────────────
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
