import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useDogs } from '../../hooks/useDogs';
import { Dog } from '../../models/types';
import { spacing, borderRadius, typography, shadow } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
};

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userProfile, user } = useAuthContext();
  const { signOut } = useAuth();
  const { getDogsByOwner } = useDogs();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) getDogsByOwner(user.uid).then(setDogs).finally(() => setLoading(false));
  }, [user]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Image
          source={userProfile?.photoURL ? { uri: userProfile.photoURL } : require('../../../assets/icon.png')}
          style={styles.avatar}
          accessibilityLabel="Your profile photo"
        />
        <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">
          {userProfile?.displayName ?? 'User'}
        </Text>
        {userProfile?.locationName && (
          <Text style={[styles.location, { color: colors.textSecondary }]}>📍 {userProfile.locationName}</Text>
        )}
        {userProfile?.rating !== undefined && (
          <View style={styles.ratingRow}>
            <StarRating rating={Math.round(userProfile.rating)} />
            <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({userProfile.reviewCount ?? 0})</Text>
          </View>
        )}
        {userProfile?.bio && <Text style={[styles.bio, { color: colors.textSecondary }]}>{userProfile.bio}</Text>}
        <TouchableOpacity
          style={[styles.editBtn, { borderColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('EditProfile'); }}
          accessibilityLabel="Edit profile"
          accessibilityRole="button"
        >
          <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>My Dogs</Text>
        {dogs.map((dog) => (
          <TouchableOpacity
            key={dog.id}
            style={[styles.dogCard, { backgroundColor: colors.surface, ...shadow.sm }]}
            onPress={() => navigation.navigate('EditDog', { dogId: dog.id })}
            accessibilityLabel={`${dog.name}, ${dog.breed}. Tap to edit.`}
            accessibilityRole="button"
          >
            <Text style={[styles.dogName, { color: colors.text }]}>{dog.name}</Text>
            <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dog.breed} • {dog.age}y</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        <TouchableOpacity
          style={[styles.prefRow, { backgroundColor: colors.surface }]}
          onPress={toggleTheme}
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          accessibilityRole="switch"
          accessibilityState={{ checked: isDark }}
        >
          <Text style={[styles.prefLabel, { color: colors.text }]}>{isDark ? '🌙' : '☀️'} Dark Mode</Text>
          <Text style={[styles.prefValue, { color: colors.textSecondary }]}>{isDark ? 'On' : 'Off'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, { backgroundColor: colors.error }]}
        onPress={handleSignOut}
        accessibilityLabel="Sign out"
        accessibilityRole="button"
        accessibilityHint="Signs you out of your SwapDog account"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', padding: spacing.lg, paddingTop: 60 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: spacing.sm },
  name: { ...typography.h2, marginBottom: spacing.xs },
  location: { fontSize: 14, marginBottom: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  ratingCount: { fontSize: 13, marginLeft: spacing.xs },
  bio: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  editBtn: { borderWidth: 1.5, borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: spacing.md },
  editBtnText: { fontWeight: '600' },
  section: { padding: spacing.lg },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  dogCard: { padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  dogName: { fontSize: 16, fontWeight: '700' },
  dogBreed: { fontSize: 13, marginTop: 2 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderRadius: borderRadius.md },
  prefLabel: { fontSize: 15 },
  prefValue: { fontSize: 15 },
  signOutBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  signOutText: { color: '#fff', ...typography.button },
});

export default ProfileScreen;
