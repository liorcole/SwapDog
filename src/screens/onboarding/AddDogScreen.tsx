import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch,
  Image, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { OnboardingStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useDogs } from '../../hooks/useDogs';
import { DogSize, DogSex, EnergyLevel } from '../../models/types';
import { spacing, borderRadius, typography } from '../../config/theme';
import Chip from '../../components/common/Chip';

const MAX_PHOTOS = 10;

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'AddDog'>;
};

const AddDogScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { createDog } = useDogs();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonths, setAgeMonths] = useState(1);
  const [size, setSize] = useState<DogSize>(DogSize.medium);
  const [sex, setSex] = useState<DogSex>(DogSex.male);
  const [energy, setEnergy] = useState<EnergyLevel>(EnergyLevel.moderate);
  const [goodWithDogs, setGoodWithDogs] = useState(false);
  const [goodWithKids, setGoodWithKids] = useState(false);
  const [vaccinated, setVaccinated] = useState(false);
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleCreate = async () => {
    if (!name.trim() || !breed.trim()) {
      Alert.alert('Required', 'Please fill in name and breed');
      return;
    }
    if (ageYears === 0 && ageMonths === 0) {
      Alert.alert('Required', 'Please enter your dog\'s age');
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      await createDog({
        ownerId: user.uid,
        name: name.trim(),
        breed: breed.trim(),
        ageYears,
        ageMonths: ageYears === 0 ? ageMonths : ageMonths,
        size,
        sex,
        energyLevel: energy,
        photoURLs,
        isGoodWithDogs: goodWithDogs,
        isGoodWithKids: goodWithKids,
        vaccinated,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('LocationSetup');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add dog');
    } finally {
      setLoading(false);
    }
  };

  const SwitchRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">Add your dog</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Tell us about your furry friend</Text>

      {/* Photo grid */}
      <Text style={[styles.label, { color: colors.text }]}>Photos ({photoURLs.length}/{MAX_PHOTOS})</Text>
      <View style={styles.photoGrid}>
        {photoURLs.map((uri, index) => (
          <View key={uri + index} style={styles.photoThumb}>
            <Image
              source={{ uri }}
              style={styles.thumbImg}
              accessibilityLabel={index === 0 ? 'Primary photo' : `Photo ${index + 1}`}
            />
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
        placeholder="Dog's name"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Dog's name"
      />
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder="Breed"
        placeholderTextColor={colors.textSecondary}
        value={breed}
        onChangeText={setBreed}
        accessibilityLabel="Dog's breed"
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
      {ageYears === 0 && (
        <Text style={[styles.ageHint, { color: colors.textSecondary }]}>Months required for puppies under 1 year</Text>
      )}

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

      <SwitchRow label="Good with other dogs" value={goodWithDogs} onChange={setGoodWithDogs} />
      <SwitchRow label="Good with kids" value={goodWithKids} onChange={setGoodWithKids} />
      <SwitchRow label="Vaccinated" value={vaccinated} onChange={setVaccinated} />

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
        onPress={handleCreate}
        disabled={loading}
        accessibilityLabel={loading ? 'Saving...' : 'Next step'}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{loading ? 'Saving...' : 'Next →'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('LocationSetup')}
        accessibilityLabel="Skip adding a dog"
        accessibilityRole="button"
      >
        <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg },
  title: { ...typography.h2, textAlign: 'center', marginBottom: spacing.xs },
  sub: { ...typography.body, textAlign: 'center', marginBottom: spacing.xl },
  input: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: 15 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1 },
  switchLabel: { fontSize: 15 },
  btn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  btnText: { color: '#fff', ...typography.button },
  skip: { textAlign: 'center', fontSize: 15 },
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
  ageRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  agePicker: { flex: 1 },
  agePickerLabel: { fontSize: 13, marginBottom: spacing.xs },
  ageControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ageBtn: { width: 32, height: 32, borderRadius: borderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ageBtnText: { fontSize: 18, lineHeight: 22 },
  ageValue: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  ageHint: { fontSize: 12, fontStyle: 'italic', marginBottom: spacing.sm },
});

export default AddDogScreen;
