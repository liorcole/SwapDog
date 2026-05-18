import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { useDogs } from '../../hooks/useDogs';
import { SwapRequest, SwapStatus, Dog } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';
import { formatDogAge } from '../../utils/formatDogAge';

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
  const { getDogsByOwner } = useDogs();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [dogMap, setDogMap] = useState<Record<string, Dog>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabType>('incoming');

  const fetchSwaps = useCallback(async () => {
    if (!user) return;
    const data = await getSwapsByUser(user.uid);
    setSwaps(data);

    // Resolve dogs for all swap requests (requester dogs)
    const allDogIds = Array.from(
      new Set(data.flatMap((s) => [...s.requesterDogIds, ...s.receiverDogIds]))
    );
    if (allDogIds.length > 0) {
      // Fetch dogs for current user; for others we rely on ids already available
      const myDogs = await getDogsByOwner(user.uid);
      const map: Record<string, Dog> = {};
      myDogs.forEach((d) => { map[d.id] = d; });
      setDogMap(map);
    }

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

  const renderSwap = ({ item }: { item: SwapRequest }) => {
    const dogIds = tab === 'incoming' ? item.requesterDogIds : item.requesterDogIds;
    const representativeDog: Dog | undefined = dogIds
      .map((id) => dogMap[id])
      .find(Boolean);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, ...shadow.sm }]} accessibilityRole="none">
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] }]}>
            <Text style={styles.badgeText} accessibilityLabel={`Status: ${item.status}`}>
              {item.status.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {item.startDate.toLocaleDateString()} → {item.endDate.toLocaleDateString()}
          </Text>
        </View>

        {/* Dog preview row */}
        {representativeDog && (
          <View style={styles.dogPreview}>
            {representativeDog.photoURLs.length > 0 && (
              <Image
                source={{ uri: representativeDog.photoURLs[0] }}
                style={[styles.dogThumb, { borderColor: colors.border }]}
                accessibilityLabel={`${representativeDog.name}'s photo`}
              />
            )}
            <View style={styles.dogPreviewInfo}>
              <Text style={[styles.dogPreviewName, { color: colors.text }]}>{representativeDog.name}</Text>
              <Text style={[styles.dogPreviewBreed, { color: colors.textSecondary }]}>
                {representativeDog.breed} • {formatDogAge(representativeDog.ageYears, representativeDog.ageMonths)}
              </Text>
              {(representativeDog.vaccinated !== undefined || representativeDog.isSpayedNeutered !== undefined) && (
                <Text style={[styles.dogPreviewTags, { color: colors.textSecondary }]}>
                  {representativeDog.vaccinated ? '✅ Vaccinated' : ''}
                  {representativeDog.vaccinated && representativeDog.isSpayedNeutered ? '  ' : ''}
                  {representativeDog.isSpayedNeutered ? '✅ Neutered' : ''}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Care details preview */}
        {item.careDetails && (
          <View style={[styles.carePreview, { backgroundColor: colors.background }]}>
            <Text style={[styles.carePreviewLabel, { color: colors.textSecondary }]}>Care Details</Text>
            <Text style={[styles.carePreviewText, { color: colors.text }]} numberOfLines={2}>
              {item.careDetails}
            </Text>
          </View>
        )}

        {item.message && (
          <Text style={[styles.message, { color: colors.text }]}>"{item.message}"</Text>
        )}

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
  };

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
  // Dog preview
  dogPreview: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  dogThumb: { width: 52, height: 52, borderRadius: borderRadius.sm, borderWidth: 1 },
  dogPreviewInfo: { flex: 1 },
  dogPreviewName: { fontSize: 15, fontWeight: '700' },
  dogPreviewBreed: { fontSize: 13, marginTop: 1 },
  dogPreviewTags: { fontSize: 12, marginTop: 2 },
  // Care details
  carePreview: { borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  carePreviewLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  carePreviewText: { fontSize: 13, lineHeight: 18 },
  message: { fontSize: 14, fontStyle: 'italic', marginBottom: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

export default RequestsScreen;
