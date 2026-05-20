import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { auth } from '../../config/firebase';
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

  /**
   * Upload a local image URI to Firebase Storage via REST API + expo-file-system.
   *
   * Bypasses the Firebase JS SDK entirely — avoids the "Creating blobs from ArrayBuffer
   * and ArrayBufferView are not supported" error that breaks all SDK upload paths in RN.
   */
  const uploadPhotoToStorage = async (uri: string, storagePath: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();

    const bucket = 'swapdog-d0cfe.firebasestorage.app';
    const encodedPath = encodeURIComponent(storagePath);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`;

    console.log('[PhotoUpload] Uploading via REST to:', uploadUrl);
    console.log('[PhotoUpload] URI:', uri);

    const uploadResult = await uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
      },
    });

    console.log('[PhotoUpload] Upload status:', uploadResult.status);

    if (uploadResult.status !== 200) {
      console.error('[PhotoUpload] Upload failed:', uploadResult.body);
      throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
    }

    const data = JSON.parse(uploadResult.body) as { downloadTokens: string };
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${data.downloadTokens}`;
    console.log('[PhotoUpload] Download URL:', downloadURL);
    return downloadURL;
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
      const uri = result.assets[0].uri;
      const storagePath = `dogs/${dogId}/${Date.now()}.jpg`;
      const downloadURL = await uploadPhotoToStorage(uri, storagePath);
      const newPhotos = [...currentPhotos, downloadURL].slice(0, 10);

      // Update Firestore
      try {
        await updateDog(dogId, { photoURLs: newPhotos });
      } catch (firestoreErr) {
        console.error('[PhotoUpload] Step 4 Firestore update failed:', firestoreErr);
        throw new Error('Photo uploaded but profile could not be updated. Try again.');
      }

      refreshDogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('[PhotoUpload] handleAddDogPhoto error:', err);
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploadingDogId(null);
    }
  };

  // Tap photo → open crop editor directly (like Hinge/Bumble)
  const handlePhotoTap = async (dogId: string, currentPhotos: string[], index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingDogId(dogId);
    try {
      const uri = result.assets[0].uri;
      const storagePath = `dogs/${dogId}/${Date.now()}.jpg`;
      const downloadURL = await uploadPhotoToStorage(uri, storagePath);
      const newPhotos = [...currentPhotos];
      newPhotos[index] = downloadURL;

      try {
        await updateDog(dogId, { photoURLs: newPhotos });
      } catch (firestoreErr) {
        console.error('[PhotoUpload] handlePhotoTap Firestore update failed:', firestoreErr);
        throw new Error('Photo uploaded but profile could not be updated. Try again.');
      }

      refreshDogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('[PhotoUpload] handlePhotoTap error:', err);
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploadingDogId(null);
    }
  };

  // SUB-TASK 1: Long-press → Remove photo alert
  const handleLongPressPhoto = (dogId: string, currentPhotos: string[], index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Photo',
      'Remove this photo from your dog\'s profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => { void handleRemoveDogPhoto(dogId, currentPhotos, index); },
        },
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

  const handleAdminPanel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AdminPanel');
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

        {/* SUB-TASK 3: Points badge — tappable → PointsHistory */}
        <TouchableOpacity
          style={[styles.pointsBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('PointsHistory'); }}
          accessibilityLabel={`${(userProfile?.points ?? 0).toFixed(1)} points. Tap to see history.`}
          accessibilityRole="button"
        >
          <Text style={[styles.pointsBadgeText, { color: colors.primary }]}>
            🪙 {(userProfile?.points ?? 0).toFixed(1)} points ›
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('EditProfile'); }}
          accessibilityLabel="Edit profile"
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>Edit Profile</Text>
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
                    onPress={() => { void handlePhotoTap(dog.id, dog.photoURLs, idx); }}
                    onLongPress={() => handleLongPressPhoto(dog.id, dog.photoURLs, idx)}
                    delayLongPress={400}
                    accessibilityLabel={`Tap to crop ${dog.name} photo ${idx + 1}. Hold to remove.`}
                    accessibilityRole="button"
                  >
                    {uploadingDogId === dog.id ? (
                      <View style={[styles.dogPhotoThumb, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                        <ActivityIndicator color={colors.primary} size="small" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri }}
                        style={styles.dogPhotoThumb}
                        accessibilityLabel={`${dog.name} photo ${idx + 1}`}
                      />
                    )}
                    {/* Edit overlay indicator */}
                    <View style={styles.dogPhotoCropHint}>
                      <Text style={styles.dogPhotoCropHintText}>✎</Text>
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

        {/* SUB-TASK 2a: Add Another Dog button */}
        <TouchableOpacity
          style={[styles.addAnotherDogBtn, { borderColor: '#888' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('EditDog', {});
          }}
          accessibilityLabel="Add another dog"
          accessibilityRole="button"
        >
          <Text style={[styles.addAnotherDogBtnText, { color: '#999' }]}>+ Add Another Dog</Text>
        </TouchableOpacity>
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

      {/* Admin Panel — only visible to admin */}
      {userProfile?.isAdmin === true && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Admin</Text>
          <TouchableOpacity
            style={[styles.prefRow, { backgroundColor: '#3D2E00', borderWidth: 1.5, borderColor: '#FFD700' }]}
            onPress={handleAdminPanel}
            accessibilityLabel="Open Admin Panel"
            accessibilityRole="button"
          >
            <Text style={[styles.prefLabel, { color: '#FFD700' }]}>👑 Admin Panel</Text>
            <Text style={[styles.prefChevron, { color: '#FFD700' }]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

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
  editBtn: { paddingVertical: spacing.xs, marginTop: spacing.md },
  editBtnText: { fontWeight: '600', fontSize: 15, color: '#FFFFFF' },
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
    overflow: 'hidden',
  },
  dogPhotoThumb: { width: 80, height: 80, borderRadius: borderRadius.sm },
  dogPhotoCropHint: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogPhotoCropHintText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
  // Add Another Dog button
  addAnotherDogBtn: {
    borderWidth: 2,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addAnotherDogBtnText: { fontSize: 15, fontWeight: '700' },
  signOutBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  signOutText: { color: '#fff', ...typography.button },
});

export default ProfileScreen;
