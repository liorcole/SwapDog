/**
 * CreatePostScreen — lets the user post a "dog care needed" bulletin visible to
 * everyone in their area. Replaces the targeted CreateSwapScreen flow.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Platform, Switch, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useDogs } from '../../hooks/useDogs';
import { useSwaps } from '../../hooks/useSwaps';
import { Dog, CompensationType } from '../../models/types';
import { calculatePoints } from '../../utils/calculatePoints';
import { spacing, borderRadius, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PhotoCarousel from '../../components/common/PhotoCarousel';
import Chip from '../../components/common/Chip';
import { formatDogAge } from '../../utils/formatDogAge';

const MIN_CARE_DETAILS = 50;

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'Requests'>;
};

const CreatePostScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const { getDogsByOwner } = useDogs();
  const { createPost } = useSwaps();

  const [myDogs, setMyDogs] = useState<Dog[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dates
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  });
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  // Care details
  const [careDetails, setCareDetails] = useState('');

  // Compensation
  const [offerPayment, setOfferPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRate, setPaymentRate] = useState<'per_hour' | 'per_day'>('per_day');
  const [estimatedHours, setEstimatedHours] = useState('');

  useEffect(() => {
    if (!user) return;
    getDogsByOwner(user.uid).then((dogs) => {
      setMyDogs(dogs);
      if (dogs.length > 0) setSelectedDogId(dogs[0].id);
    }).finally(() => setLoading(false));
  }, [user]);

  const selectedDog = myDogs.find((d) => d.id === selectedDogId) ?? null;

  const dayCount = useMemo(() => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    return Math.max(1, diff);
  }, [startDate, endDate]);

  const pointsCost = useMemo(() => calculatePoints(startDate, endDate), [startDate, endDate]);

  // Compensation calculations
  const totalUnits = useMemo(() => {
    if (!offerPayment) return undefined;
    if (paymentRate === 'per_day') return dayCount;
    const hrs = parseFloat(estimatedHours);
    return isNaN(hrs) || hrs <= 0 ? undefined : hrs;
  }, [offerPayment, paymentRate, dayCount, estimatedHours]);

  const totalPayment = useMemo(() => {
    if (!offerPayment) return undefined;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0 || !totalUnits) return undefined;
    return parseFloat((amt * totalUnits).toFixed(2));
  }, [offerPayment, paymentAmount, totalUnits]);

  const compensationType: CompensationType = offerPayment ? 'payment' : 'points';

  const paymentBreakdownLabel = useMemo(() => {
    if (!offerPayment) return null;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0 || !totalUnits) return null;
    const total = (amt * totalUnits).toFixed(2);
    const rateLabel = paymentRate === 'per_hour' ? '/hr' : '/day';
    const unitLabel = paymentRate === 'per_hour'
      ? `${totalUnits} hr${totalUnits !== 1 ? 's' : ''}`
      : `${totalUnits} day${totalUnits !== 1 ? 's' : ''}`;
    return `💰 $${total} total ($${amt}${rateLabel} × ${unitLabel})`;
  }, [offerPayment, paymentAmount, paymentRate, totalUnits]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const handleSubmit = async () => {
    if (!selectedDogId || !selectedDog) {
      Alert.alert('Required', 'Please select your dog');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Invalid dates', 'End date must be after start date');
      return;
    }
    if (careDetails.trim().length < MIN_CARE_DETAILS) {
      Alert.alert('Care Details Required', `Please provide at least ${MIN_CARE_DETAILS} characters of care details`);
      return;
    }
    if (offerPayment) {
      const amt = parseFloat(paymentAmount);
      if (!amt || amt <= 0) {
        Alert.alert('Invalid Payment', 'Please enter a valid dollar amount');
        return;
      }
      if (paymentRate === 'per_hour') {
        const hrs = parseFloat(estimatedHours);
        if (!hrs || hrs <= 0) {
          Alert.alert('Hours Required', 'Please enter estimated hours per day when using hourly rate');
          return;
        }
      }
    }
    if (!user) return;

    setSubmitting(true);
    try {
      // Get current location
      let posterLocation: { latitude: number; longitude: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          posterLocation = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      } catch {
        // Location is optional — post can still be created
      }

      const paymentAmountNum = offerPayment ? parseFloat(paymentAmount) : null;

      await createPost({
        posterId: user.uid,
        posterName: userProfile?.displayName ?? user.displayName ?? 'SwapDog User',
        posterPhotoURL: userProfile?.photoURL ?? user.photoURL ?? undefined,
        posterLocation,
        dogId: selectedDogId,
        dogName: selectedDog.name,
        dogBreed: selectedDog.breed,
        dogPhotoURL: selectedDog.photoURLs?.[0],
        startDate,
        endDate,
        careDetails: careDetails.trim(),
        compensationType,
        pointsCost,
        paymentAmount: paymentAmountNum ?? undefined,
        paymentRate: offerPayment ? paymentRate : undefined,
        totalPayment: offerPayment ? totalPayment : undefined,
        totalUnits: offerPayment ? totalUnits : undefined,
        status: 'open',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Posted! 🐾', 'Your request is now visible to people in your area.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to post request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.pageTitle, { color: colors.text }]} accessibilityRole="header">
          Post a Request 📋
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
          Your post will be visible to SwapDog members in your area.
        </Text>

        {/* ── Section 1: Your Dog ── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🐶 Your Dog</Text>
          {myDogs.length > 1 && (
            <View style={styles.dogSelector}>
              {myDogs.map((dog) => (
                <TouchableOpacity
                  key={dog.id}
                  style={[
                    styles.dogSelectorTab,
                    {
                      backgroundColor: selectedDogId === dog.id ? colors.primary : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedDogId(dog.id)}
                  accessibilityLabel={dog.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selectedDogId === dog.id }}
                >
                  <Text style={[styles.dogSelectorTabText, { color: selectedDogId === dog.id ? '#fff' : colors.text }]}>
                    {dog.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedDog ? (
            <>
              {selectedDog.photoURLs.length > 0 && (
                <View style={styles.carouselWrapper}>
                  <PhotoCarousel photos={selectedDog.photoURLs} height={180} />
                </View>
              )}
              <View style={styles.dogInfo}>
                <Text style={[styles.dogInfoName, { color: colors.text }]}>{selectedDog.name}</Text>
                <Text style={[styles.dogInfoBreed, { color: colors.textSecondary }]}>{selectedDog.breed}</Text>
                <View style={styles.dogInfoChips}>
                  <Chip label={formatDogAge(selectedDog.ageYears, selectedDog.ageMonths)} />
                  <Chip label={selectedDog.size.replace('_', ' ')} />
                  <Chip label={selectedDog.sex} />
                  <Chip label={`${selectedDog.energyLevel.replace('_', ' ')} energy`} />
                  {selectedDog.vaccinated !== undefined && (
                    <Chip label={selectedDog.vaccinated ? '✅ Vaccinated' : '❌ Not vaccinated'} selected={selectedDog.vaccinated} />
                  )}
                  {selectedDog.isSpayedNeutered !== undefined && (
                    <Chip label={selectedDog.isSpayedNeutered ? '✅ Neutered' : '❌ Not neutered'} selected={!!selectedDog.isSpayedNeutered} />
                  )}
                </View>
              </View>
            </>
          ) : (
            <Text style={[styles.noDogText, { color: colors.textSecondary }]}>No dog added yet. Add one in Profile first.</Text>
          )}
        </View>

        {/* ── Section 2: Dates ── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Dates Needed</Text>
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: colors.primary }]}
            onPress={() => setShowStart(true)}
            accessibilityLabel={`Start date: ${formatDate(startDate)}`}
            accessibilityRole="button"
          >
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>From</Text>
            <Text style={[styles.dateButtonValue, { color: colors.text }]}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          {showStart && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={(_: DateTimePickerEvent, d?: Date) => {
                setShowStart(Platform.OS === 'ios');
                if (d) {
                  setStartDate(d);
                  if (d >= endDate) {
                    const newEnd = new Date(d);
                    newEnd.setDate(newEnd.getDate() + 1);
                    setEndDate(newEnd);
                  }
                }
                if (Platform.OS !== 'ios') setShowStart(false);
              }}
            />
          )}
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: colors.secondary }]}
            onPress={() => setShowEnd(true)}
            accessibilityLabel={`End date: ${formatDate(endDate)}`}
            accessibilityRole="button"
          >
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>To</Text>
            <Text style={[styles.dateButtonValue, { color: colors.text }]}>{formatDate(endDate)}</Text>
          </TouchableOpacity>
          {showEnd && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={startDate}
              onChange={(_: DateTimePickerEvent, d?: Date) => {
                if (d) setEndDate(d);
                if (Platform.OS !== 'ios') setShowEnd(false);
              }}
            />
          )}
          <View style={[styles.dateSummary, { backgroundColor: colors.background }]}>
            <Text style={[styles.dateSummaryText, { color: colors.textSecondary }]}>
              {dayCount} day{dayCount !== 1 ? 's' : ''} of care needed
            </Text>
          </View>
        </View>

        {/* ── Section 3: Care Details ── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Care Details</Text>
          <Text style={[styles.careHint, { color: colors.textSecondary }]}>
            Tell potential sitters what they need to know — schedule, feeding, medications, special needs, behavioral notes.
          </Text>
          <TextInput
            style={[
              styles.careInput,
              {
                backgroundColor: colors.background,
                borderColor:
                  careDetails.trim().length > 0 && careDetails.trim().length < MIN_CARE_DETAILS
                    ? colors.error
                    : colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g. Bella eats twice a day (7am and 6pm). She needs a 30-min walk every morning..."
            placeholderTextColor={colors.textSecondary}
            value={careDetails}
            onChangeText={setCareDetails}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Care details for the sitter"
          />
          <Text
            style={[styles.charCount, { color: careDetails.length >= MIN_CARE_DETAILS ? colors.success : colors.textSecondary }]}
          >
            {careDetails.length} chars{careDetails.length < MIN_CARE_DETAILS ? ` (min ${MIN_CARE_DETAILS})` : ' ✓'}
          </Text>
        </View>

        {/* ── Section 4: Compensation ── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Compensation</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelGroup}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Offering payment?</Text>
              <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                Toggle on to offer $ instead of points
              </Text>
            </View>
            <Switch
              value={offerPayment}
              onValueChange={(v) => {
                setOfferPayment(v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel="Toggle payment option"
              accessibilityRole="switch"
              accessibilityState={{ checked: offerPayment }}
            />
          </View>

          {!offerPayment && (
            <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}>
              <Text style={[styles.pointsBadgeText, { color: colors.primary }]}>
                🪙 {pointsCost.toFixed(1)} point{pointsCost !== 1 ? 's' : ''} (auto-calculated)
              </Text>
            </View>
          )}

          {offerPayment && (
            <>
              {/* Dollar amount */}
              <View style={styles.paymentInputRow}>
                <Text style={[styles.dollarSign, { color: colors.text }]}>$</Text>
                <TextInput
                  style={[styles.paymentInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Payment amount in dollars"
                />
              </View>

              {/* Rate selector */}
              <View style={styles.rateRow}>
                {(['per_day', 'per_hour'] as const).map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={[
                      styles.rateButton,
                      {
                        backgroundColor: paymentRate === rate ? colors.primary : colors.background,
                        borderColor: paymentRate === rate ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setPaymentRate(rate);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    accessibilityLabel={rate === 'per_day' ? 'Per day' : 'Per hour'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: paymentRate === rate }}
                  >
                    <Text style={[styles.rateButtonText, { color: paymentRate === rate ? '#fff' : colors.text }]}>
                      {rate === 'per_day' ? 'Per day' : 'Per hour'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Estimated hours input (only for per_hour) */}
              {paymentRate === 'per_hour' && (
                <View style={styles.hoursRow}>
                  <Text style={[styles.hoursLabel, { color: colors.text }]}>Estimated hours:</Text>
                  <TextInput
                    style={[styles.hoursInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                    placeholder="e.g. 6"
                    placeholderTextColor={colors.textSecondary}
                    value={estimatedHours}
                    onChangeText={setEstimatedHours}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Estimated hours"
                  />
                </View>
              )}

              {/* Live calculation preview */}
              {paymentBreakdownLabel ? (
                <View style={[styles.breakdownBadge, { backgroundColor: '#00B89418', borderColor: '#00B894' }]}>
                  <Text style={[styles.breakdownText, { color: '#00B894' }]}>{paymentBreakdownLabel}</Text>
                </View>
              ) : (
                <Text style={[styles.calcHint, { color: colors.textSecondary }]}>
                  Enter amount{paymentRate === 'per_hour' ? ' and hours' : ''} to see total
                </Text>
              )}

              {/* Off-app payment note */}
              <View style={[styles.offAppNote, { backgroundColor: '#FFF9E6', borderColor: '#F0C040' }]}>
                <Text style={[styles.offAppNoteText, { color: '#7A6000' }]}>
                  💰 All payments are arranged and made outside of SwapDog. We do not process payments.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityLabel={submitting ? 'Posting...' : 'Post Request'}
          accessibilityRole="button"
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Posting...' : 'Post Request 🐾'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  pageTitle: { ...typography.h3, marginBottom: spacing.xs },
  pageSubtitle: { fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },
  section: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  // Dog selector
  dogSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  dogSelectorTab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1 },
  dogSelectorTabText: { fontSize: 14, fontWeight: '600' },
  carouselWrapper: { borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.sm },
  dogInfo: { paddingTop: spacing.xs },
  dogInfoName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  dogInfoBreed: { fontSize: 14, marginBottom: spacing.sm },
  dogInfoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noDogText: { fontSize: 14, fontStyle: 'italic' },
  // Dates
  dateButton: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  dateButtonLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  dateButtonValue: { fontSize: 16, fontWeight: '600' },
  dateSummary: { padding: spacing.sm, borderRadius: borderRadius.sm, alignItems: 'center', marginTop: spacing.xs },
  dateSummaryText: { fontSize: 13 },
  // Care details
  careHint: { fontSize: 13, fontStyle: 'italic', lineHeight: 18, marginBottom: spacing.sm },
  careInput: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 14, minHeight: 120, lineHeight: 20 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: spacing.xs },
  // Compensation
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  toggleLabelGroup: { flex: 1, marginRight: spacing.sm },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleHint: { fontSize: 12, marginTop: 2 },
  pointsBadge: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  pointsBadgeText: { fontSize: 15, fontWeight: '700' },
  paymentInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
  dollarSign: { fontSize: 20, fontWeight: '700' },
  paymentInput: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 18, fontWeight: '600' },
  rateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  rateButton: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  rateButtonText: { fontSize: 14, fontWeight: '600' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  hoursLabel: { fontSize: 14, fontWeight: '600' },
  hoursInput: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 16, fontWeight: '600' },
  breakdownBadge: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  breakdownText: { fontSize: 15, fontWeight: '700' },
  calcHint: { fontSize: 13, fontStyle: 'italic', marginBottom: spacing.sm },
  offAppNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.xs },
  offAppNoteText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  // Submit
  submitBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', ...typography.button },
});

export default CreatePostScreen;
