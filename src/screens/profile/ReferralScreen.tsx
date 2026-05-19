import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Clipboard,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, typography, shadow } from '../../config/theme';
import { getMyReferrals, getReferralCount } from '../../hooks/useReferrals';
import { User } from '../../models/types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Referral'>;
};

const APP_LINK = 'https://swapdog.app';

const ReferralScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const [referrals, setReferrals] = useState<User[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [smsAvailable, setSmsAvailable] = useState(false);

  const referralCode = userProfile?.referralCode ?? '';

  // Check SMS availability on mount
  useEffect(() => {
    SMS.isAvailableAsync().then(setSmsAvailable).catch(() => setSmsAvailable(false));
  }, []);

  const loadReferrals = useCallback(async () => {
    if (!user) return;
    try {
      const [users, count] = await Promise.all([
        getMyReferrals(user.uid),
        getReferralCount(user.uid),
      ]);
      setReferrals(users);
      setReferralCount(count);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const handleCopyCode = () => {
    if (!referralCode) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', `Your referral code "${referralCode}" has been copied to the clipboard.`);
  };

  const handleTextFriend = async () => {
    if (!referralCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message =
      `Hey! 🐾 I've been using SwapDog — it's an amazing community for peer-to-peer dog ` +
      `sitting with people you can trust. Use my referral code ${referralCode} to join! ` +
      `Download: ${APP_LINK}`;
    try {
      await SMS.sendSMSAsync([], message);
    } catch {
      Alert.alert('Oops', 'Could not open the SMS app. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `🐾 Join me on SwapDog — the trusted community for peer-to-peer dog sitting! Use my referral code: ${referralCode} to get started. Download: ${APP_LINK}`,
        title: 'Join SwapDog',
      });
    } catch {
      // user dismissed share sheet — ignore
    }
  };

  const getStatusBadge = (status: User['accountStatus']) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: '#00B894', bg: '#00B89415' };
      case 'suspended':
        return { label: 'Suspended', color: '#E17055', bg: '#E1705515' };
      default:
        return { label: 'Pending', color: '#FDCB6E', bg: '#FDCB6E20' };
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>🎁 Invite a Friend</Text>

      {/* Trust & Safety Card */}
      <View style={[styles.safetyCard, { backgroundColor: '#FFF3CD', borderColor: '#F0AD4E' }]}>
        <Text style={[styles.safetyTitle, { color: '#856404' }]}>🐾 Built on Trust & Safety</Text>
        <Text style={[styles.safetyBody, { color: '#664D03' }]}>
          SwapDog is built on trust and safety. Our community thrives because every member is vouched
          for by someone we already trust.
        </Text>
        <Text style={[styles.safetyBold, { color: '#664D03' }]}>
          Your referrals reflect on you.
        </Text>
        <Text style={[styles.safetyBody, { color: '#664D03' }]}>
          We expect all referrals to be trusted friends or family members who share our values of
          responsible pet care.
        </Text>
        <View style={[styles.warningBox, { backgroundColor: '#F8D7DA', borderColor: '#F5C2C7' }]}>
          <Text style={[styles.warningText, { color: '#842029' }]}>
            ⚠️ Accountability Notice: If someone you refer is reported for conduct violations, your
            account will be reviewed and may be subject to suspension. This is handled on a
            case-by-case basis, but please — only refer people you would trust with your own pets.
          </Text>
        </View>
      </View>

      {/* Referral Code Section */}
      {referralCode ? (
        <View style={[styles.codeSection, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            YOUR REFERRAL CODE
          </Text>
          <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.primary }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>{referralCode}</Text>
          </View>

          {/* Copy code */}
          <TouchableOpacity
            style={[styles.fullWidthBtn, { borderColor: colors.primary, borderWidth: 1.5 }]}
            onPress={handleCopyCode}
            accessibilityLabel={`Copy referral code ${referralCode}`}
            accessibilityRole="button"
          >
            <Text style={[styles.fullWidthBtnText, { color: colors.primary }]}>📋  Copy Code</Text>
          </TouchableOpacity>

          {/* Text a Friend — coral fill, only shown when SMS is available */}
          {smsAvailable && (
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.smsBtn, { backgroundColor: colors.primary }]}
              onPress={handleTextFriend}
              accessibilityLabel="Text a friend your referral code"
              accessibilityRole="button"
            >
              <Text style={[styles.fullWidthBtnText, { color: '#fff' }]}>📱  Text a Friend</Text>
            </TouchableOpacity>
          )}

          {/* General share — teal secondary */}
          <TouchableOpacity
            style={[styles.fullWidthBtn, { borderColor: '#4ECDC4', borderWidth: 1.5 }]}
            onPress={handleShare}
            accessibilityLabel="Share your referral code"
            accessibilityRole="button"
          >
            <Text style={[styles.fullWidthBtnText, { color: '#4ECDC4' }]}>🔗  Share via…</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.codeSection, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.noCodeText, { color: colors.textSecondary }]}>
            Your referral code is being generated. Check back soon!
          </Text>
        </View>
      )}

      {/* My Referrals Section */}
      <View style={styles.referralsSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MY REFERRALS</Text>

        {loading ? (
          <LoadingSpinner />
        ) : referralCount === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, ...shadow.sm }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You haven't referred anyone yet. Share your code to invite trusted friends!
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.countText, { color: colors.text }]}>
              You've referred {referralCount} {referralCount === 1 ? 'member' : 'members'}
            </Text>
            {referrals.map((referredUser) => {
              const badge = getStatusBadge(referredUser.accountStatus);
              return (
                <View
                  key={referredUser.id}
                  style={[styles.referralRow, { backgroundColor: colors.surface, ...shadow.sm }]}
                >
                  <Text style={[styles.referralName, { color: colors.text }]}>
                    {referredUser.displayName}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
                    <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  title: { ...typography.h2, marginBottom: spacing.lg },

  // Trust & Safety
  safetyCard: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  safetyTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  safetyBody: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  safetyBold: { fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  warningBox: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  warningText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },

  // Code section
  codeSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  codeBox: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  codeText: { fontSize: 28, fontWeight: '800', letterSpacing: 4 },

  // Buttons
  fullWidthBtn: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  fullWidthBtnText: { fontSize: 15, fontWeight: '700' },
  smsBtn: {
    // extra prominence via shadow offset
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  noCodeText: { fontSize: 14, textAlign: 'center', paddingVertical: spacing.md },

  // Referrals section
  referralsSection: { marginBottom: spacing.lg },
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  countText: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  referralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  referralName: { fontSize: 15, fontWeight: '600' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
});

export default ReferralScreen;
