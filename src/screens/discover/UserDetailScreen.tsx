import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { DiscoverStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { useDogs } from '../../hooks/useDogs';
import { useSwaps } from '../../hooks/useSwaps';
import { useMessaging } from '../../hooks/useMessaging';
import { User, Dog, SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import { formatDogAge } from '../../utils/formatDogAge';
import StarRating from '../../components/common/StarRating';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'UserDetail'>;
  route: RouteProp<DiscoverStackParamList, 'UserDetail'>;
};

/** Build the message text for a SwapPost share */
function buildPostMessage(post: SwapPost): string {
  const start = post.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = post.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    `🐾 Hey! I posted a request for dog sitting — check it out!\n\n` +
    `🐶 Dog: ${post.dogName}${post.dogBreed ? ` (${post.dogBreed})` : ''}\n` +
    `📅 Dates: ${start} – ${end}\n` +
    `📝 Details: ${post.careDetails}`
  );
}

const UserDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { userProfile: me } = useAuthContext();
  const { getUser } = useUsers();
  const { getDogsByOwner } = useDogs();
  const { getMyPosts } = useSwaps();
  const { getOrCreateConversation, sendMessage } = useMessaging();

  const [user, setUser] = useState<User | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [myOpenPost, setMyOpenPost] = useState<SwapPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [u, d] = await Promise.all([
        getUser(route.params.userId),
        getDogsByOwner(route.params.userId),
      ]);
      setUser(u);
      setDogs(d);

      // Load the current user's open post (if any)
      if (me?.id) {
        const myPosts = await getMyPosts(me.id);
        const open = myPosts.find((p) => p.status === 'open') ?? null;
        setMyOpenPost(open);
      }
      setLoading(false);
    };
    void load();
  }, [route.params.userId, me?.id]);

  const handleSendPost = async () => {
    if (!me?.id || !user || !myOpenPost) return;
    setSending(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const convId = await getOrCreateConversation(me.id, user.id);
      await sendMessage(convId, me.id, buildPostMessage(myOpenPost));
      // Navigate to the chat
      navigation.navigate('Discover'); // pop to Discover first, then navigate via parent
      // Use the Messages tab instead — navigate directly
      // We rely on the parent navigator's navigate approach
      Alert.alert(
        'Post Sent! 🐾',
        `Your post was sent to ${user.displayName}. Check Messages to continue the conversation.`,
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Error', 'Failed to send post. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  const showSendButton = me && me.id !== user.id;

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
            <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dog.breed} • {formatDogAge(dog.ageYears, dog.ageMonths)} • {dog.size}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showSendButton && (
        <View style={styles.section}>
          {myOpenPost ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: sending ? 0.7 : 1 }]}
              onPress={() => { void handleSendPost(); }}
              disabled={sending}
              accessibilityLabel={`Send your post to ${user.displayName}`}
              accessibilityRole="button"
              accessibilityHint="Sends your active post and opens a chat"
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>📩 Send My Post</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.disabledBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.disabledBannerText, { color: colors.textSecondary }]}>
                Post a request first to connect with {user.displayName}
              </Text>
            </View>
          )}
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
  actionBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  actionBtnText: { color: '#fff', ...typography.button },
  disabledBanner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  disabledBannerText: { fontSize: 14, textAlign: 'center' },
});

export default UserDetailScreen;
