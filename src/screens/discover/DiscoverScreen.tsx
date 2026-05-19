import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Animated, Image, RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { DiscoverStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUsers } from '../../hooks/useUsers';
import { User } from '../../models/types';
import { spacing, borderRadius, shadow } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';
import ShimmerLoading from '../../components/common/ShimmerLoading';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'Discover'>;
};

const UserCard: React.FC<{ user: User; onPress: () => void; index: number }> = ({ user, onPress, index }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, ...shadow.md }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        accessibilityLabel={`${user.displayName}'s profile`}
        accessibilityRole="button"
        accessibilityHint="Opens this user's full profile"
      >
        <Image
          source={user.photoURL ? { uri: user.photoURL } : require('../../../assets/icon.png')}
          style={styles.avatar}
          accessibilityLabel={`${user.displayName}'s profile photo`}
        />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{user.displayName}</Text>
          {user.locationName && (
            <Text style={[styles.location, { color: colors.textSecondary }]}>📍 {user.locationName}</Text>
          )}
          {user.bio && <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>{user.bio}</Text>}
          {user.rating !== undefined && (
            <Text style={[styles.rating, { color: colors.warning }]}>⭐ {user.rating.toFixed(1)}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DiscoverScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { userProfile } = useAuthContext();
  const { getUsersByLocation } = useUsers();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const center = userProfile?.location ?? { latitude: 37.7749, longitude: -122.4194 };
      const results = await getUsersByLocation(center, 50);
      setUsers(results.filter((u) => u.id !== userProfile?.id));
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [userProfile]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ margin: spacing.md }}>
            <ShimmerLoading height={80} borderRadius={12} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} />}
        ListEmptyComponent={<EmptyStateView emoji="🐕" title="No dog owners nearby" subtitle="Try expanding your search radius" />}
        renderItem={({ item, index }) => (
          <UserCard
            user={item}
            index={index}
            onPress={() => navigation.navigate('UserDetail', { userId: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.md },
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: spacing.md },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  location: { fontSize: 13, marginBottom: 2 },
  bio: { fontSize: 13, marginBottom: 2 },
  rating: { fontSize: 13 },
});

export default DiscoverScreen;
