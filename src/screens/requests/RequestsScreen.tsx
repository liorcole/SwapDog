import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { SwapRequest, SwapStatus } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'Requests'>;
};

const STATUS_COLORS: Record<SwapStatus, string> = {
  [SwapStatus.pending]: '#FDCB6E',
  [SwapStatus.accepted]: '#00B894',
  [SwapStatus.declined]: '#E17055',
  [SwapStatus.cancelled]: '#636E72',
  [SwapStatus.completed]: '#4ECDC4',
};

type TabType = 'incoming' | 'outgoing';

const RequestsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { getSwapsByUser, updateSwapStatus } = useSwaps();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabType>('incoming');

  const fetchSwaps = useCallback(async () => {
    if (!user) return;
    const data = await getSwapsByUser(user.uid);
    setSwaps(data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchSwaps(); }, [fetchSwaps]));

  const handleAction = async (id: string, status: SwapStatus, label: string) => {
    Alert.alert(label, `Are you sure?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        style: status === SwapStatus.declined || status === SwapStatus.cancelled ? 'destructive' : 'default',
        onPress: async () => {
          await updateSwapStatus(id, status);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchSwaps();
        },
      },
    ]);
  };

  const incoming = swaps.filter((s) => s.receiverId === user?.uid);
  const outgoing = swaps.filter((s) => s.requesterId === user?.uid);
  const displayed = tab === 'incoming' ? incoming : outgoing;

  const renderSwap = ({ item }: { item: SwapRequest }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, ...shadow.sm }]} accessibilityRole="none">
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] }]}>
          <Text style={styles.badgeText} accessibilityLabel={`Status: ${item.status}`}>{item.status.toUpperCase()}</Text>
        </View>
        <Text style={[styles.date, { color: colors.textSecondary }]}>
          {item.startDate.toLocaleDateString()} → {item.endDate.toLocaleDateString()}
        </Text>
      </View>
      {item.message && <Text style={[styles.message, { color: colors.text }]}>"{item.message}"</Text>}
      <View style={styles.actions}>
        {tab === 'incoming' && item.status === SwapStatus.pending && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
              onPress={() => handleAction(item.id, SwapStatus.accepted, 'Accept')}
              accessibilityLabel="Accept swap request"
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.error }]}
              onPress={() => handleAction(item.id, SwapStatus.declined, 'Decline')}
              accessibilityLabel="Decline swap request"
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnText}>Decline</Text>
            </TouchableOpacity>
          </>
        )}
        {tab === 'outgoing' && item.status === SwapStatus.pending && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            onPress={() => handleAction(item.id, SwapStatus.cancelled, 'Cancel')}
            accessibilityLabel="Cancel swap request"
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {item.status === SwapStatus.accepted && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => handleAction(item.id, SwapStatus.completed, 'Complete')}
            accessibilityLabel="Mark swap as completed"
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
        {item.status === SwapStatus.completed && tab === 'outgoing' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('WriteReview', { swapRequestId: item.id, revieweeId: item.receiverId })}
            accessibilityLabel="Write a review"
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnText}>Write Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['incoming', 'outgoing'] as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
            accessibilityLabel={`${t === 'incoming' ? 'Incoming' : 'Outgoing'} requests`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textSecondary }]}>
              {t === 'incoming' ? 'Incoming' : 'Outgoing'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={displayed}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSwaps(); }} />}
        ListEmptyComponent={<EmptyStateView emoji="🔄" title="No requests" subtitle="Send a swap request from the Discover tab" />}
        renderItem={renderSwap}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabText: { fontSize: 15, fontWeight: '600' },
  list: { padding: spacing.md },
  card: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  date: { fontSize: 13 },
  message: { fontSize: 14, fontStyle: 'italic', marginBottom: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

export default RequestsScreen;
