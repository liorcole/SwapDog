import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { DiscoverStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useDogs } from '../../hooks/useDogs';
import { useUsers } from '../../hooks/useUsers';
import { useSwaps } from '../../hooks/useSwaps';
import { Dog, User, SwapStatus } from '../../models/types';
import { spacing, borderRadius, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'CreateSwap'>;
  route: RouteProp<DiscoverStackParamList, 'CreateSwap'>;
};

const CreateSwapScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const { getDogsByOwner } = useDogs();
  const { getUser } = useUsers();
  const { createSwap } = useSwaps();
  const [myDogs, setMyDogs] = useState<Dog[]>([]);
  const [receiver, setReceiver] = useState<User | null>(null);
  const [receiverDogs, setReceiverDogs] = useState<Dog[]>([]);
  const [selectedMyDogs, setSelectedMyDogs] = useState<string[]>([]);
  const [selectedReceiverDogs, setSelectedReceiverDogs] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getDogsByOwner(user.uid), getDogsByOwner(route.params.userId), getUser(route.params.userId)])
      .then(([mine, theirs, u]) => {
        setMyDogs(mine);
        setReceiverDogs(theirs);
        setReceiver(u);
      })
      .finally(() => setLoading(false));
  }, [user, route.params.userId]);

  const toggleDog = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((d) => d !== id) : [...list, id]);
  };

  const handleSubmit = async () => {
    if (selectedMyDogs.length === 0) { Alert.alert('Required', 'Select at least one of your dogs'); return; }
    if (endDate <= startDate) { Alert.alert('Invalid dates', 'End date must be after start date'); return; }
    if (!user || !receiver) return;
    setSubmitting(true);
    try {
      await createSwap({
        requesterId: user.uid,
        receiverId: receiver.id,
        requesterDogIds: selectedMyDogs,
        receiverDogIds: selectedReceiverDogs,
        startDate,
        endDate,
        message: message.trim() || undefined,
        status: SwapStatus.pending,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent!', 'Swap request sent successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Request swap with {receiver?.displayName}</Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your dogs</Text>
      {myDogs.map((dog) => (
        <TouchableOpacity
          key={dog.id}
          style={[styles.dogRow, { backgroundColor: colors.surface, borderColor: selectedMyDogs.includes(dog.id) ? colors.primary : colors.border }]}
          onPress={() => toggleDog(dog.id, selectedMyDogs, setSelectedMyDogs)}
          accessibilityLabel={dog.name}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedMyDogs.includes(dog.id) }}
        >
          <Text style={[styles.dogName, { color: colors.text }]}>{selectedMyDogs.includes(dog.id) ? '☑' : '☐'} {dog.name}</Text>
        </TouchableOpacity>
      ))}

      {receiverDogs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Their dogs (to watch)</Text>
          {receiverDogs.map((dog) => (
            <TouchableOpacity
              key={dog.id}
              style={[styles.dogRow, { backgroundColor: colors.surface, borderColor: selectedReceiverDogs.includes(dog.id) ? colors.secondary : colors.border }]}
              onPress={() => toggleDog(dog.id, selectedReceiverDogs, setSelectedReceiverDogs)}
              accessibilityLabel={dog.name}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedReceiverDogs.includes(dog.id) }}
            >
              <Text style={[styles.dogName, { color: colors.text }]}>{selectedReceiverDogs.includes(dog.id) ? '☑' : '☐'} {dog.name}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Dates</Text>
      <TouchableOpacity
        style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowStart(true)}
        accessibilityLabel={`Start date: ${startDate.toLocaleDateString()}`}
        accessibilityRole="button"
      >
        <Text style={{ color: colors.text }}>Start: {startDate.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {showStart && (
        <DateTimePicker
          value={startDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(_: DateTimePickerEvent, d?: Date) => { setShowStart(false); if (d) setStartDate(d); }}
        />
      )}
      <TouchableOpacity
        style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowEnd(true)}
        accessibilityLabel={`End date: ${endDate.toLocaleDateString()}`}
        accessibilityRole="button"
      >
        <Text style={{ color: colors.text }}>End: {endDate.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {showEnd && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={startDate}
          onChange={(_: DateTimePickerEvent, d?: Date) => { setShowEnd(false); if (d) setEndDate(d); }}
        />
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Message (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder="Say hi or explain your swap..."
        placeholderTextColor={colors.textSecondary}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={3}
        accessibilityLabel="Message to the other user, optional"
      />

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityLabel={submitting ? 'Sending request...' : 'Send swap request'}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{submitting ? 'Sending...' : 'Send Swap Request'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  title: { ...typography.h3, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  dogRow: { padding: spacing.sm, borderWidth: 2, borderRadius: borderRadius.sm, marginBottom: spacing.xs },
  dogName: { fontSize: 15 },
  dateRow: { padding: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15 },
  textArea: { height: 80, textAlignVertical: 'top', marginBottom: spacing.md },
  btn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', ...typography.button },
});

export default CreateSwapScreen;
