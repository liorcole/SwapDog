import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePlacement } from 'expo-superwall';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { OnboardingStackParamList } from '../../navigation/types';

const RED = '#FF2D55';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Paywall'>;
};

const PaywallScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { registerPlacement, state: placementState } = usePlacement({
    onPresent: (info) => console.log('[Superwall] Paywall presented:', info),
    onDismiss: (info, result) => {
      console.log('[Superwall] Paywall dismissed:', result);
      // After paywall is dismissed, continue onboarding regardless
      // (Superwall handles gating — if gated, feature() runs only on purchase)
    },
    onError: (err) => console.error('[Superwall] Error:', err),
    onSkip: (reason) => {
      console.log('[Superwall] Paywall skipped:', reason);
      // If skipped (e.g. already subscribed), continue onboarding
      navigation.navigate('LocationSetup');
    },
  });

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await registerPlacement({
      placement: 'campaign_trigger',
      feature: () => {
        // This runs if user subscribed or is already subscribed
        navigation.navigate('LocationSetup');
      },
    });
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('LocationSetup');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.emoji}>🐾</Text>
      <Text style={[styles.title, { color: colors.text }]}>Join WatchDog</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Get full access to the WatchDog community
      </Text>

      <View style={[styles.featureList, { backgroundColor: colors.surface }]}>
        {[
          'Find trusted pet sitters nearby',
          'Post and respond to sitting requests',
          'Direct messaging with sitters',
          'Earn and use points for free sits',
          'Priority support',
        ].map((feature, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.subscribeBtn, { backgroundColor: RED }]}
        onPress={handleSubscribe}
        accessibilityLabel="Subscribe to WatchDog"
        accessibilityRole="button"
      >
        <Text style={styles.subscribeBtnText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>Maybe later</Text>
      </TouchableOpacity>

      <Text style={[styles.legal, { color: colors.textSecondary }]}>
        Payment will be charged to your Apple ID account at confirmation of purchase.
        Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  featureList: { width: '100%', borderRadius: 16, padding: 20, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkmark: { fontSize: 18, color: '#00C853', marginRight: 12, fontWeight: '700' },
  featureText: { fontSize: 15, flex: 1 },
  subscribeBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  subscribeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { paddingVertical: 12 },
  skipText: { fontSize: 14 },
  legal: { fontSize: 10, textAlign: 'center', marginTop: 16, paddingHorizontal: 20, lineHeight: 14 },
});

export default PaywallScreen;
