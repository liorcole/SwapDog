import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { useDogs } from '../../hooks/useDogs';
import { Dog, DogSize, DogSex, EnergyLevel } from '../../models/types';
import { spacing, borderRadius, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Chip from '../../components/common/Chip';

const MAX_PHOTOS = 10;

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'EditDog'>;
  route: RouteProp<ProfileStackParamList, 'EditDog'>;
};

const EditDogScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { getDog, updateDog, deleteDog } = useDogs();
  const [dog, setDog] = useState<Dog | null>(null);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonths, setAgeMonths] = useState(0);
  const [size, setSize] = useState<DogSize>(DogSize.medium);
  const [sex, setSex] = useState<DogSex>(DogSex.male);
  const [energy, setEnergy] = useState<EnergyLevel>(EnergyLevel.moderate);
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDog(route.params.dogId).then((d) => {
      if (d) {
        setDog(d);
        setName(d.name);
        setBreed(d.breed);
        setAgeYears(d.ageYears);
        setAgeMonths(d.ageMonths);
        setSize(d.size);
        setSex(d.sex);
        setEnergy(d.energyLevel);
        setPhotoURLs(d.photoURLs);
      }
      setLoading(false);
    });
  }, [route.params.dogId]);

  const pickPhoto = async () => {
    if (photoURLs.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotoURLs((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setPhotoURLs((prev) => prev.filter((_, i) => i !== index));
  };

  const setPrimary = (index: number) => {
    if (index === 0) return;
    setPhotoURLs((prev) => {
      const next = [...prev];
      const [selected] = next.splice(index, 1);
      next.unshift(selected);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Dog name is required'); return; }
    setSaving(true);
    try {
      await updateDog(route.params.dogId, {
        name: name.trim(),
        breed: breed.trim(),
        ageYears,
        ageMonths,
        size,
        sex,
        energyLevel: energy,
        photoURLs,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Dog', `Remove ${dog?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteDog(route.params.dogId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>

      {/* Photo grid */}
      <Text style={[styles.label, { color: colors.text }]}>Photos ({photoURLs.length}/{MAX_PHOTOS})</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>Long-press a photo to set as primary</Text>
      <View style={styles.photoGrid}>
        {photoURLs.map((uri, index) => (
          <View key={uri + index} style={styles.photoThumb}>
            <TouchableOpacity
              onLongPress={() => setPrimary(index)}
              accessibilityLabel={index === 0 ? 'Primary photo, long-press to reorder' : `Photo ${index + 1}, long-press to set as primary`}
            >
              <Image source={{ uri }} style={styles.thumbImg} />
            </TouchableOpacity>
            {index === 0 && (
              <View style={[styles.primaryBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: colors.error }]}
              onPress={() => removePhoto(index)}
              accessibilityLabel={`Remove photo ${index + 1}`}
              accessibilityRole="button"
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photoURLs.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[styles.addPhotoTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickPhoto}
            accessibilityLabel={`Add photo. ${MAX_PHOTOS - photoURLs.length} remaining`}
            accessibilityRole="button"
          >
            <Text style={[styles.addPhotoIcon, { color: colors.primary }]}>+</Text>
            <Text style={[styles.addPhotoLabel, { color: colors.textSecondary }]}>
              {photoURLs.length}/{MAX_PHOTOS}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={name}
        onChangeText={setName}
        placeholder="Dog name"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Dog name"
      />
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={breed}
        onChangeText={setBreed}
        placeholder="Breed"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Dog breed"
      />

      {/* Age pickers */}
      <Text style={[styles.label, { color: colors.text }]}>Age</Text>
      <View style={styles.ageRow}>
        <View style={styles.agePicker}>
          <Text style={[styles.agePickerLabel, { color: colors.textSecondary }]}>Years</Text>
          <View style={styles.ageControls}>
            <TouchableOpacity
              style={[styles.ageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setAgeYears((y) => Math.max(0, y - 1))}
              accessibilityLabel="Decrease years"
            >
              <Text style={[styles.ageBtnText, { color: colors.text }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.ageValue, { color: colors.text }]}>{ageYears}</Text>
            <TouchableOpacity
              style={[styles.ageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setAgeYears((y) => Math.min(20, y + 1))}
              accessibilityLabel="Increase years"
            >
              <Text style={[styles.ageBtnText, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.agePicker}>
          <Text style={[styles.agePickerLabel, { color: colors.textSecondary }]}>
            {ageYears === 0 ? 'Months *' : 'Months'}
          </Text>
          <View style={styles.ageControls}>
            <TouchableOpacity
              style={[styles.ageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setAgeMonths((m) => Math.max(ageYears === 0 ? 1 : 0, m - 1))}
              accessibilityLabel="Decrease months"
            >
              <Text style={[styles.ageBtnText, { color: colors.text }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.ageValue, { color: colors.text }]}>{ageMonths}</Text>
            <TouchableOpacity
              style={[styles.ageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setAgeMonths((m) => Math.min(11, m + 1))}
              accessibilityLabel="Increase months"
            >
              <Text style={[styles.ageBtnText, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Size</Text>
      <View style={styles.chips}>
        {([DogSize.small, DogSize.medium, DogSize.large, DogSize.extra_large] as DogSize[]).map((s) => (
          <Chip key={s} label={s.replace('_', ' ')} selected={size === s} onPress={() => setSize(s)} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Sex</Text>
      <View style={styles.chips}>
        {([DogSex.male, DogSex.female] as DogSex[]).map((s) => (
          <Chip key={s} label={s} selected={sex === s} onPress={() => setSex(s)} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Energy Level</Text>
      <View style={styles.chips}>
        {([EnergyLevel.low, EnergyLevel.moderate, EnergyLevel.high, EnergyLevel.very_high] as EnergyLevel[]).map((e) => (
          <Chip key={e} label={e.replace('_', ' ')} selected={energy === e} onPress={() => setEnergy(e)} />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={saving}
        accessibilityLabel={saving ? 'Saving...' : 'Save changes'}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: colors.error }]}
        onPress={handleDelete}
        accessibilityLabel={`Delete ${dog?.name}`}
        accessibilityRole="button"
        accessibilityHint="Permanently removes this dog from your profile"
      >
        <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Dog</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  input: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: 15 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
  hint: { fontSize: 12, fontStyle: 'italic', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  btn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  btnText: { color: '#fff', ...typography.button },
  deleteBtn: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  deleteBtnText: { fontWeight: '600' },
  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md, gap: spacing.xs },
  photoThumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.sm, overflow: 'visible', marginBottom: spacing.xs },
  thumbImg: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.sm },
  primaryBadge: { position: 'absolute', bottom: 2, left: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  primaryBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoTile: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.sm, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPhotoIcon: { fontSize: 24, fontWeight: '300', lineHeight: 28 },
  addPhotoLabel: { fontSize: 10 },
  // Age
  ageRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  agePicker: { flex: 1 },
  agePickerLabel: { fontSize: 13, marginBottom: spacing.xs },
  ageControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ageBtn: { width: 32, height: 32, borderRadius: borderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ageBtnText: { fontSize: 18, lineHeight: 22 },
  ageValue: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
});

export default EditDogScreen;
