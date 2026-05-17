import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { OnboardingStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useDogs } from '../../hooks/useDogs';
import { DogSize, DogSex, EnergyLevel } from '../../models/types';
import { spacing, borderRadius, typography } from '../../config/theme';
import Chip from '../../components/common/Chip';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'AddDog'>;
};

const AddDogScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { createDog } = useDogs();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [size, setSize] = useState<DogSize>(DogSize.medium);
  const [sex, setSex] = useState<DogSex>(DogSex.male);
  const [energy, setEnergy] = useState<EnergyLevel>(EnergyLevel.moderate);
  const [goodWithDogs, setGoodWithDogs] = useState(false);
  const [goodWithKids, setGoodWithKids] = useState(false);
  const [vaccinated, setVaccinated] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !breed.trim() || !age.trim()) {
      Alert.alert('Required', 'Please fill in name, breed, and age');
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      await createDog({
        ownerId: user.uid,
        name: name.trim(),
        breed: breed.trim(),
        age: parseInt(age, 10),
        size,
        sex,
        energyLevel: energy,
        photos: [],
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
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder="Age (years)"
        placeholderTextColor={colors.textSecondary}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        accessibilityLabel="Dog's age in years"
      />

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
});

export default AddDogScreen;
