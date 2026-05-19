import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useDogs } from '../../hooks/useDogs';
import { getReferralCount } from '../../hooks/useReferrals';
import { Dog } from '../../models/types';
import { spacing, borderRadius, typography, shadow } from '../../config/theme';
import { formatDogAge } from '../../utils/formatDogAge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
};

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userProfile, user } = useAuthContext();
  const { signOut } = useAuth();
  const { getDogsByOwner, updateDog } = useDogs();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCount, setReferralCount] = useState(0);
  const [uploadingDogId, setUploadingDogId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getDogsByOwner(user.uid).then(setDogs).finally(() => setLoading(false));
    getReferralCount(user.uid).then(setReferralCount);
  }, [user]);

  const refreshDogs = () => {
    if (!user) return;
    getDogsByOwner(user.uid).then(setDogs);
  };

  const handleAddDogPhoto = async (dogId: string, currentPhotos: string[]) => {
    if (currentPhotos.length >= 10) {
      Alert.alert('Limit reached', 'You can add up to 10 photos per dog');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingDogId(dogId);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileRef = storageRef(storage, `dogs/${dogId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(fileRef);
      const newPhotos = [...currentPhotos, downloadURL].slice(0, 10);
      await updateDog(dogId, { photoURLs: newPhotos });
      refreshDogs();
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingDogId(null);
    }
  };

  const handleReplacePhoto = async (dogId: string, currentPhotos: string[], index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingDogId(dogId);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileRef = storageRef(storage, `dogs/${dogId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(fileRef);
      const newPhotos = [...currentPhotos];
      newPhotos[index] = downloadURL;
      await updateDog(dogId, { photoURLs: newPhotos });
      refreshDogs();
    } catch {
      Alert.alert('Error', 'Failed to replace photo. Please try again.');
    } finally {
      setUploadingDogId(null);
    }
  };

  const handlePhotoTap = (dogId: string, currentPhotos: string[], index: number) => {
    Alert.alert(
      'Edit Photo',
      '',
      [
        {
          text: 'Replace / Crop Photo',
          onPress: () => { void handleReplacePhoto(dogId, currentPhotos, index); },
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () => { void handleRemoveDogPhoto(dogId, currentPhotos, index); },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleRemoveDogPhoto = async (dogId: string, currentPhotos: string[], index: number) => {
    const newPhotos = currentPhotos.filter((_, i) => i !== index);
    try {
      await updateDog(dogId, { photoURLs: newPhotos });
      refreshDogs();
    } catch {
      Alert.alert('Error', 'Failed to remove photo.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleCommunityStandards = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CommunityStandards');
  };

  const handleMyAgreement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('MyAgreement');
  };

  const handleInviteFriend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Referral');
  };

  if (loading) return <LoadingSpinner />;

  const hasContract = !!userProfile?.contractSignedAt;

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
        {/* Points balance badge */}
        <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}>
          <Text style={[styles.pointsBadgeText, { color: colors.primary }]}>
            🪙 {(userProfile?.points ?? 0).toFixed(1)} points
          </Text>
        </View>
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
          <View key={dog.id} style={[styles.dogCard, { backgroundColor: colors.surface, ...shadow.sm }]}>
            {/* Info row — tap to edit */}
            <TouchableOpacity
              onPress={() => navigation.navigate('EditDog', { dogId: dog.id })}
              accessibilityLabel={`${dog.name}, ${dog.breed}. Tap to edit.`}
              accessibilityRole="button"
            >
              <Text style={[styles.dogName, { color: colors.text }]}>{dog.name}</Text>
              <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dog.breed} • {formatDogAge(dog.ageYears, dog.ageMonths)}</Text>
            </TouchableOpacity>

            {/* Photo gallery row */}
            <View style={styles.dogPhotoRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dogPhotoScroll}>
                {dog.photoURLs.map((uri, idx) => (
                  <TouchableOpacity
                    key={uri + idx}
                    style={styles.dogPhotoThumbWrap}
                    onPress={() => handlePhotoTap(dog.id, dog.photoURLs, idx)}
                    accessibilityLabel={`Edit ${dog.name} photo ${idx + 1}`}
                    accessibilityRole="button"
                  >
                    <Image
                      source={{ uri }}
                      style={styles.dogPhotoThumb}
                      accessibilityLabel={`${dog.name} photo ${idx + 1}`}
                    />
                    <View style={[styles.dogPhotoRemoveBtn, { backgroundColor: colors.error }]}>
                      <Text style={styles.dogPhotoRemoveText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {/* Plus-sign tile — always at end of photo scroll */}
                <TouchableOpacity
                  style={[styles.dogPhotoAddTile, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => { void handleAddDogPhoto(dog.id, dog.photoURLs); }}
                  disabled={uploadingDogId === dog.id}
                  accessibilityLabel={`Add photos for ${dog.name}`}
                  accessibilityRole="button"
                >
                  {uploadingDogId === dog.id ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={[styles.dogPhotoAddIcon, { color: colors.textSecondary }]}>+</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Referrals</Text>
        <TouchableOpacity
          style={[styles.prefRow, { backgroundColor: colors.surface, ...shadow.sm }]}
          onPress={handleInviteFriend}
          accessibilityLabel="Invite a Friend"
          accessibilityRole="button"
        >
          <Text style={[styles.prefLabel, { color: colors.text }]}>🎁 Invite a Friend</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {referralCount > 0 && (
              <View style={[styles.referralBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.referralBadgeText}>{referralCount} {referralCount === 1 ? 'referral' : 'referrals'}</Text>
              </View>
            )}
            <Text style={[styles.prefChevron, { color: colors.textSecondary }]}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Community</Text>
        <TouchableOpacity
          style={[styles.prefRow, { backgroundColor: colors.surface, ...shadow.sm }]}
          onPress={handleCommunityStandards}
          accessibilityLabel="View SwapDog Community Standards"
          accessibilityRole="button"
        >
          <Text style={[styles.prefLabel, { color: colors.text }]}>🐾 Community Standards</Text>
          <Text style={[styles.prefChevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
        {hasContract && (
          <TouchableOpacity
            style={[styles.prefRow, { backgroundColor: colors.surface, ...shadow.sm }]}
            onPress={handleMyAgreement}
            accessibilityLabel="View My Membership Agreement"
            accessibilityRole="button"
          >
            <Text style={[styles.prefLabel, { color: colors.text }]}>📜 My Agreement</Text>
            <Text style={[styles.prefChevron, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        )}
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
  header: { alignItems: 'center', padding: spacing.lg },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: spacing.sm },
  name: { ...typography.h2, marginBottom: spacing.xs },
  location: { fontSize: 14, marginBottom: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  ratingCount: { fontSize: 13, marginLeft: spacing.xs },
  bio: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  pointsBadge: {
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  pointsBadgeText: { fontSize: 16, fontWeight: '700' },
  editBtn: { borderWidth: 1.5, borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: spacing.md },
  editBtnText: { fontWeight: '600' },
  section: { padding: spacing.lg },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  dogCard: { padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  dogName: { fontSize: 16, fontWeight: '700' },
  dogBreed: { fontSize: 13, marginTop: 2 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  prefLabel: { fontSize: 15 },
  prefValue: { fontSize: 15 },
  prefChevron: { fontSize: 22, fontWeight: '300' },
  referralBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  referralBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Dog photo gallery
  dogPhotoRow: { marginTop: spacing.sm },
  dogPhotoScroll: { marginBottom: spacing.xs },
  dogPhotoThumbWrap: {
    width: 80,
    height: 80,
    marginRight: spacing.xs,
    borderRadius: borderRadius.sm,
    overflow: 'visible',
  },
  dogPhotoThumb: { width: 80, height: 80, borderRadius: borderRadius.sm },
  dogPhotoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogPhotoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dogPhotoAddTile: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  dogPhotoAddIcon: { fontSize: 22, fontWeight: '300', lineHeight: 26 },
  signOutBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  signOutText: { color: '#fff', ...typography.button },
});

export default ProfileScreen;
