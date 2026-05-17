import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
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
  const [age, setAge] = useState('');
  const [size, setSize] = useState<DogSize>(DogSize.medium);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDog(route.params.dogId).then((d) => {
      if (d) {
        setDog(d);
        setName(d.name);
        setBreed(d.breed);
        setAge(String(d.age));
        setSize(d.size);
      }
      setLoading(false);
    });
  }, [route.params.dogId]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Dog name is required'); return; }
    setSaving(true);
    try {
      await updateDog(route.params.dogId, { name: name.trim(), breed: breed.trim(), age: parseInt(age, 10), size });
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
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={age}
        onChangeText={setAge}
        placeholder="Age"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        accessibilityLabel="Dog age"
      />
      <Text style={[styles.label, { color: colors.text }]}>Size</Text>
      <View style={styles.chips}>
        {([DogSize.small, DogSize.medium, DogSize.large, DogSize.extra_large] as DogSize[]).map((s) => (
          <Chip key={s} label={s.replace('_', ' ')} selected={size === s} onPress={() => setSize(s)} />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  input: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: 15 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  btn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  btnText: { color: '#fff', ...typography.button },
  deleteBtn: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  deleteBtnText: { fontWeight: '600' },
});

export default EditDogScreen;
