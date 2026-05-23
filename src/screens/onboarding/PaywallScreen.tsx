import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePlacement } from 'expo-superwall';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { OnboardingStackParamList } from '../../navigation/types';

const RED = '#FF2D55';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Paywall'>;
};

const PaywallScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, refreshUserProfile } = useAuthContext();
  const [dismissed, setDismissed] = useState(false);
  const triggered = useRef(false);

  const activateAccount = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      isOnboarded: true,
      accountStatus: 'active',
      conductAgreedAt: serverTimestamp(),
      contractSignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await refreshUserProfile();
  };

  const { registerPlacement } = usePlacement({
    onPresent: (info) => console.log('[Superwall] Paywall presented:', info),
    onDismiss: (info, result) => {
      console.log('[Superwall] Paywall dismissed:', result);
      // User closed paywall without purchasing — show retry screen
      setDismissed(true);
    },
    onError: (err) => {
      console.error('[Superwall] Error:', err);
      setDismissed(true);
    },
    onSkip: async (reason) => {
      console.log('[Superwall] Paywall skipped:', reason);
      // Skipped = already subscribed. Activate immediately.
      await activateAccount();
    },
  });

  const showPaywall = async () => {
    setDismissed(false);
    await registerPlacement({
      placement: 'campaign_trigger',
      feature: async () => {
        // User subscribed! Activate account.
        await activateAccount();
      },
    });
  };

  // Auto-trigger Superwall paywall on mount
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    showPaywall();
  }, []);

  // If user dismissed the paywall, show a minimal retry screen
  if (dismissed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.emoji}>🐾</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Subscription Required
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Subscribe to join the SwapDog community
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: RED }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            showPaywall();
          }}
          accessibilityLabel="Subscribe"
          accessibilityRole="button"
        >
          <Text style={styles.retryBtnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // While Superwall paywall is loading/showing, show blank + spinner
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={RED} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 },
  retryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

export default PaywallScreen;
