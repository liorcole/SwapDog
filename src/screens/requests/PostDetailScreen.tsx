/**
 * PostDetailScreen — full details for a public swap post, with the
 * "I Can Help! 🐾" button that creates a conversation with the poster.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { useMessaging } from '../../hooks/useMessaging';
import { SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const RED = '#FF2D55';

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'PostDetail'>;
  route: RouteProp<RequestsStackParamList, 'PostDetail'>;
};

const PostDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const { getAreaPosts, getMyPosts, addResponder, approveHelper } = useSwaps();
  const { getOrCreateConversation, sendMessage } = useMessaging();

  const [post, setPost] = useState<SwapPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const areaPosts = await getAreaPosts();
        const found = areaPosts.find((p) => p.id === route.params.postId) ?? null;
        if (found) {
          setPost(found);
          return;
        }
        if (user?.uid) {
          const myPosts = await getMyPosts(user.uid);
          const ownPost = myPosts.find((p) => p.id === route.params.postId) ?? null;
          setPost(ownPost);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [route.params.postId, user?.uid]);

  const handleHelp = async () => {
    if (!user || !post) return;
    if (user.uid === post.posterId) {
      Alert.alert("That's your post!", "You can't respond to your own request.");
      return;
    }

    setClaiming(true);
    try {
      const sitterName = userProfile?.displayName ?? user.displayName ?? 'Someone';
      const sitterPhoto = userProfile?.photoURL ?? user.photoURL ?? undefined;
      const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

      const convId = await getOrCreateConversation(user.uid, post.posterId, post.id);

      const introText = `🐾 Hey! I'd love to help watch ${post.dogName} from ${startStr} to ${endStr}. Let me know if you'd like to set something up!`;
      await sendMessage(convId, user.uid, introText);

      if (post.compensationType === 'payment' || post.compensationType === 'either') {
        await sendMessage(
          convId,
          user.uid,
          '💰 Reminder: All payments are arranged and made outside of SwapDog.'
        );
      }

      await addResponder(post.id, {
        userId: user.uid,
        userName: sitterName,
        userPhotoURL: sitterPhoto,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.getParent()?.navigate('MessagesTab', {
        screen: 'Chat',
        params: { conversationId: convId, otherUserId: post.posterId },
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setClaiming(false);
    }
  };

  const handleMessageResponder = async (responderId: string) => {
    if (!user || !post) return;
    setClaiming(true);
    try {
      const convId = await getOrCreateConversation(user.uid, responderId, post.id);
      navigation.getParent()?.navigate('MessagesTab', {
        screen: 'Chat',
        params: { conversationId: convId, otherUserId: responderId },
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open chat');
    } finally {
      setClaiming(false);
    }
  };

  const handleApprove = async (helperId: string, helperName: string) => {
    if (!user || !post) return;
    Alert.alert(
      'Approve Helper',
      `Choose ${helperName} as your dog sitter for this post?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setApprovingId(helperId);
            try {
              await approveHelper(post.id, helperId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Refresh post state optimistically
              setPost((prev) => prev ? { ...prev, status: 'claimed', claimedBy: helperId } : prev);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not approve helper');
            } finally {
              setApprovingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingSpinner />;
  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Post not found</Text>
      </View>
    );
  }

  const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const isOwner = user?.uid === post.posterId;
  const respondents = post.respondedBy ?? [];

  const compensationLabel = () => {
    if (post.compensationType === 'points') {
      return `🪙 ${post.pointsCost.toFixed(1)} point${post.pointsCost !== 1 ? 's' : ''}`;
    }
    if (post.totalPayment && post.paymentAmount && post.totalUnits && post.paymentRate) {
      const rateLabel = post.paymentRate === 'per_hour' ? '/hr' : '/day';
      const unitLabel = post.paymentRate === 'per_hour'
        ? `${post.totalUnits} hr${post.totalUnits !== 1 ? 's' : ''}`
        : `${post.totalUnits} day${post.totalUnits !== 1 ? 's' : ''}`;
      return `💰 $${post.totalPayment} total ($${post.paymentAmount}${rateLabel} × ${unitLabel})`;
    }
    return post.compensationType === 'either'
      ? `🪙 ${post.pointsCost.toFixed(1)} pts or 💰 payment`
      : '💰 Payment offered';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Poster info */}
      <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <View style={styles.posterRow}>
          {post.posterPhotoURL ? (
            <Image source={{ uri: post.posterPhotoURL }} style={[styles.posterAvatar, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.posterAvatarPlaceholder, { backgroundColor: colors.primary + '22', borderColor: colors.border }]}>
              <Text style={styles.posterAvatarEmoji}>🧑</Text>
            </View>
          )}
          <View style={styles.posterInfo}>
            <Text style={[styles.posterName, { color: colors.text }]}>{post.posterName}</Text>
            <Text style={[styles.postedAt, { color: colors.textSecondary }]}>
              Posted {post.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: post.status === 'open' ? '#00B89420' : '#63727220' }]}>
            <Text style={[styles.statusBadgeText, { color: post.status === 'open' ? '#00B894' : '#636E72' }]}>
              {post.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Dog info */}
      <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🐶 Dog</Text>
        <View style={styles.dogRow}>
          {post.dogPhotoURL ? (
            <Image source={{ uri: post.dogPhotoURL }} style={[styles.dogThumb, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.dogThumbPlaceholder, { backgroundColor: colors.primary + '22' }]}>
              <Text style={styles.dogThumbEmoji}>🐕</Text>
            </View>
          )}
          <View style={styles.dogInfo}>
            <Text style={[styles.dogName, { color: colors.text }]}>{post.dogName}</Text>
            {post.dogBreed && <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{post.dogBreed}</Text>}
          </View>
        </View>
      </View>

      {/* Dates */}
      <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Dates</Text>
        <Text style={[styles.dates, { color: colors.text }]}>
          {startStr} – {endStr}
        </Text>
      </View>

      {/* Compensation */}
      <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Compensation</Text>
        <View style={[styles.compBadge, {
          backgroundColor: post.compensationType === 'points' ? colors.primary + '18' : '#00B89418',
          borderColor: post.compensationType === 'points' ? colors.primary : '#00B894',
        }]}>
          <Text style={[styles.compBadgeText, { color: post.compensationType === 'points' ? colors.primary : '#00B894' }]}>
            {compensationLabel()}
          </Text>
        </View>
        {(post.compensationType === 'payment' || post.compensationType === 'either') && (
          <View style={[styles.offAppNote, { backgroundColor: '#FFF9E6', borderColor: '#F0C040' }]}>
            <Text style={[styles.offAppNoteText, { color: '#7A6000' }]}>
              💰 All payments are arranged and made outside of SwapDog. We do not process payments.
            </Text>
          </View>
        )}
      </View>

      {/* Care details */}
      <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Care Details</Text>
        <Text style={[styles.careDetails, { color: colors.text }]}>{post.careDetails}</Text>
      </View>

      {/* ── Interested Helpers — RED accent section, owner only ── */}
      {isOwner && respondents.length > 0 && (
        <View style={styles.helpersSection}>
          {/* Red header bar */}
          <View style={styles.helpersSectionHeader}>
            <Text style={styles.helpersSectionTitle}>
              🙋 Interested Helpers ({respondents.length})
            </Text>
            {post.status === 'claimed' && (
              <View style={styles.claimedBadge}>
                <Text style={styles.claimedBadgeText}>✅ APPROVED</Text>
              </View>
            )}
          </View>

          {/* Helper rows */}
          {respondents.map((r) => {
            const isApproved = post.claimedBy === r.userId;
            const isApproving = approvingId === r.userId;
            return (
              <View key={r.userId} style={styles.helperRow}>
                {/* Avatar */}
                <TouchableOpacity
                  onPress={() => handleMessageResponder(r.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${r.userName}`}
                  style={styles.helperAvatarTouchable}
                >
                  {r.userPhotoURL ? (
                    <Image source={{ uri: r.userPhotoURL }} style={styles.helperAvatar} />
                  ) : (
                    <View style={styles.helperAvatarPlaceholder}>
                      <Text style={styles.helperAvatarEmoji}>🧑</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Name + tap hint */}
                <TouchableOpacity
                  onPress={() => handleMessageResponder(r.userId)}
                  style={styles.helperInfo}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${r.userName}`}
                >
                  <Text style={styles.helperName}>{r.userName}</Text>
                  {isApproved ? (
                    <Text style={styles.helperApprovedLabel}>✅ Approved sitter</Text>
                  ) : (
                    <Text style={styles.helperTap}>Tap to message →</Text>
                  )}
                </TouchableOpacity>

                {/* Approve button — only if post is still open */}
                {post.status === 'open' && !isApproved && (
                  <TouchableOpacity
                    style={[styles.approveBtn, isApproving && styles.approveBtnDisabled]}
                    onPress={() => handleApprove(r.userId, r.userName)}
                    disabled={isApproving}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve ${r.userName}`}
                  >
                    <Text style={styles.approveBtnText}>{isApproving ? '…' : 'Approve'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* I Can Help button (not shown for own posts) */}
      {!isOwner && post.status === 'open' && (
        <TouchableOpacity
          style={[styles.helpBtn, { backgroundColor: colors.primary, opacity: claiming ? 0.7 : 1 }]}
          onPress={handleHelp}
          disabled={claiming}
          accessibilityLabel={claiming ? 'Sending message...' : 'I can help!'}
          accessibilityRole="button"
        >
          <Text style={styles.helpBtnText}>{claiming ? 'Opening chat...' : 'I Can Help! 🐾'}</Text>
        </TouchableOpacity>
      )}

      {isOwner && respondents.length === 0 && (
        <View style={[styles.ownerNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.ownerNoteText, { color: colors.textSecondary }]}>
            👆 This is your post. Interested sitters will message you.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16 },
  section: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  // Poster
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1 },
  posterAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  posterAvatarEmoji: { fontSize: 22 },
  posterInfo: { flex: 1 },
  posterName: { fontSize: 16, fontWeight: '700' },
  postedAt: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  // Dog
  dogRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dogThumb: { width: 60, height: 60, borderRadius: borderRadius.md, borderWidth: 1 },
  dogThumbPlaceholder: { width: 60, height: 60, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  dogThumbEmoji: { fontSize: 28 },
  dogInfo: { flex: 1 },
  dogName: { fontSize: 17, fontWeight: '700' },
  dogBreed: { fontSize: 13, marginTop: 2 },
  // Dates
  dates: { fontSize: 16, fontWeight: '600' },
  // Compensation
  compBadge: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  compBadgeText: { fontSize: 15, fontWeight: '700' },
  offAppNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm },
  offAppNoteText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  // Care details
  careDetails: { fontSize: 14, lineHeight: 22 },
  // ── Interested Helpers RED section ──────────────────────────────────────────
  helpersSection: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: RED,
    backgroundColor: 'rgba(255,45,85,0.06)',
    // Red shadow
    shadowColor: RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  helpersSectionHeader: {
    backgroundColor: RED,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpersSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  claimedBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  claimedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,45,85,0.25)',
  },
  helperAvatarTouchable: {},
  helperAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: RED },
  helperAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,45,85,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: RED,
  },
  helperAvatarEmoji: { fontSize: 20 },
  helperInfo: { flex: 1 },
  helperName: { fontSize: 15, fontWeight: '600', color: '#2D3436' },
  helperTap: { fontSize: 12, marginTop: 2, color: RED },
  helperApprovedLabel: { fontSize: 12, marginTop: 2, color: '#00B894', fontWeight: '600' },
  // Approve button
  approveBtn: {
    backgroundColor: RED,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  approveBtnDisabled: { opacity: 0.5 },
  approveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  // Help button
  helpBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  helpBtnText: { color: '#fff', ...typography.button, fontSize: 17 },
  // Owner note
  ownerNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  ownerNoteText: { fontSize: 14 },
});

export default PostDetailScreen;
