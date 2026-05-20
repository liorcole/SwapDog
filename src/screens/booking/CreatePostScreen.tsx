/**
 * CreatePostScreen — lets the user post a "dog care needed" bulletin visible to
 * everyone in their area.
 *
 * SUB-TASK 2: Multi-dog selection — show all dogs with toggle cards,
 * populate dogIds/dogNames/dogBreeds/dogPhotoURLs arrays on the post.
 * Backward compat: dogId = dogIds[0], dogName = dogNames[0], etc.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Platform, Switch, KeyboardAvoidingView, Image,
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
import Chip from '../../components/common/Chip';
import { formatDogAge } from '../../utils/formatDogAge';

const MIN_CARE_DETAILS = 50;
const RED = '#FF2D55';

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'Requests'>;
};

const CreatePostScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const { getDogsByOwner } = useDogs();
  const { createPost } = useSwaps();

  const [myDogs, setMyDogs] = useState<Dog[]>([]);
  // SUB-TASK 2: multi-select — set of selected dog IDs
  const [selectedDogIds, setSelectedDogIds] = useState<Set<string>>(new Set());
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
      // Pre-select first dog if only one
      if (dogs.length === 1) {
        setSelectedDogIds(new Set([dogs[0].id]));
      }
    }).finally(() => setLoading(false));
  }, [user]);

  // Selected dog objects (in stable order)
  const selectedDogs = useMemo(
    () => myDogs.filter((d) => selectedDogIds.has(d.id)),
    [myDogs, selectedDogIds]
  );

  const toggleDog = (dogId: string) => {
    setSelectedDogIds((prev) => {
      const next = new Set(prev);
      if (next.has(dogId)) {
        next.delete(dogId);
      } else {
        next.add(dogId);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const dayCount = useMemo(() => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    return Math.max(1, diff);
  }, [startDate, endDate]);

  const pointsCost = useMemo(() => calculatePoints(startDate, endDate), [startDate, endDate]);

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

  // Auto-generate title hint for display (informational)
  const dogTitleHint = useMemo(() => {
    if (selectedDogs.length === 0) return '';
    if (selectedDogs.length === 1) return `Dog-sitting needed for ${selectedDogs[0].name}`;
    const names = selectedDogs.map((d) => d.name);
    const last = names.pop();
    return `Dog-sitting needed for ${names.join(', ')} & ${last}`;
  }, [selectedDogs]);

  const handleSubmit = async () => {
    if (selectedDogs.length === 0) {
      Alert.alert('Required', 'Please select at least one dog');
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
      let posterLocation: { latitude: number; longitude: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          posterLocation = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      } catch {
        // Location is optional
      }

      const paymentAmountNum = offerPayment ? parseFloat(paymentAmount) : null;

      // ── Build multi-dog arrays ──
      const primaryDog = selectedDogs[0];
      const dogIds = selectedDogs.map((d) => d.id);
      const dogNames = selectedDogs.map((d) => d.name);
      const dogBreeds = selectedDogs.map((d) => d.breed);
      const dogPhotoURLs = selectedDogs
        .map((d) => d.photoURLs?.[0])
        .filter((url): url is string => Boolean(url));

      await createPost({
        posterId: user.uid,
        posterName: userProfile?.displayName ?? user.displayName ?? 'SwapDog User',
        posterPhotoURL: userProfile?.photoURL ?? user.photoURL ?? undefined,
        posterLocation,
        // Backward compat single-dog fields (primary dog)
        dogId: primaryDog.id,
        dogName: primaryDog.name,
        dogBreed: primaryDog.breed,
        dogPhotoURL: primaryDog.photoURLs?.[0],
        // New multi-dog arrays
        dogIds,
        dogNames,
        dogBreeds,
        dogPhotoURLs: dogPhotoURLs.length > 0 ? dogPhotoURLs : undefined,
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

        {/* ── Section 1: Select Your Dog(s) ── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🐶 {myDogs.length > 1 ? 'Select Your Dog(s)' : 'Your Dog'}
          </Text>
          {myDogs.length === 0 ? (
            <Text style={[styles.noDogText, { color: colors.textSecondary }]}>
              No dog added yet. Add one in Profile first.
            </Text>
          ) : (
            <>
              <Text style={[styles.dogSelectHint, { color: colors.textSecondary }]}>
                {myDogs.length > 1
                  ? 'Tap to select one or more dogs for this post.'
                  : 'Your dog for this post:'}
              </Text>
              <View style={styles.dogGrid}>
                {myDogs.map((dog) => {
                  const isSelected = selectedDogIds.has(dog.id);
                  const photoURL = dog.photoURLs?.[0];
                  return (
                    <TouchableOpacity
                      key={dog.id}
                      style={[
                        styles.dogCard,
                        {
                          backgroundColor: colors.background,
                          borderColor: isSelected ? RED : colors.border,
                          borderWidth: isSelected ? 2.5 : 1,
                        },
                      ]}
                      onPress={() => toggleDog(dog.id)}
                      accessibilityLabel={`${dog.name}${isSelected ? ', selected' : ''}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      {/* Dog photo or placeholder */}
                      {photoURL ? (
                        <Image source={{ uri: photoURL }} style={styles.dogCardPhoto} />
                      ) : (
                        <View style={[styles.dogCardPhotoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                          <Text style={styles.dogCardPhotoEmoji}>🐕</Text>
                        </View>
                      )}
                      {/* Dog name + breed */}
                      <View style={styles.dogCardInfo}>
                        <Text
                          style={[styles.dogCardName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {dog.name}
                        </Text>
                        <Text
                          style={[styles.dogCardBreed, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {dog.breed}
                        </Text>
                        <Text style={[styles.dogCardAge, { color: colors.textSecondary }]}>
                          {formatDogAge(dog.ageYears, dog.ageMonths)}
                        </Text>
                      </View>
                      {/* Checkmark overlay when selected */}
                      {isSelected && (
                        <View style={styles.dogCardCheckmark}>
                          <Text style={styles.dogCardCheckmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected dogs summary + auto-title hint */}
              {selectedDogs.length > 0 && (
                <View style={[styles.selectedSummary, { backgroundColor: colors.primary + '12', borderColor: colors.primary }]}>
                  <Text style={[styles.selectedSummaryText, { color: colors.primary }]}>
                    {selectedDogs.length === 1
                      ? `✓ ${selectedDogs[0].name} selected`
                      : `✓ ${selectedDogs.map((d) => d.name).join(', ')} selected`}
                  </Text>
                  {selectedDogs.length > 1 && dogTitleHint ? (
                    <Text style={[styles.selectedSummaryHint, { color: colors.textSecondary }]}>
                      "{dogTitleHint}"
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Show chips for selected dog(s) */}
              {selectedDogs.length > 0 && (
                <View style={styles.dogChipsSection}>
                  {selectedDogs.map((dog) => (
                    <View key={dog.id} style={styles.dogChipGroup}>
                      {selectedDogs.length > 1 && (
                        <Text style={[styles.dogChipGroupLabel, { color: colors.textSecondary }]}>
                          {dog.name}:
                        </Text>
                      )}
                      <View style={styles.dogChipsRow}>
                        <Chip label={formatDogAge(dog.ageYears, dog.ageMonths)} />
                        <Chip label={dog.size.replace('_', ' ')} />
                        <Chip label={dog.sex} />
                        <Chip label={`${dog.energyLevel.replace('_', ' ')} energy`} />
                        {dog.vaccinated !== undefined && (
                          <Chip label={dog.vaccinated ? '✅ Vaccinated' : '❌ Not vaccinated'} selected={dog.vaccinated} />
                        )}
                        {dog.isSpayedNeutered !== undefined && (
                          <Chip label={dog.isSpayedNeutered ? '✅ Neutered' : '❌ Not neutered'} selected={!!dog.isSpayedNeutered} />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
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

              {paymentBreakdownLabel ? (
                <View style={[styles.breakdownBadge, { backgroundColor: '#00B89418', borderColor: '#00B894' }]}>
                  <Text style={[styles.breakdownText, { color: '#00B894' }]}>{paymentBreakdownLabel}</Text>
                </View>
              ) : (
                <Text style={[styles.calcHint, { color: colors.textSecondary }]}>
                  Enter amount{paymentRate === 'per_hour' ? ' and hours' : ''} to see total
                </Text>
              )}

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
  // Dog multi-select grid
  dogSelectHint: { fontSize: 13, marginBottom: spacing.sm, fontStyle: 'italic' },
  dogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dogCard: {
    width: '47%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  dogCardPhoto: { width: '100%', height: 110, resizeMode: 'cover' },
  dogCardPhotoPlaceholder: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogCardPhotoEmoji: { fontSize: 40 },
  dogCardInfo: { padding: spacing.xs + 2 },
  dogCardName: { fontSize: 15, fontWeight: '700', marginBottom: 1 },
  dogCardBreed: { fontSize: 12, marginBottom: 1 },
  dogCardAge: { fontSize: 11 },
  dogCardCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogCardCheckmarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  // Selected summary banner
  selectedSummary: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  selectedSummaryText: { fontSize: 14, fontWeight: '700' },
  selectedSummaryHint: { fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  // Dog chips (per selected dog)
  dogChipsSection: { marginTop: spacing.sm, gap: spacing.sm },
  dogChipGroup: {},
  dogChipGroupLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  dogChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
