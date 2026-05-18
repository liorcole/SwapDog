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
import { useUsers } from '../../hooks/useUsers';
import { useMessaging } from '../../hooks/useMessaging';
import { SwapRequest, SwapStatus, Dog, SitterPreference } from '../../models/types';
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
  const { getSwapsByUser, updateSwapStatus, updateSwapSitterPreference } = useSwaps();
  const { getDogsByOwner } = useDogs();
  const { getUser } = useUsers();
  const { getOrCreateConversation, sendMessage } = useMessaging();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [dogMap, setDogMap] = useState<Record<string, Dog>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabType>('incoming');
  // Track sitter preference selections per swap (before confirming)
  const [pendingPreferences, setPendingPreferences] = useState<Record<string, SitterPreference>>({});

  const fetchSwaps = useCallback(async () => {
    if (!user) return;
    const data = await getSwapsByUser(user.uid);
    setSwaps(data);

    const myDogs = await getDogsByOwner(user.uid);
    const map: Record<string, Dog> = {};
    myDogs.forEach((d) => { map[d.id] = d; });
    setDogMap(map);

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchSwaps(); }, [fetchSwaps]));

  const handleDecline = async (id: string) => {
    Alert.alert('Decline', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          await updateSwapStatus(id, SwapStatus.declined);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchSwaps();
        },
      },
    ]);
  };

  const handleCancel = async (id: string) => {
    Alert.alert('Cancel', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          await updateSwapStatus(id, SwapStatus.cancelled);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchSwaps();
        },
      },
    ]);
  };

  const handleComplete = async (id: string) => {
    Alert.alert('Complete', 'Mark this swap as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          await updateSwapStatus(id, SwapStatus.completed);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchSwaps();
        },
      },
    ]);
  };

  /**
   * Accept a swap request:
   * 1. Validate sitter preference when paymentType === 'either'
   * 2. Update swap status + sitterPreference
   * 3. Send inbox notification to the owner
   */
  const handleAccept = async (swap: SwapRequest) => {
    if (!user) return;

    // Determine the sitter's preference
    let sitterPref: SitterPreference;
    if (swap.paymentType === 'either') {
      const chosen = pendingPreferences[swap.id];
      if (!chosen) {
        Alert.alert('Choose Payment', 'Please select how you want to be compensated before accepting.');
        return;
      }
      sitterPref = chosen;
    } else {
      sitterPref = swap.paymentType === 'payment' ? 'payment' : 'points';
    }

    Alert.alert('Accept Request', 'Are you sure you want to accept this swap?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            // 1. Update swap with status + sitter preference
            await updateSwapSitterPreference(swap.id, sitterPref, SwapStatus.accepted);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // 2. Send inbox notification to the owner
            try {
              const sitterProfile = await getUser(user.uid);
              const sitterName = sitterProfile?.displayName ?? 'Your sitter';

              // Format dates
              const startStr = swap.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const endStr = swap.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const compensationLabel = sitterPref === 'points'
                ? `${swap.pointsCost.toFixed(1)} points`
                : `$${swap.paymentOffered}`;

              const notificationText = `🎉 ${sitterName} has accepted your swap request! They chose ${compensationLabel}. Dates: ${startStr} – ${endStr}.`;

              // Get or create conversation between sitter and owner
              const convId = await getOrCreateConversation(user.uid, swap.requesterId, swap.id);
              await sendMessage(convId, user.uid, notificationText);
            } catch {
              // Non-fatal: accept went through even if notification fails
            }

            fetchSwaps();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
          }
        },
      },
    ]);
  };

  const incoming = swaps.filter((s) => s.receiverId === user?.uid);
  const outgoing = swaps.filter((s) => s.requesterId === user?.uid);
  const displayed = tab === 'incoming' ? incoming : outgoing;

  const renderSwap = ({ item }: { item: SwapRequest }) => {
    const dogIds = item.requesterDogIds;
    const representativeDog: Dog | undefined = dogIds
      .map((id) => dogMap[id])
      .find(Boolean);

    const showPreferenceChoice =
      tab === 'incoming' &&
      item.status === SwapStatus.pending &&
      item.paymentType === 'either';

    const selectedPref = pendingPreferences[item.id];

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

        {/* Points & payment info */}
        <View style={styles.compensationRow}>
          <View style={[styles.compensationBadge, { backgroundColor: '#FF6B6B18', borderColor: '#FF6B6B' }]}>
            <Text style={[styles.compensationBadgeText, { color: '#FF6B6B' }]}>
              🪙 {item.pointsCost.toFixed(1)} pts
            </Text>
          </View>
          {item.paymentOffered !== undefined && item.paymentOffered > 0 && (
            <View style={[styles.compensationBadge, { backgroundColor: '#00B89418', borderColor: '#00B894' }]}>
              <Text style={[styles.compensationBadgeText, { color: '#00B894' }]}>
                💰 ${item.paymentOffered} also offered
              </Text>
            </View>
          )}
          {item.sitterPreference && (
            <View style={[styles.compensationBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.compensationBadgeText, { color: colors.textSecondary }]}>
                {item.sitterPreference === 'points' ? '🪙 Sitter chose points' : '💰 Sitter chose payment'}
              </Text>
            </View>
          )}
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

        {/* Sitter preference selection (required when paymentType === 'either') */}
        {showPreferenceChoice && (
          <View style={[styles.preferenceSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.preferenceTitle, { color: colors.text }]}>
              How would you like to be compensated?
            </Text>
            <TouchableOpacity
              style={[
                styles.radioOption,
                {
                  borderColor: selectedPref === 'points' ? '#FF6B6B' : colors.border,
                  backgroundColor: selectedPref === 'points' ? '#FF6B6B18' : colors.surface,
                },
              ]}
              onPress={() => {
                setPendingPreferences((prev) => ({ ...prev, [item.id]: 'points' }));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel={`Take points: ${item.pointsCost.toFixed(1)} pts`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedPref === 'points' }}
            >
              <View style={[styles.radioCircle, { borderColor: selectedPref === 'points' ? '#FF6B6B' : colors.border }]}>
                {selectedPref === 'points' && <View style={[styles.radioFill, { backgroundColor: '#FF6B6B' }]} />}
              </View>
              <Text style={[styles.radioLabel, { color: colors.text }]}>
                🪙 I'll take points ({item.pointsCost.toFixed(1)} pts)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioOption,
                {
                  borderColor: selectedPref === 'payment' ? '#00B894' : colors.border,
                  backgroundColor: selectedPref === 'payment' ? '#00B89418' : colors.surface,
                },
              ]}
              onPress={() => {
                setPendingPreferences((prev) => ({ ...prev, [item.id]: 'payment' }));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel={`Take payment: $${item.paymentOffered}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedPref === 'payment' }}
            >
              <View style={[styles.radioCircle, { borderColor: selectedPref === 'payment' ? '#00B894' : colors.border }]}>
                {selectedPref === 'payment' && <View style={[styles.radioFill, { backgroundColor: '#00B894' }]} />}
              </View>
              <Text style={[styles.radioLabel, { color: colors.text }]}>
                💰 I'll take payment (${item.paymentOffered})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          {tab === 'incoming' && item.status === SwapStatus.pending && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: colors.success,
                    opacity: showPreferenceChoice && !selectedPref ? 0.5 : 1,
                  },
                ]}
                onPress={() => handleAccept(item)}
                accessibilityLabel="Accept swap request"
                accessibilityRole="button"
              >
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.error }]}
                onPress={() => handleDecline(item.id)}
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
              onPress={() => handleCancel(item.id)}
              accessibilityLabel="Cancel swap request"
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {item.status === SwapStatus.accepted && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={() => handleComplete(item.id)}
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
  // Compensation
  compensationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  compensationBadge: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  compensationBadgeText: { fontSize: 12, fontWeight: '600' },
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
  // Preference section
  preferenceSection: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  preferenceTitle: { fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  // Actions
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

export default RequestsScreen;
