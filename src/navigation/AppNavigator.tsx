import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const REFERRAL_STORAGE_KEY = '@swapdog_referral_code';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isOnboarded, userProfile, loading } = useAuthContext();

  // Capture referral code from deep link URL (?ref=CODE) and store for signup
  useEffect(() => {
    const captureReferralFromUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const match = url.match(/[?&]ref=([^&]+)/);
          if (match && match[1]) {
            await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, match[1]);
          }
        }
      } catch {
        // Non-fatal
      }
    };
    captureReferralFromUrl();

    // Also listen for URLs while app is open
    const sub = Linking.addEventListener('url', ({ url }) => {
      const match = url.match(/[?&]ref=([^&]+)/);
      if (match && match[1]) {
        AsyncStorage.setItem(REFERRAL_STORAGE_KEY, match[1]).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

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
