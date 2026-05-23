/**
 * PostDetailScreen — Wave 19B
 *
 * - Shows care type icon + label prominently
 * - Shows schedule info per care type
 * - Shows compensation: money OR points offered
 * - "I Can Help" flow: accept at offered pts OR counter-offer
 * - Owner sees counter offers in Interested Helpers section (Accept/Decline)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { RequestsStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSwaps } from '../../hooks/useSwaps';
import { useUsers } from '../../hooks/useUsers';
import { useMessaging } from '../../hooks/useMessaging';
import { SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { scheduleOwnerReminders, requestNotificationPermissions } from '../../services/ReminderService';

const RED = '#FF2D55';
const GREEN = '#00B894';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = Math.round(Dimensions.get('window').height * 0.4);

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'PostDetail'>;
  route: RouteProp<RequestsStackParamList, 'PostDetail'>;
};

// ─── Care Type Helpers ────────────────────────────────────────────────────────

function getCareTypeIcon(careType?: string): string {
  switch (careType) {
    case 'overnight': return '🏠';
    case 'daySitting': return '☀️';
    case 'feeding': return '🍽️';
    case 'dogWalking': return '🐕';
    default: return '🐾';
  }
}

function getCareTypeLabel(careType?: string): string {
  switch (careType) {
    case 'overnight': return 'Overnight Care';
    case 'daySitting': return 'Day Pet Sitting';
    case 'feeding': return 'Feeding';
    case 'dogWalking': return 'Dog Walking';
    default: return 'Pet Care';
  }
}

function getScheduleInfo(post: SwapPost): string {
  const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  switch (post.careType) {
    case 'overnight': {
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const nights = Math.max(1, Math.round((post.endDate.getTime() - post.startDate.getTime()) / MS_PER_DAY));
      return `📅 ${startStr} → ${endStr} (${nights} night${nights !== 1 ? 's' : ''})`;
    }
    case 'daySitting': {
      const timeInfo = post.startTime && post.endTime
        ? `, ${post.startTime} → ${post.endTime}`
        : '';
      return `📅 ${startStr}${timeInfo}`;
    }
    case 'feeding': {
      const timeInfo = post.feedingTime ? ` at ${post.feedingTime}` : '';
      return `📅 ${startStr}${timeInfo}`;
    }
    case 'dogWalking': {
      if (post.walkDurationMinutes) {
        const hrs = Math.floor(post.walkDurationMinutes / 60);
        const mins = post.walkDurationMinutes % 60;
        const label = hrs > 0
          ? `${hrs} hr${hrs !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`
          : `${mins} min`;
        return `🐕 ${label} walk`;
      }
      return '🐕 Dog Walking';
    }
    default:
      return `📅 ${startStr} – ${endStr}`;
  }
}

// ─── Photo Carousel ───────────────────────────────────────────────────────────

interface PhotoCarouselProps {
  photos: string[];
  onPhotoPress: (index: number) => void;
}

const PhotoCarouselSection: React.FC<PhotoCarouselProps> = ({ photos, onPhotoPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  };

  if (photos.length === 0) {
    return (
      <View style={carouselStyles.placeholder}>
        <Text style={carouselStyles.placeholderEmoji}>🐕</Text>
        <Text style={carouselStyles.placeholderText}>No Photos</Text>
      </View>
    );
  }

  return (
    <View style={carouselStyles.container}>
      <FlatList
        data={photos}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onPhotoPress(index)}
            style={carouselStyles.slide}
          >
            <Image source={{ uri: item }} style={carouselStyles.image} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />
      {photos.length > 1 && (
        <View style={carouselStyles.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[carouselStyles.dot, i === activeIndex ? carouselStyles.dotActive : carouselStyles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Full-screen Photo Modal ──────────────────────────────────────────────────

interface FullscreenModalProps {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

const FullscreenPhotoModal: React.FC<FullscreenModalProps> = ({ photos, initialIndex, visible, onClose }) => {
  const flatRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible && flatRef.current && photos.length > 1) {
      const timer = setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, initialIndex, photos.length]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
      <View style={modalStyles.overlay}>
        <SafeAreaView style={modalStyles.safeTop} pointerEvents="box-none">
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} accessibilityLabel="Close photo" accessibilityRole="button">
            <Text style={modalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <FlatList
          ref={flatRef}
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          renderItem={({ item }) => (
            <View style={modalStyles.slide}>
              <Image source={{ uri: item }} style={modalStyles.image} resizeMode="contain" />
            </View>
          )}
        />
        {photos.length > 1 && (
          <SafeAreaView style={modalStyles.safeBottom} pointerEvents="none">
            <View style={modalStyles.dotsRow}>
              {photos.map((_, i) => (
                <View key={i} style={[modalStyles.dot, i === activeIndex ? modalStyles.dotActive : modalStyles.dotInactive]} />
              ))}
            </View>
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const PostDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthContext();
  const { getAreaPosts, getMyPosts, addResponder, approveHelper, saveOwnerReminderIds, respondToCounter, cancelPost } = useSwaps();
  const { getOrCreateConversation, sendMessage } = useMessaging();

  const [post, setPost] = useState<SwapPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Photo carousel state
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);

  // "I Can Help" modal state (for points posts)
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [counterPointsInput, setCounterPointsInput] = useState('');
  const [counterType, setCounterType] = useState<'points' | 'money'>('points');
  const [counterMoneyInput, setCounterMoneyInput] = useState('');
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  const postId = route.params?.postId;

  const buildPhotos = async (p: SwapPost): Promise<string[]> => {
    if (p.dogPhotoURLs && p.dogPhotoURLs.length > 0) return p.dogPhotoURLs;
    if (p.dogId) {
      try {
        const dogSnap = await getDoc(doc(db, 'dogs', p.dogId));
        if (dogSnap.exists()) {
          const dogData = dogSnap.data() as { photoURLs?: string[] };
          if (dogData.photoURLs && dogData.photoURLs.length > 0) return dogData.photoURLs;
        }
      } catch { /* non-fatal */ }
    }
    if (p.dogIds && p.dogIds.length > 0) {
      try {
        const dogSnap = await getDoc(doc(db, 'dogs', p.dogIds[0]));
        if (dogSnap.exists()) {
          const dogData = dogSnap.data() as { photoURLs?: string[] };
          if (dogData.photoURLs && dogData.photoURLs.length > 0) return dogData.photoURLs;
        }
      } catch { /* non-fatal */ }
    }
    if (p.dogPhotoURL) return [p.dogPhotoURL];
    return [];
  };

  useEffect(() => {
    if (!postId) { setLoading(false); return; }
    const fetchPost = async () => {
      try {
        const areaPosts = await getAreaPosts();
        const found = areaPosts.find((p) => p.id === postId) ?? null;
        if (found) {
          setPost(found);
          setAllPhotos(await buildPhotos(found));
          return;
        }
        if (user?.uid) {
          const myPosts = await getMyPosts(user.uid);
          const ownPost = myPosts.find((p) => p.id === postId) ?? null;
          setPost(ownPost);
          if (ownPost) setAllPhotos(await buildPhotos(ownPost));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId, user?.uid]);

  const handlePhotoPress = (index: number) => {
    setModalInitialIndex(index);
    setModalVisible(true);
  };

  // ── "I Can Help" flow ─────────────────────────────────────────────────────

  const handleHelpButtonPress = () => {
    setCounterType(post?.compensationType === 'payment' ? 'money' : 'points');
    if (!user || !post) return;
    if (user.uid === post.posterId) {
      Alert.alert("That's your post!", "You can't respond to your own request.");
      return;
    }
    // Points post: show accept/counter modal
    if (post.compensationType === 'points') {
      setCounterMode(false);
      setCounterPointsInput('');
      setHelpModalVisible(true);
    } else {
      // Payment post: go straight to messaging
      handleHelp(undefined);
    }
  };

  /** Accept at offered points or with a counter offer */
  const handleAcceptOrCounter = async (counterPoints?: number) => {
    if (!user || !post) return;
    setCounterSubmitting(true);
    try {
      const sitterName = userProfile?.displayName ?? user.displayName ?? 'Someone';
      const sitterPhoto = userProfile?.photoURL ?? user.photoURL ?? undefined;
      const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const dogDisplayName = post.dogNames && post.dogNames.length > 1
        ? post.dogNames.join(' & ') : post.dogName;

      const convId = await getOrCreateConversation(user.uid, post.posterId, post.id);

      const introText = counterPoints !== undefined
        ? `🐾 Hey! I'd love to help with ${dogDisplayName} from ${startStr} to ${endStr}. I'd like to counter-offer at ${counterType === 'money' ? `$${counterMoneyInput}` : `${counterPoints} points`} — let me know if that works!\n\n📋 Review Counter`
        : `🐾 Hey! I'd love to help with ${dogDisplayName} from ${startStr} to ${endStr}. I'll take the job for the offered ${post.pointsOffered ?? post.pointsCost} points!`;
      await sendMessage(convId, user.uid, introText);

      await addResponder(post.id, { userId: user.uid, userName: sitterName, userPhotoURL: sitterPhoto }, counterPoints);

      setHelpModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.getParent()?.navigate('MessagesTab', {
        screen: 'Chat',
        params: { conversationId: convId, otherUserId: post.posterId },
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setCounterSubmitting(false);
    }
  };

  const handleHelp = async (counterPoints?: number) => {
    if (!user || !post) return;
    setClaiming(true);
    try {
      const sitterName = userProfile?.displayName ?? user.displayName ?? 'Someone';
      const sitterPhoto = userProfile?.photoURL ?? user.photoURL ?? undefined;
      const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const dogDisplayName = post.dogNames && post.dogNames.length > 1
        ? post.dogNames.join(' & ') : post.dogName;

      const convId = await getOrCreateConversation(user.uid, post.posterId, post.id);
      const introText = `🐾 Hey! I'd love to help watch ${dogDisplayName} from ${startStr} to ${endStr}. Let me know if you'd like to set something up!`;
      await sendMessage(convId, user.uid, introText);

      if (post.compensationType === 'payment' || post.compensationType === 'either') {
        await sendMessage(convId, user.uid, '💰 Reminder: All payments are arranged and made outside of WatchDog.');
      }

      await addResponder(post.id, { userId: user.uid, userName: sitterName, userPhotoURL: sitterPhoto }, counterPoints);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.getParent()?.navigate('MessagesTab', {
        screen: 'Chat',
        params: { conversationId: convId, otherUserId: post.posterId },
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setClaiming(false);
    }
  };

  const handleMessageResponder = async (responderId: string) => {
    if (!user || !post) return;
    setClaiming(true);
    try {
      const convId = await getOrCreateConversation(user.uid, responderId, post.id);
      navigation.getParent()?.navigate('MessagesTab', {
        screen: 'Chat',
        params: { conversationId: convId, otherUserId: responderId },
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open chat');
    } finally {
      setClaiming(false);
    }
  };

  const handleApprove = async (helperId: string, helperName: string) => {
    if (!user || !post) return;
    Alert.alert('Approve Helper', `Choose ${helperName} as your dog sitter for this post?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setApprovingId(helperId);
          try {
            await approveHelper(post.id, helperId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPost((prev) => prev ? { ...prev, status: 'claimed', claimedBy: helperId } : prev);
            try {
              const hasPermission = await requestNotificationPermissions();
              if (hasPermission) {
                const dogDisplayName = post.dogNames && post.dogNames.length > 1
                  ? post.dogNames.join(' & ') : post.dogName;
                const ownerIds = await scheduleOwnerReminders({
                  startDate: post.startDate,
                  dogName: dogDisplayName,
                  ownerName: post.posterName,
                  sitterName: helperName,
                });
                if (ownerIds.length > 0) await saveOwnerReminderIds(post.id, ownerIds);
              }
            } catch (reminderErr) {
              console.warn('[PostDetail] Failed to schedule reminders:', reminderErr);
            }
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not approve helper');
          } finally {
            setApprovingId(null);
          }
        },
      },
    ]);
  };

  const handleCounterResponse = async (responderId: string, responderName: string, accept: boolean) => {
    if (!post) return;
    Alert.alert(
      accept ? 'Accept Counter Offer' : 'Decline Counter Offer',
      accept
        ? `Accept ${responderName}'s counter offer?`
        : `Decline ${responderName}'s counter offer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: accept ? 'Accept' : 'Decline',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await respondToCounter(post.id, responderId, accept);
              // Refresh local state
              setPost((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  respondedBy: prev.respondedBy?.map((r) =>
                    r.userId === responderId
                      ? { ...r, counterStatus: accept ? 'accepted' : 'declined' }
                      : r
                  ),
                };
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not update counter');
            }
          },
        },
      ]
    );
  };

  // ── Loading / Not Found ────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />;
  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Post not found</Text>
      </View>
    );
  }

  const isOwner = user?.uid === post.posterId;
  const respondents = post.respondedBy ?? [];
  const dogDisplayName = post.dogNames && post.dogNames.length > 1
    ? post.dogNames.join(' & ') : post.dogName;
  const dogDisplayBreed = post.dogBreeds && post.dogBreeds.length > 1
    ? post.dogBreeds.join(', ') : post.dogBreed;

  const compensationLabel = () => {
    if (post.compensationType === 'points') {
      const pts = post.pointsOffered ?? post.pointsCost;
      return `${pts} point${pts !== 1 ? 's' : ''} offered`;
    }
    if (post.totalPayment && post.paymentAmount && post.paymentRate) {
      const rateLabel = post.paymentRate === 'per_hour' ? '/hr' : '/day';
      if (post.careType === 'feeding') return `$${post.paymentAmount} per visit`;
      const unitLabel = post.paymentRate === 'per_hour'
        ? `${post.totalUnits} hr${post.totalUnits !== 1 ? 's' : ''}`
        : `${post.totalUnits} day${post.totalUnits !== 1 ? 's' : ''}`;
      return `$${post.totalPayment} total ($${post.paymentAmount}${rateLabel} × ${unitLabel})`;
    }
    return post.compensationType === 'either'
      ? `${post.pointsCost.toFixed(1)} pts or payment`
      : 'Payment offered';
  };

  const offeredPoints = post.pointsOffered ?? post.pointsCost;

  return (
    <>
      {/* ── "I Can Help" Modal (for points posts) ── */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.helpModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setHelpModalVisible(false)}
          />
          <View style={[styles.helpModalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.helpModalTitle, { color: colors.text }]}>
              🐾 Respond to this post
            </Text>
            <Text style={[styles.helpModalSubtitle, { color: colors.textSecondary }]}>
              This post is worth{' '}
              <Text style={{ color: RED, fontWeight: '700' }}>{offeredPoints} points</Text>
            </Text>

            {!counterMode ? (
              <>
                {/* Accept at offered rate */}
                <TouchableOpacity
                  style={[styles.helpModalAcceptBtn, { backgroundColor: GREEN }]}
                  onPress={() => handleAcceptOrCounter(undefined)}
                  disabled={counterSubmitting}
                >
                  <Text style={styles.helpModalBtnText}>
                    Accept for {offeredPoints} points ✓
                  </Text>
                </TouchableOpacity>

                {/* Counter offer */}
                <TouchableOpacity
                  style={[styles.helpModalCounterBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => setCounterMode(true)}
                >
                  <Text style={[styles.helpModalCounterBtnText, { color: colors.text }]}>
                    🔄 Counter Offer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setHelpModalVisible(false)} style={styles.helpModalCancelLink}>
                  <Text style={[styles.helpModalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {counterType === 'points' ? (
                  <>
                    <Text style={[styles.counterInputLabel, { color: colors.text }]}>
                      Your counter offer (points):
                    </Text>
                    <View style={styles.counterInputRow}>
                      <TextInput
                        style={[styles.counterInput, { borderColor: '#FFFFFF', backgroundColor: colors.background, color: colors.text }]}
                        placeholder={String(offeredPoints)}
                        placeholderTextColor={colors.textSecondary}
                        value={counterPointsInput}
                        onChangeText={(t) => setCounterPointsInput(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        autoFocus
                        accessibilityLabel="Counter offer points"
                      />
                      <Text style={[styles.counterInputUnit, { color: colors.textSecondary }]}>pts</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCounterType('money')} style={{ marginTop: 4, marginBottom: 8 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Want to counter with money instead?</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.counterInputLabel, { color: colors.text }]}>
                      Your counter offer ($):
                    </Text>
                    <View style={styles.counterInputRow}>
                      <Text style={[styles.counterInputUnit, { color: colors.text }]}>$</Text>
                      <TextInput
                        style={[styles.counterInput, { borderColor: '#FFFFFF', backgroundColor: colors.background, color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        value={counterMoneyInput}
                        onChangeText={setCounterMoneyInput}
                        keyboardType="decimal-pad"
                        autoFocus
                        accessibilityLabel="Counter offer money"
                      />
                    </View>
                    <TouchableOpacity onPress={() => setCounterType('points')} style={{ marginTop: 4, marginBottom: 8 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Want to counter with points instead?</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.helpModalAcceptBtn, { backgroundColor: RED, opacity: counterSubmitting ? 0.7 : 1 }]}
                  onPress={() => {
                    if (counterType === 'points') {
                      const pts = parseInt(counterPointsInput, 10);
                      if (isNaN(pts) || pts < 1) {
                        Alert.alert('Invalid', 'Please enter a valid points amount');
                        return;
                      }
                      handleAcceptOrCounter(pts);
                    } else {
                      const money = parseFloat(counterMoneyInput);
                      if (isNaN(money) || money <= 0) {
                        Alert.alert('Invalid', 'Please enter a valid dollar amount');
                        return;
                      }
                      handleAcceptOrCounter(0);
                    }
                  }}
                  disabled={counterSubmitting}
                >
                  <Text style={styles.helpModalBtnText}>
                    {counterSubmitting ? 'Sending...' : 'Send Counter Offer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setCounterMode(false)} style={styles.helpModalCancelLink}>
                  <Text style={[styles.helpModalCancelText, { color: colors.textSecondary }]}>← Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FullscreenPhotoModal
        photos={allPhotos}
        initialIndex={modalInitialIndex}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* ── Photo Carousel (swipeable, all dog photos) ── */}
        <PhotoCarouselSection photos={allPhotos} onPhotoPress={handlePhotoPress} />

        {/* ── Owner (clickable → full profile) ── */}
        <TouchableOpacity
          style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}
          onPress={() => navigation.navigate('UserDetail', { userId: post.posterId })}
          accessibilityLabel={`View ${post.posterName}'s profile`}
          accessibilityRole="button"
        >
          <View style={styles.posterRow}>
            {post.posterPhotoURL ? (
              <Image source={{ uri: post.posterPhotoURL }} style={[styles.posterAvatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.posterAvatarPlaceholder, { backgroundColor: colors.primary + '22', borderColor: colors.border }]}>
                <Text style={styles.posterAvatarEmoji}>🧑</Text>
              </View>
            )}
            <View style={styles.posterInfo}>
              <View style={styles.posterNameRow}>
                <Text style={[styles.posterName, { color: colors.text }]}>{post.posterName}</Text>
                <Text style={styles.ownerLabel}> (owner)</Text>
              </View>
              <Text style={[styles.postedAt, { color: colors.textSecondary }]}>
                Posted {post.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: post.status === 'open' ? '#00B89420' : '#63727220' }]}>
              <Text style={[styles.statusBadgeText, { color: post.status === 'open' ? '#00B894' : '#636E72' }]}>
                {post.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Dog (clickable → DogDetail) ── */}
        <TouchableOpacity
          style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}
          onPress={() => {
            const dogId = post.dogId ?? (post.dogIds && post.dogIds.length > 0 ? post.dogIds[0] : undefined);
            if (dogId) navigation.navigate('DogDetail', { dogId });
          }}
          accessibilityLabel={`View ${dogDisplayName}'s profile`}
          accessibilityRole="button"
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Dog{post.dogIds && post.dogIds.length > 1 ? 's' : ''}</Text>
          <View style={styles.dogRow}>
            {allPhotos.length > 0 ? (
              <Image source={{ uri: allPhotos[0] }} style={[styles.dogThumb, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.dogThumbPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                <Text style={styles.dogThumbEmoji}>🐕</Text>
              </View>
            )}
            <View style={styles.dogInfo}>
              <Text style={[styles.dogName, { color: colors.text }]}>{dogDisplayName}</Text>
              {dogDisplayBreed && <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dogDisplayBreed}</Text>}
            </View>
            <Text style={{ color: '#999', fontSize: 20 }}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Care Details (type → date → description) ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Care Details</Text>
          {post.careType && (
            <Text style={[styles.careDetailLine, { color: colors.text }]}>
              Type: {getCareTypeLabel(post.careType)}
            </Text>
          )}
          <Text style={[styles.careDetailLine, { color: colors.text }]}>
            Date: {post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          {post.careDetails ? (
            <Text style={[styles.careDetails, { color: colors.text, marginTop: 8 }]}>{post.careDetails}</Text>
          ) : null}
        </View>

        {/* ── Compensation (LAST before helpers) ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Compensation</Text>
          <Text style={[styles.compText, { color: colors.text }]}>{compensationLabel()}</Text>
          {(post.compensationType === 'payment' || post.compensationType === 'either') && (
            <View style={[styles.offAppNote, { backgroundColor: '#FFF9E6', borderColor: '#F0C040' }]}>
              <Text style={[styles.offAppNoteText, { color: '#7A6000' }]}>
                All payments are arranged and made outside of WatchDog. We do not process payments.
              </Text>
            </View>
          )}
        </View>

        {/* ── Interested Helpers (owner only) ── */}
        {isOwner && respondents.length > 0 && (
          <View style={styles.helpersSection}>
            <View style={styles.helpersSectionHeader}>
              <Text style={styles.helpersSectionTitle}>
                🙋 Interested Helpers ({respondents.length})
              </Text>
              {post.status === 'claimed' && (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedBadgeText}>✅ APPROVED</Text>
                </View>
              )}
            </View>

            {respondents.map((r) => {
              const isApproved = post.claimedBy === r.userId;
              const isApproving = approvingId === r.userId;
              const hasCounter = r.counterPoints !== undefined;
              const counterStatus = r.counterStatus;

              return (
                <View key={r.userId} style={styles.helperRow}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('UserDetail', { userId: r.userId })}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${r.userName}'s profile`}
                    style={styles.helperAvatarTouchable}
                  >
                    {r.userPhotoURL ? (
                      <Image source={{ uri: r.userPhotoURL }} style={styles.helperAvatar} />
                    ) : (
                      <View style={styles.helperAvatarPlaceholder}>
                        <Text style={styles.helperAvatarEmoji}>🧑</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.helperInfo}
                    onPress={() => navigation.navigate('UserDetail', { userId: r.userId })}
                    accessibilityLabel={`View ${r.userName}'s profile`}
                  >
                    <Text style={styles.helperName}>{r.userName}</Text>

                    {isApproved ? (
                      <Text style={styles.helperApprovedLabel}>✅ Approved sitter</Text>
                    ) : hasCounter ? (
                      // Counter offer display
                      <View>
                        <Text style={styles.helperCounterLabel}>
                          🔄 Counter: {r.counterPoints} pts
                          {counterStatus === 'accepted' ? ' ✅ Accepted' : counterStatus === 'declined' ? ' ❌ Declined' : ''}
                        </Text>
                        {/* Accept/Decline buttons for pending counters */}
                        {counterStatus === 'pending' && (
                          <View style={styles.counterBtnRow}>
                            <TouchableOpacity
                              style={[styles.counterAcceptBtn, { backgroundColor: GREEN }]}
                              onPress={() => handleCounterResponse(r.userId, r.userName, true)}
                            >
                              <Text style={styles.counterBtnText}>Accept ✅</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.counterDeclineBtn, { borderColor: colors.error }]}
                              onPress={() => handleCounterResponse(r.userId, r.userName, false)}
                            >
                              <Text style={[styles.counterDeclineBtnText, { color: colors.error }]}>Decline ❌</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.helperAcceptedPts}>
                        ✓ Accepted {offeredPoints} pts
                      </Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.helperActions}>
                    {post.status === 'open' && !isApproved && !hasCounter && (
                      <TouchableOpacity
                        style={[styles.approveBtn, isApproving && styles.approveBtnDisabled]}
                        onPress={() => handleApprove(r.userId, r.userName)}
                        disabled={isApproving}
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${r.userName}`}
                      >
                        <Text style={styles.approveBtnText}>{isApproving ? '…' : 'Approve'}</Text>
                      </TouchableOpacity>
                    )}
                    {post.status === 'open' && !isApproved && hasCounter && counterStatus === 'pending' && (
                      <View style={[styles.approveBtn, { backgroundColor: '#FDCB6E' }]}>  
                        <Text style={[styles.approveBtnText, { color: '#000' }]}>Review Counter</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── I Can Help button ── */}
        {!isOwner && post.status === 'open' && (() => {
          const alreadyResponded = respondents.some((r) => r.userId === user?.uid);
          if (alreadyResponded) {
            return (
              <View style={[styles.helpBtn, styles.helpBtnAlreadyResponded]} accessibilityLabel="Already responded">
                <Text style={[styles.helpBtnText, { color: '#636E72' }]}>Already Responded ✓</Text>
              </View>
            );
          }
          return (
            <TouchableOpacity
              style={[styles.helpBtn, { backgroundColor: colors.primary, opacity: (claiming || counterSubmitting) ? 0.7 : 1 }]}
              onPress={handleHelpButtonPress}
              disabled={claiming || counterSubmitting}
              accessibilityLabel="I can help!"
              accessibilityRole="button"
            >
              <Text style={styles.helpBtnText}>{claiming ? 'Opening chat...' : 'I Can Help! 🐾'}</Text>
            </TouchableOpacity>
          );
        })()}

        {isOwner && respondents.length === 0 && (
          <View style={[styles.ownerNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.ownerNoteText, { color: colors.textSecondary }]}>
              👆 This is your post. Interested sitters will message you.
            </Text>
          </View>
        )}

        {/* ── Delete Post (owner only) ── */}
        {isOwner && post.status === 'open' && (
          <TouchableOpacity
            style={styles.deletePostBtn}
            onPress={() => {
              Alert.alert(
                'Delete Post',
                'Are you sure you want to delete this post? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await cancelPost(post.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        navigation.goBack();
                      } catch (err) {
                        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
                      }
                    },
                  },
                ],
              );
            }}
            accessibilityLabel="Delete this post"
            accessibilityRole="button"
          >
            <Text style={styles.deletePostBtnText}>Delete Post</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
};

// ─── Carousel Styles ──────────────────────────────────────────────────────────

const carouselStyles = StyleSheet.create({
  container: { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT, backgroundColor: '#111' },
  slide: { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT },
  image: { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT },
  placeholder: { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 64, marginBottom: 8 },
  placeholderText: { fontSize: 16, color: '#666', fontWeight: '600' },
  dotsRow: { position: 'absolute', bottom: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotActive: { backgroundColor: '#FFFFFF', width: 9, height: 9, borderRadius: 4.5 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.45)' },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  safeTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  closeBtn: { alignSelf: 'flex-end', margin: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  slide: { width: SCREEN_WIDTH, flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: SCREEN_WIDTH, height: '100%' },
  safeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  dotsRow: { paddingBottom: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotActive: { backgroundColor: '#FFFFFF', width: 9, height: 9, borderRadius: 4.5 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.4)' },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16 },
  section: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },

  // Care type banner
  careTypeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  careTypeBannerIcon: { fontSize: 30 },
  careTypeBannerLabel: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  careTypeSchedule: { fontSize: 14, fontWeight: '500' },

  // Poster
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1 },
  posterAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  posterAvatarEmoji: { fontSize: 22 },
  posterInfo: { flex: 1 },
  posterNameRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  posterName: { fontSize: 16, fontWeight: '700' },
  ownerLabel: { fontSize: 13, fontWeight: '400', color: '#999999' },
  postedAt: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Dog
  dogRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dogThumb: { width: 60, height: 60, borderRadius: borderRadius.md, borderWidth: 1 },
  dogThumbPlaceholder: { width: 60, height: 60, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  dogThumbEmoji: { fontSize: 28 },
  dogInfo: { flex: 1 },
  dogName: { fontSize: 17, fontWeight: '700' },
  dogBreed: { fontSize: 13, marginTop: 2 },

  // Dates
  dates: { fontSize: 16, fontWeight: '600' },

  // Compensation
  compText: { fontSize: 15, fontWeight: '400', marginBottom: spacing.sm },
  offAppNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.xs },
  offAppNoteText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },

  // Care details
  careDetailLine: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  careDetails: { fontSize: 14, lineHeight: 22 },

  // Interested Helpers RED section
  helpersSection: { borderRadius: borderRadius.lg, marginBottom: spacing.md, marginHorizontal: spacing.md, overflow: 'hidden', borderWidth: 2, borderColor: RED, backgroundColor: 'rgba(255,45,85,0.06)', shadowColor: RED, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 4 },
  helpersSectionHeader: { backgroundColor: RED, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpersSectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  claimedBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  claimedBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  helperRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,45,85,0.25)' },
  helperAvatarTouchable: {},
  helperAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: RED },
  helperAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,45,85,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: RED },
  helperAvatarEmoji: { fontSize: 20 },
  helperInfo: { flex: 1 },
  helperActions: { alignItems: 'flex-end', gap: spacing.xs },
  helperName: { fontSize: 15, fontWeight: '600', color: '#2D3436' },
  helperTap: { fontSize: 12, marginTop: 2 },
  helperApprovedLabel: { fontSize: 12, marginTop: 2, color: '#00B894', fontWeight: '600' },
  helperAcceptedPts: { fontSize: 12, marginTop: 2, color: '#00B894', fontWeight: '600' },
  helperCounterLabel: { fontSize: 13, fontWeight: '700', color: '#E17055', marginTop: 2 },
  helperMsgBtn: { paddingVertical: 2 },

  // Counter offer buttons
  counterBtnRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  counterAcceptBtn: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  counterDeclineBtn: { borderWidth: 1.5, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  counterBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  counterDeclineBtnText: { fontSize: 12, fontWeight: '700' },

  // Approve button
  approveBtn: { backgroundColor: RED, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 7 },
  approveBtnDisabled: { opacity: 0.5 },
  approveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Help button
  helpBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm, marginHorizontal: spacing.md },
  helpBtnAlreadyResponded: { backgroundColor: '#E8E8E8' },
  helpBtnText: { color: '#fff', ...typography.button, fontSize: 17 },

  // Owner note
  ownerNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', marginHorizontal: spacing.md },
  ownerNoteText: { fontSize: 14 },
  deletePostBtn: { backgroundColor: '#FF3B3020', borderWidth: 1.5, borderColor: '#FF3B30', borderRadius: 12, padding: 14, alignItems: 'center' as const, marginHorizontal: 16, marginTop: 16 },
  deletePostBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },

  // "I Can Help" modal
  helpModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  helpModalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing.xl * 2, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  helpModalTitle: { fontSize: 20, fontWeight: '800', marginBottom: spacing.xs, textAlign: 'center' },
  helpModalSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: spacing.lg },
  helpModalAcceptBtn: { borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  helpModalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  helpModalCounterBtn: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  helpModalCounterBtnText: { fontSize: 16, fontWeight: '600' },
  helpModalCancelLink: { alignItems: 'center', paddingVertical: spacing.sm },
  helpModalCancelText: { fontSize: 14 },

  // Counter offer input
  counterInputLabel: { fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  counterInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  counterInput: { flex: 1, borderWidth: 2, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  counterInputUnit: { fontSize: 16, fontWeight: '600' },
});

export default PostDetailScreen;
