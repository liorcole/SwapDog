import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { db } from '../../config/firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { OnboardingStackParamList } from '../../navigation/types';

const RED = '#FF2D55';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Paywall'>;
};

const PaywallScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // TODO: Wire up RevenueCat / StoreKit for real IAP
      // For now, mark user as subscribed (free during beta)
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionStatus: 'active',
        subscriptionPlan: 'monthly',
        subscribedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('LocationSetup');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    // TODO: Wire up RevenueCat restore purchases
    Alert.alert('Restore', 'No previous subscription found. Subscribe to get started!');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top section */}
      <View style={styles.top}>
        <Text style={styles.emoji}>🐾</Text>
        <Text style={[styles.title, { color: colors.text }]}>Join WatchDog</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          The trusted community for dog owners who help each other out.
        </Text>
      </View>

      {/* Features list */}
      <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <FeatureRow emoji="🏠" text="Find trusted local sitters" colors={colors} />
        <FeatureRow emoji="🔄" text="Exchange sits with neighbors" colors={colors} />
        <FeatureRow emoji="💬" text="Direct messaging with owners" colors={colors} />
        <FeatureRow emoji="📍" text="Discover dog owners nearby" colors={colors} />
        <FeatureRow emoji="⭐" text="Verified community members" colors={colors} />
      </View>

      {/* Pricing */}
      <View style={styles.pricingSection}>
        <View style={[styles.priceCard, { borderColor: RED }]}>
          <Text style={[styles.priceAmount, { color: colors.text }]}>$4.99</Text>
          <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/month</Text>
        </View>
        <Text style={[styles.priceNote, { color: colors.textSecondary }]}>
          Cancel anytime. No long-term commitment.
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.subscribeBtn, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubscribe}
          disabled={loading}
          accessibilityLabel="Subscribe for $4.99 per month"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeBtnText}>Subscribe — $4.99/mo</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRestore}
          accessibilityLabel="Restore purchases"
          accessibilityRole="button"
        >
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>Restore Purchases</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <Text style={[styles.legal, { color: colors.textSecondary }]}>
            Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period.
          </Text>
        )}
      </View>
    </View>
  );
};

const FeatureRow: React.FC<{ emoji: string; text: string; colors: { text: string; textSecondary: string } }> = ({ emoji, text, colors }) => (
  <View style={styles.featureRow}>
    <Text style={styles.featureEmoji}>{emoji}</Text>
    <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  top: { alignItems: 'center', marginBottom: 28 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  featuresCard: { borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  featureEmoji: { fontSize: 20, marginRight: 14, width: 28, textAlign: 'center' },
  featureText: { fontSize: 15, fontWeight: '500', flex: 1 },

  pricingSection: { alignItems: 'center', marginBottom: 28 },
  priceCard: { flexDirection: 'row', alignItems: 'baseline', borderWidth: 2, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28 },
  priceAmount: { fontSize: 36, fontWeight: '800' },
  pricePeriod: { fontSize: 16, fontWeight: '500', marginLeft: 4 },
  priceNote: { fontSize: 13, marginTop: 8 },

  bottom: { marginTop: 'auto', alignItems: 'center' },
  subscribeBtn: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 16 },
  subscribeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  restoreText: { fontSize: 14, fontWeight: '500', marginBottom: 16 },
  legal: { fontSize: 10, textAlign: 'center', lineHeight: 14, paddingHorizontal: 8 },
});

export default PaywallScreen;
