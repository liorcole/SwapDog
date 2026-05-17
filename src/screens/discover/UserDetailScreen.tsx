import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { DiscoverStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { useDogs } from '../../hooks/useDogs';
import { User, Dog } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import StarRating from '../../components/common/StarRating';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'UserDetail'>;
  route: RouteProp<DiscoverStackParamList, 'UserDetail'>;
};

const UserDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { userProfile: me } = useAuthContext();
  const { getUser } = useUsers();
  const { getDogsByOwner } = useDogs();
  const [user, setUser] = useState<User | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUser(route.params.userId), getDogsByOwner(route.params.userId)])
      .then(([u, d]) => { setUser(u); setDogs(d); })
      .finally(() => setLoading(false));
  }, [route.params.userId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, ...shadow.sm }]}>
        <Image
          source={user.photoURL ? { uri: user.photoURL } : require('../../../assets/icon.png')}
          style={styles.avatar}
          accessibilityLabel={`${user.displayName}'s profile photo`}
        />
        <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">{user.displayName}</Text>
        {user.locationName && (
          <Text style={[styles.location, { color: colors.textSecondary }]}>📍 {user.locationName}</Text>
        )}
        {user.rating !== undefined && (
          <View style={styles.ratingRow}>
            <StarRating rating={Math.round(user.rating)} />
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>({user.reviewCount ?? 0} reviews)</Text>
          </View>
        )}
        {user.bio && <Text style={[styles.bio, { color: colors.textSecondary }]}>{user.bio}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Dogs</Text>
        {dogs.map((dog) => (
          <TouchableOpacity
            key={dog.id}
            style={[styles.dogCard, { backgroundColor: colors.surface, ...shadow.sm }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('DogDetail', { dogId: dog.id }); }}
            accessibilityLabel={`${dog.name}, ${dog.breed}. Tap to view dog profile.`}
            accessibilityRole="button"
          >
            <Text style={[styles.dogName, { color: colors.text }]}>{dog.name}</Text>
            <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dog.breed} • {dog.age}y • {dog.size}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {me && me.id !== user.id && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.swapBtn, { backgroundColor: colors.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('CreateSwap', { userId: user.id }); }}
            accessibilityLabel={`Request swap with ${user.displayName}`}
            accessibilityRole="button"
            accessibilityHint="Opens the swap request form"
          >
            <Text style={styles.swapBtnText}>Request Swap 🔄</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', padding: spacing.lg },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: spacing.sm },
  name: { ...typography.h2, marginBottom: spacing.xs },
  location: { fontSize: 14, marginBottom: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  ratingText: { fontSize: 13, marginLeft: spacing.xs },
  bio: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  section: { padding: spacing.lg },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  dogCard: { padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  dogName: { fontSize: 16, fontWeight: '700' },
  dogBreed: { fontSize: 13, marginTop: 2 },
  swapBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  swapBtnText: { color: '#fff', ...typography.button },
});

export default UserDetailScreen;
