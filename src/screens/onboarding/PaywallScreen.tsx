import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { presentPaywall, getSubscriptionStatus } from '../../services/superwall';
import { OnboardingStackParamList } from '../../navigation/types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const RED = '#FF2D55';

type NavProp = NativeStackNavigationProp<OnboardingStackParamList, 'Paywall'>;

const PaywallScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const navigation = useNavigation<NavProp>();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Present the Superwall paywall (configured in dashboard)
      const subscribed = await presentPaywall('campaign_trigger');

      if (subscribed && user) {
        // Update Firestore with subscription status
        await updateDoc(doc(db, 'users', user.uid), {
          subscriptionStatus: 'active',
          subscriptionPlan: 'monthly',
          subscribedAt: serverTimestamp(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Continue onboarding regardless (paywall is soft gate for now)
      navigation.navigate('LocationSetup');
    } catch (e) {
      console.error('Paywall error:', e);
      // Don't block onboarding on paywall errors
      navigation.navigate('LocationSetup');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('LocationSetup');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.emoji}>🐾</Text>
      <Text style={[styles.title, { color: colors.text }]}>Join WatchDog</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Get matched with trusted pet sitters in your neighborhood.
      </Text>

      <View style={[styles.featureList, { backgroundColor: colors.surface }]}>
        <FeatureRow emoji="🏡" text="Find trusted sitters nearby" color={colors.text} />
        <FeatureRow emoji="💬" text="Direct messaging with sitters" color={colors.text} />
        <FeatureRow emoji="🐕" text="Earn points by pet sitting" color={colors.text} />
        <FeatureRow emoji="⭐" text="Verified reviews & ratings" color={colors.text} />
        <FeatureRow emoji="📍" text="Location-based matching" color={colors.text} />
      </View>

      <TouchableOpacity
        style={[styles.subscribeBtn, { opacity: loading ? 0.7 : 1 }]}
        onPress={handleSubscribe}
        disabled={loading}
        accessibilityLabel="Subscribe to WatchDog"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.subscribeBtnText}>Continue — $4.99/month</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} accessibilityLabel="Skip subscription" accessibilityRole="button">
        <Text style={[styles.skip, { color: colors.textSecondary }]}>Maybe later</Text>
      </TouchableOpacity>

      <Text style={[styles.legal, { color: colors.textSecondary }]}>
        Recurring billing. Cancel anytime in Settings.{'\n'}
        Subscription auto-renews unless cancelled 24 hours before the end of the current period.
      </Text>
    </View>
  );
};

const FeatureRow: React.FC<{ emoji: string; text: string; color: string }> = ({ emoji, text, color }) => (
  <View style={styles.featureRow}>
    <Text style={styles.featureEmoji}>{emoji}</Text>
    <Text style={[styles.featureText, { color }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22, paddingHorizontal: 16 },
  featureList: { width: '100%', borderRadius: 16, padding: 16, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  featureEmoji: { fontSize: 20, marginRight: 12, width: 28, textAlign: 'center' },
  featureText: { fontSize: 15, fontWeight: '500', flex: 1 },
  subscribeBtn: { backgroundColor: RED, width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  subscribeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skip: { fontSize: 15, fontWeight: '600', paddingVertical: 12 },
  legal: { fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16, paddingHorizontal: 20 },
});

export default PaywallScreen;
