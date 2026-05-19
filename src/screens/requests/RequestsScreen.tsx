/**
 * RequestsScreen — two tabs:
 *   "Area Posts"  : feed of open posts from people in the user's area
 *   "My Posts"    : the user's own posts so they can see responses / cancel
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'Requests'>;
};

type TabType = 'area' | 'mine';

const RequestsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { getAreaPosts, getMyPosts, cancelPost } = useSwaps();

  const [tab, setTab] = useState<TabType>('area');
  const [areaPosts, setAreaPosts] = useState<SwapPost[]>([]);
  const [myPosts, setMyPosts] = useState<SwapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    try {
      // Get user location for distance filtering
      let location: { latitude: number; longitude: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      } catch {
        // proceed without location
      }

      const [area, mine] = await Promise.all([
        getAreaPosts(location, 25),
        getMyPosts(user.uid),
      ]);

      // Exclude own posts from area feed
      setAreaPosts(area.filter((p) => p.posterId !== user.uid));
      setMyPosts(mine);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchPosts(); }, [fetchPosts]));

  const handleCancel = async (postId: string) => {
    Alert.alert('Cancel Post', 'Remove your post from the area feed?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Post',
        style: 'destructive',
        onPress: async () => {
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
      const unitLabel = post.paymentRate === 'per_hour'
        ? `${post.totalUnits} hr${post.totalUnits !== 1 ? 's' : ''}`
        : `${post.totalUnits} day${post.totalUnits !== 1 ? 's' : ''}`;
      return `💰 $${post.totalPayment} total ($${post.paymentAmount}${rateLabel} × ${unitLabel})`;
    }
    return '💰 Payment offered';
  };

  const renderAreaPost = ({ item }: { item: SwapPost }) => {
    const startStr = item.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = item.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const isPayment = item.compensationType === 'payment' || item.compensationType === 'either';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, ...shadow.sm }]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.posterName}'s post for ${item.dogName}`}
      >
        {/* Poster header */}
        <View style={styles.cardHeader}>
          {item.posterPhotoURL ? (
            <Image source={{ uri: item.posterPhotoURL }} style={[styles.avatarSmall, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '22' }]}>
              <Text style={styles.avatarEmoji}>🧑</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.posterName, { color: colors.text }]}>{item.posterName}</Text>
            <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
              {startStr} – {endStr}
            </Text>
          </View>
          {item.dogPhotoURL ? (
            <Image source={{ uri: item.dogPhotoURL }} style={[styles.dogThumbSmall, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.dogThumbPlaceholder, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.dogThumbEmoji}>🐕</Text>
            </View>
          )}
        </View>

        {/* Dog info */}
        <Text style={[styles.dogLine, { color: colors.text }]}>
          {item.dogName}{item.dogBreed ? ` · ${item.dogBreed}` : ''}
        </Text>

        {/* Compensation */}
        <View style={[styles.compBadge, {
          backgroundColor: isPayment ? '#00B89418' : colors.primary + '18',
          borderColor: isPayment ? '#00B894' : colors.primary,
        }]}>
          <Text style={[styles.compBadgeText, { color: isPayment ? '#00B894' : colors.primary }]}>
            {compensationLabel(item)}
          </Text>
        </View>

        {/* Off-app note if payment */}
        {isPayment && (
          <Text style={[styles.offAppInline, { color: colors.textSecondary }]}>
            💰 Payments made outside SwapDog
          </Text>
        )}

        {/* Care details preview */}
        <Text style={[styles.carePreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.careDetails}
        </Text>

        <Text style={[styles.tapHint, { color: colors.primary }]}>Tap to see full details →</Text>
      </TouchableOpacity>
    );
  };

  const renderMyPost = ({ item }: { item: SwapPost }) => {
    const startStr = item.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = item.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const isOpen = item.status === 'open';
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

        <View style={[styles.compBadge, {
          backgroundColor: item.compensationType !== 'points' ? '#00B89418' : colors.primary + '18',
          borderColor: item.compensationType !== 'points' ? '#00B894' : colors.primary,
        }]}>
          <Text style={[styles.compBadgeText, { color: item.compensationType !== 'points' ? '#00B894' : colors.primary }]}>
            {compensationLabel(item)}
          </Text>
        </View>

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

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['area', 'mine'] as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
            accessibilityLabel={t === 'area' ? 'Area Posts' : 'My Posts'}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textSecondary }]}>
              {t === 'area' ? '📍 Area Posts' : '📋 My Posts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Post Request FAB */}
      {(tab === 'area' || tab === 'mine') && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('CreatePost')}
          accessibilityLabel="Post a request"
          accessibilityRole="button"
        >
          <Text style={styles.fabText}>+ Post a Request</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={tab === 'area' ? areaPosts : myPosts}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} />}
        ListEmptyComponent={
          tab === 'area'
            ? <EmptyStateView emoji="📍" title="No posts nearby" subtitle="Be the first — post a request for your area!" />
            : <EmptyStateView emoji="📋" title="No posts yet" subtitle="Post a request and local sitters will reach out" />
        }
        renderItem={tab === 'area' ? renderAreaPost : renderMyPost}
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
  list: { padding: spacing.md, paddingBottom: spacing.xl * 3 },
  // Card
  card: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 18 },
  headerInfo: { flex: 1 },
  posterName: { fontSize: 15, fontWeight: '700' },
  dateRange: { fontSize: 12, marginTop: 1 },
  dogThumbSmall: { width: 44, height: 44, borderRadius: borderRadius.sm, borderWidth: 1 },
  dogThumbPlaceholder: { width: 44, height: 44, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  dogThumbEmoji: { fontSize: 20 },
  dogLine: { fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  compBadge: { borderWidth: 1.5, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: spacing.xs },
  compBadgeText: { fontSize: 13, fontWeight: '700' },
  offAppInline: { fontSize: 11, marginBottom: spacing.xs },
  carePreview: { fontSize: 13, lineHeight: 18, marginBottom: spacing.xs },
  tapHint: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  cancelBtn: { borderWidth: 1.5, borderRadius: borderRadius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignSelf: 'flex-start', marginTop: spacing.xs },
  cancelBtnText: { fontSize: 13, fontWeight: '600' },
  // FAB
  fab: { flexDirection: 'row', alignSelf: 'flex-end', margin: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default RequestsScreen;
