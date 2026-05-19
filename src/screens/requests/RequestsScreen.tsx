/**
 * RequestsScreen (now "Schedule") — two tabs:
 *   "My Posts"     : the user's own posts so they can see responses / cancel
 *   "Commitments"  : calendar-style view of all accepted swap commitments
 *                    Red (#FF2D55) = your dog being watched; Teal (#2DD4BF) = you're watching
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  cancelSwapReminders,
  scheduleSitterReminders,
  requestNotificationPermissions,
} from '../../services/ReminderService';

const RED = '#FF2D55';
const TEAL = '#2DD4BF';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAL_H_PADDING = spacing.md * 2;
const CELL_WIDTH = Math.floor((SCREEN_WIDTH - CAL_H_PADDING) / 7);

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'Requests'>;
};

type TabType = 'mine' | 'commitments';

// ── Date helpers ──────────────────────────────────────────────────────────────
function overlapsDate(post: SwapPost, date: Date): boolean {
  const cell = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = new Date(post.startDate.getFullYear(), post.startDate.getMonth(), post.startDate.getDate());
  const end = new Date(post.endDate.getFullYear(), post.endDate.getMonth(), post.endDate.getDate());
  return start <= cell && cell <= end;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const RequestsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { getMyPosts, cancelPost, getAcceptedPosts, saveSitterReminderIds } = useSwaps();

  const [tab, setTab] = useState<TabType>('mine');
  const [myPosts, setMyPosts] = useState<SwapPost[]>([]);
  const [acceptedPosts, setAcceptedPosts] = useState<SwapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar state — default to current month / today selected
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [calMonth, setCalMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    try {
      const [mine, accepted] = await Promise.all([
        getMyPosts(user.uid),
        getAcceptedPosts(user.uid),
      ]);
      setMyPosts(mine);
      setAcceptedPosts(accepted);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchPosts(); }, [fetchPosts]));

  // ── Sitter-side reminder scheduling ───────────────────────────────────────
  useEffect(() => {
    if (!user || acceptedPosts.length === 0) return;

    const scheduleMissingReminders = async () => {
      for (const post of acceptedPosts) {
        if (post.claimedBy !== user.uid) continue;
        if ((post.sitterReminderNotificationIds ?? []).length > 0) continue;

        const storageKey = `sitter_reminders_scheduled_${post.id}`;
        try {
          const alreadyScheduled = await AsyncStorage.getItem(storageKey);
          if (alreadyScheduled) continue;

          const hasPermission = await requestNotificationPermissions();
          if (!hasPermission) continue;

          const sitterIds = await scheduleSitterReminders({
            startDate: post.startDate,
            dogName: post.dogName,
            ownerName: post.posterName,
            sitterName: user.displayName ?? 'You',
          });

          if (sitterIds.length > 0) {
            await AsyncStorage.setItem(storageKey, 'true');
            saveSitterReminderIds(post.id, sitterIds).catch((e) =>
              console.warn('[RequestsScreen] saveSitterReminderIds failed:', e),
            );
          }
        } catch (e) {
          console.warn('[RequestsScreen] sitter reminder scheduling failed:', e);
        }
      }
    };

    scheduleMissingReminders();
  }, [acceptedPosts, user?.uid]);

  // ── Cancel post ───────────────────────────────────────────────────────────
  const handleCancel = async (postId: string) => {
    Alert.alert('Cancel Post', 'Remove your post from the area feed?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Post',
        style: 'destructive',
        onPress: async () => {
          const postToCancel = myPosts.find((p) => p.id === postId);
          if (postToCancel) {
            const allIds = [
              ...(postToCancel.reminderNotificationIds ?? []),
              ...(postToCancel.sitterReminderNotificationIds ?? []),
            ];
            if (allIds.length > 0) {
              cancelSwapReminders(allIds).catch((e) =>
                console.warn('[RequestsScreen] cancelSwapReminders failed:', e),
              );
            }
          }
          await cancelPost(postId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchPosts();
        },
      },
    ]);
  };

  const compensationLabel = (post: SwapPost): string => {
    if (post.compensationType === 'points') {
      return `🪙 ${post.pointsCost.toFixed(1)} pt${post.pointsCost !== 1 ? 's' : ''}`;
    }
    if (post.totalPayment && post.paymentAmount && post.totalUnits && post.paymentRate) {
      const rateLabel = post.paymentRate === 'per_hour' ? '/hr' : '/day';
      const unitLabel =
        post.paymentRate === 'per_hour'
          ? `${post.totalUnits} hr${post.totalUnits !== 1 ? 's' : ''}`
          : `${post.totalUnits} day${post.totalUnits !== 1 ? 's' : ''}`;
      return `💰 $${post.totalPayment} total ($${post.paymentAmount}${rateLabel} × ${unitLabel})`;
    }
    return '💰 Payment offered';
  };

  // ── My Posts card ─────────────────────────────────────────────────────────
  const renderMyPost = ({ item }: { item: SwapPost }) => {
    const startStr = item.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = item.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const isOpen = item.status === 'open';
    const interestedCount = item.respondedBy?.length ?? 0;
    const statusColor: Record<SwapPost['status'], string> = {
      open: '#00B894',
      claimed: '#FDCB6E',
      completed: '#4ECDC4',
      cancelled: '#636E72',
    };

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, ...shadow.sm }]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`Your post for ${item.dogName}`}
      >
        <View style={styles.cardHeader}>
          {item.dogPhotoURL ? (
            <Image source={{ uri: item.dogPhotoURL }} style={[styles.dogThumbSmall, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.dogThumbPlaceholder, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.dogThumbEmoji}>🐕</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.posterName, { color: colors.text }]}>{item.dogName}</Text>
            <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
              {startStr} – {endStr}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor[item.status] + '25' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor[item.status] }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.compBadge,
            {
              backgroundColor: item.compensationType !== 'points' ? '#00B89418' : colors.primary + '18',
              borderColor: item.compensationType !== 'points' ? '#00B894' : colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.compBadgeText,
              { color: item.compensationType !== 'points' ? '#00B894' : colors.primary },
            ]}
          >
            {compensationLabel(item)}
          </Text>
        </View>

        {interestedCount > 0 && (
          <View style={styles.interestFlagRow}>
            <View style={styles.interestBadge}>
              <Text style={styles.interestBadgeText}>
                🙋 {interestedCount} helper{interestedCount !== 1 ? 's' : ''} interested — tap to see
              </Text>
            </View>
          </View>
        )}

        {isOpen && (
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.error }]}
            onPress={() => handleCancel(item.id)}
            accessibilityLabel="Cancel post"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelBtnText, { color: colors.error }]}>Cancel Post</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const prevMonth = () =>
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  /** Build array of Date|null for the calendar grid (null = empty leading cell). */
  const buildCalendarDays = (): (Date | null)[] => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  /** Returns red/teal dot presence for a given calendar date. */
  const getDotsForDate = (date: Date): { red: boolean; teal: boolean } => {
    let red = false;
    let teal = false;
    for (const post of acceptedPosts) {
      if (!overlapsDate(post, date)) continue;
      if (post.posterId === user?.uid) red = true;
      if (post.claimedBy === user?.uid) teal = true;
    }
    return { red, teal };
  };

  const selectedCommitments = acceptedPosts.filter((p) => overlapsDate(p, selectedDate));

  // ── Commitment card ───────────────────────────────────────────────────────
  const renderCommitmentCard = (post: SwapPost) => {
    const isMyDog = post.posterId === user?.uid;
    const accentColor = isMyDog ? RED : TEAL;
    const roleIcon = isMyDog ? '🏠' : '🐾';
    const roleLabel = isMyDog ? 'Your dog' : "You're watching";
    const otherName = isMyDog
      ? (post.respondedBy?.find((r) => r.userId === post.claimedBy)?.userName ?? 'Your sitter')
      : post.posterName;
    const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = post.endDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        key={post.id}
        style={[
          styles.commitCard,
          { backgroundColor: colors.surface, borderLeftColor: accentColor, ...shadow.sm },
        ]}
        onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        accessibilityRole="button"
        accessibilityLabel={`${roleLabel}: ${post.dogName} with ${otherName}`}
      >
        <View style={styles.commitCardInner}>
          <Text style={styles.commitRoleIcon}>{roleIcon}</Text>
          <View style={styles.commitInfo}>
            <Text style={[styles.commitRoleLabel, { color: accentColor }]}>{roleLabel}</Text>
            <Text style={[styles.commitDogName, { color: colors.text }]}>{post.dogName}</Text>
            <Text style={[styles.commitOther, { color: colors.textSecondary }]}>{otherName}</Text>
            <Text style={[styles.commitDates, { color: colors.textSecondary }]}>
              📅 {startStr} – {endStr}
            </Text>
            {post.compensationType !== 'points' && (
              <Text style={[styles.commitComp, { color: '#00B894' }]}>
                {compensationLabel(post)}
              </Text>
            )}
          </View>
          <Text style={[styles.commitArrow, { color: colors.primary }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Commitments tab ───────────────────────────────────────────────────────
  const renderCommitmentsTab = () => {
    const calDays = buildCalendarDays();

    return (
      <ScrollView
        contentContainerStyle={styles.calendarScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPosts();
            }}
          />
        }
      >
        {/* Month header */}
        <View style={styles.calMonthHeader}>
          <TouchableOpacity
            onPress={prevMonth}
            style={styles.calNavBtn}
            accessibilityLabel="Previous month"
            accessibilityRole="button"
          >
            <Text style={[styles.calNavText, { color: colors.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.calMonthTitle, { color: colors.text }]}>
            {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={styles.calNavBtn}
            accessibilityLabel="Next month"
            accessibilityRole="button"
          >
            <Text style={[styles.calNavText, { color: colors.primary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day-of-week row */}
        <View style={styles.calDowRow}>
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={[styles.calDowText, { color: colors.textSecondary }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calGrid}>
          {calDays.map((date, idx) => {
            if (date === null) {
              return <View key={`empty-${idx}`} style={styles.calCell} />;
            }
            const dots = getDotsForDate(date);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const hasAny = dots.red || dots.teal;

            return (
              <TouchableOpacity
                key={idx}
                style={styles.calCell}
                onPress={() => setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
                accessibilityLabel={`${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.calDayCircle,
                    isSelected && { backgroundColor: colors.primary },
                    !isSelected && isToday
                      ? { borderWidth: 1.5, borderColor: colors.primary }
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayNum,
                      { color: isSelected ? '#fff' : colors.text },
                      !isSelected && isToday ? { color: colors.primary, fontWeight: '700' } : undefined,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {hasAny && (
                  <View style={styles.calDots}>
                    {dots.red ? <View style={[styles.calDot, { backgroundColor: RED }]} /> : null}
                    {dots.teal ? <View style={[styles.calDot, { backgroundColor: TEAL }]} /> : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.calLegend}>
          <View style={styles.calLegendItem}>
            <View style={[styles.calDot, { backgroundColor: RED }]} />
            <Text style={[styles.calLegendText, { color: colors.textSecondary }]}>
              Your dog being watched
            </Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calDot, { backgroundColor: TEAL }]} />
            <Text style={[styles.calLegendText, { color: colors.textSecondary }]}>
              You're watching
            </Text>
          </View>
        </View>

        {/* Selected day section */}
        <View style={[styles.selectedDayHeader, { borderTopColor: colors.border }]}>
          <Text style={[styles.selectedDayTitle, { color: colors.text }]}>
            {selectedDate.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {selectedCommitments.length === 0 ? (
          <View style={styles.noneToday}>
            <Text style={[styles.noneTodayText, { color: colors.textSecondary }]}>
              No commitments on this day
            </Text>
          </View>
        ) : (
          <View style={styles.commitList}>
            {selectedCommitments.map((post) => renderCommitmentCard(post))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  const tabs: { key: TabType; label: string }[] = [
    { key: 'mine', label: '📋 My Posts' },
    {
      key: 'commitments',
      label: `📅 Commitments${acceptedPosts.length > 0 ? ` (${acceptedPosts.length})` : ''}`,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab bar */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tab,
              tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(t.key)}
            accessibilityLabel={t.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t.key ? colors.primary : colors.textSecondary },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'mine' ? (
        <>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CreatePost')}
            accessibilityLabel="Post a request"
            accessibilityRole="button"
          >
            <Text style={styles.fabText}>+ Post a Request</Text>
          </TouchableOpacity>
          <FlatList
            data={myPosts}
            keyExtractor={(p) => p.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchPosts();
                }}
              />
            }
            ListEmptyComponent={
              <EmptyStateView
                emoji="📋"
                title="No posts yet"
                subtitle="Post a request and local sitters will reach out"
              />
            }
            renderItem={renderMyPost}
            contentContainerStyle={styles.list}
          />
        </>
      ) : (
        renderCommitmentsTab()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Tab bar
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabText: { fontSize: 13, fontWeight: '600' },

  // My Posts list
  list: { padding: spacing.md, paddingBottom: spacing.xl * 3 },

  // Card shared
  card: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerInfo: { flex: 1 },
  posterName: { fontSize: 15, fontWeight: '700' },
  dateRange: { fontSize: 12, marginTop: 1 },
  dogThumbSmall: { width: 44, height: 44, borderRadius: borderRadius.sm, borderWidth: 1 },
  dogThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogThumbEmoji: { fontSize: 20 },
  compBadge: {
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  compBadgeText: { fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1.5,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600' },
  interestFlagRow: { marginBottom: spacing.xs },
  interestBadge: {
    backgroundColor: RED,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  interestBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // FAB
  fab: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    margin: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Calendar container
  calendarScroll: { padding: spacing.md, paddingBottom: spacing.xl * 3 },

  // Month nav header
  calMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calNavBtn: { padding: spacing.sm },
  calNavText: { fontSize: 28, lineHeight: 32 },
  calMonthTitle: { fontSize: 18, fontWeight: '700' },

  // Day-of-week row
  calDowRow: { flexDirection: 'row', marginBottom: spacing.xs },
  calDowText: { width: CELL_WIDTH, textAlign: 'center', fontSize: 12, fontWeight: '600' },

  // Grid
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    paddingVertical: 3,
  },
  calDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayNum: { fontSize: 14, fontWeight: '500' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 1 },
  calDot: { width: 6, height: 6, borderRadius: 3 },

  // Legend
  calLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  calLegendText: { fontSize: 11 },

  // Selected day section
  selectedDayHeader: { borderTopWidth: 1, paddingTop: spacing.md, marginBottom: spacing.sm },
  selectedDayTitle: { fontSize: 15, fontWeight: '700' },
  noneToday: { alignItems: 'center', paddingVertical: spacing.lg },
  noneTodayText: { fontSize: 14, fontStyle: 'italic' },

  // Commitment cards
  commitList: { gap: spacing.sm },
  commitCard: { borderRadius: borderRadius.lg, borderLeftWidth: 4, padding: spacing.md },
  commitCardInner: { flexDirection: 'row', alignItems: 'center' },
  commitRoleIcon: { fontSize: 24, marginRight: spacing.sm },
  commitInfo: { flex: 1 },
  commitRoleLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 1 },
  commitDogName: { fontSize: 16, fontWeight: '700' },
  commitOther: { fontSize: 13, marginTop: 1 },
  commitDates: { fontSize: 12, marginTop: 2 },
  commitComp: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  commitArrow: { fontSize: 24 },
});

export default RequestsScreen;
