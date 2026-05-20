/**
 * PostDetailScreen — full details for a public swap post.
 *
 * SUB-TASK 1: Big dog photos carousel at top (~40% screen, paginated, tap-to-fullscreen)
 * SUB-TASK 2: Multi-dog support (dogIds[] array + backward compat single-dog fields)
 * SUB-TASK 3: "(owner)" label next to poster name
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
import { useMessaging } from '../../hooks/useMessaging';
import { SwapPost } from '../../models/types';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { scheduleOwnerReminders, requestNotificationPermissions } from '../../services/ReminderService';

const RED = '#FF2D55';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = Math.round(Dimensions.get('window').height * 0.4);

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<RequestsStackParamList, 'PostDetail'>;
  route: RouteProp<RequestsStackParamList, 'PostDetail'>;
};

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
            <Image
              source={{ uri: item }}
              style={carouselStyles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />
      {/* Pagination dots */}
      {photos.length > 1 && (
        <View style={carouselStyles.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[
                carouselStyles.dot,
                i === activeIndex ? carouselStyles.dotActive : carouselStyles.dotInactive,
              ]}
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

const FullscreenPhotoModal: React.FC<FullscreenModalProps> = ({
  photos,
  initialIndex,
  visible,
  onClose,
}) => {
  const flatRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Scroll to initial photo when modal opens
  useEffect(() => {
    if (visible && flatRef.current && photos.length > 1) {
      // Small timeout to allow FlatList to mount
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
      <View style={modalStyles.overlay}>
        {/* Close button */}
        <SafeAreaView style={modalStyles.safeTop} pointerEvents="box-none">
          <TouchableOpacity
            style={modalStyles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Close photo"
            accessibilityRole="button"
          >
            <Text style={modalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Full-screen photo list */}
        <FlatList
          ref={flatRef}
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={modalStyles.slide}>
              <Image
                source={{ uri: item }}
                style={modalStyles.image}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Pagination dots */}
        {photos.length > 1 && (
          <SafeAreaView style={modalStyles.safeBottom} pointerEvents="none">
            <View style={modalStyles.dotsRow}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    modalStyles.dot,
                    i === activeIndex ? modalStyles.dotActive : modalStyles.dotInactive,
                  ]}
                />
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
  const { getAreaPosts, getMyPosts, addResponder, approveHelper, saveOwnerReminderIds } = useSwaps();
  const { getOrCreateConversation, sendMessage } = useMessaging();

  const [post, setPost] = useState<SwapPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Photo carousel / fullscreen state
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);

  const postId = route.params?.postId;

  // Build photo list from post + optionally fetch dog doc for full photoURLs array
  const buildPhotos = async (p: SwapPost): Promise<string[]> => {
    // Prefer multi-dog photo array if populated
    if (p.dogPhotoURLs && p.dogPhotoURLs.length > 0) {
      return p.dogPhotoURLs;
    }

    // Try fetching from Firestore Dog document (has photoURLs[])
    if (p.dogId) {
      try {
        const dogSnap = await getDoc(doc(db, 'dogs', p.dogId));
        if (dogSnap.exists()) {
          const dogData = dogSnap.data() as { photoURLs?: string[] };
          if (dogData.photoURLs && dogData.photoURLs.length > 0) {
            return dogData.photoURLs;
          }
        }
      } catch {
        // Non-fatal — fall through
      }
    }

    // Also try dogIds array (multi-dog — fetch first dog's photos)
    if (p.dogIds && p.dogIds.length > 0) {
      try {
        const dogSnap = await getDoc(doc(db, 'dogs', p.dogIds[0]));
        if (dogSnap.exists()) {
          const dogData = dogSnap.data() as { photoURLs?: string[] };
          if (dogData.photoURLs && dogData.photoURLs.length > 0) {
            return dogData.photoURLs;
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // Fallback to single denormalised photo on post
    if (p.dogPhotoURL) return [p.dogPhotoURL];
    return [];
  };

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    const fetchPost = async () => {
      try {
        const areaPosts = await getAreaPosts();
        const found = areaPosts.find((p) => p.id === postId) ?? null;
        if (found) {
          setPost(found);
          const photos = await buildPhotos(found);
          setAllPhotos(photos);
          return;
        }
        if (user?.uid) {
          const myPosts = await getMyPosts(user.uid);
          const ownPost = myPosts.find((p) => p.id === postId) ?? null;
          setPost(ownPost);
          if (ownPost) {
            const photos = await buildPhotos(ownPost);
            setAllPhotos(photos);
          }
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

  const handleHelp = async () => {
    if (!user || !post) return;
    if (user.uid === post.posterId) {
      Alert.alert("That's your post!", "You can't respond to your own request.");
      return;
    }

    setClaiming(true);
    try {
      const sitterName = userProfile?.displayName ?? user.displayName ?? 'Someone';
      const sitterPhoto = userProfile?.photoURL ?? user.photoURL ?? undefined;
      const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

      // Build dog name display (multi-dog aware)
      const dogDisplayName = post.dogNames && post.dogNames.length > 1
        ? post.dogNames.join(' & ')
        : post.dogName;

      const convId = await getOrCreateConversation(user.uid, post.posterId, post.id);

      const introText = `🐾 Hey! I'd love to help watch ${dogDisplayName} from ${startStr} to ${endStr}. Let me know if you'd like to set something up!`;
      await sendMessage(convId, user.uid, introText);

      if (post.compensationType === 'payment' || post.compensationType === 'either') {
        await sendMessage(
          convId,
          user.uid,
          '💰 Reminder: All payments are arranged and made outside of SwapDog.'
        );
      }

      await addResponder(post.id, {
        userId: user.uid,
        userName: sitterName,
        userPhotoURL: sitterPhoto,
      });

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
    Alert.alert(
      'Approve Helper',
      `Choose ${helperName} as your dog sitter for this post?`,
      [
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
                    ? post.dogNames.join(' & ')
                    : post.dogName;
                  const ownerIds = await scheduleOwnerReminders({
                    startDate: post.startDate,
                    dogName: dogDisplayName,
                    ownerName: post.posterName,
                    sitterName: helperName,
                  });
                  if (ownerIds.length > 0) {
                    await saveOwnerReminderIds(post.id, ownerIds);
                  }
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
      ]
    );
  };

  if (loading) return <LoadingSpinner />;
  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Post not found</Text>
      </View>
    );
  }

  const startStr = post.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = post.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const isOwner = user?.uid === post.posterId;
  const respondents = post.respondedBy ?? [];

  // Multi-dog display helpers
  const dogDisplayName = post.dogNames && post.dogNames.length > 1
    ? post.dogNames.join(' & ')
    : post.dogName;
  const dogDisplayBreed = post.dogBreeds && post.dogBreeds.length > 1
    ? post.dogBreeds.join(', ')
    : post.dogBreed;

  const compensationLabel = () => {
    if (post.compensationType === 'points') {
      return `🪙 ${post.pointsCost.toFixed(1)} point${post.pointsCost !== 1 ? 's' : ''}`;
    }
    if (post.totalPayment && post.paymentAmount && post.totalUnits && post.paymentRate) {
      const rateLabel = post.paymentRate === 'per_hour' ? '/hr' : '/day';
      const unitLabel = post.paymentRate === 'per_hour'
        ? `${post.totalUnits} hr${post.totalUnits !== 1 ? 's' : ''}`
        : `${post.totalUnits} day${post.totalUnits !== 1 ? 's' : ''}`;
      return `💰 $${post.totalPayment} total ($${post.paymentAmount}${rateLabel} × ${unitLabel})`;
    }
    return post.compensationType === 'either'
      ? `🪙 ${post.pointsCost.toFixed(1)} pts or 💰 payment`
      : '💰 Payment offered';
  };

  return (
    <>
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
        {/* ── SUB-TASK 1: Big Dog Photo Carousel ── */}
        <PhotoCarouselSection
          photos={allPhotos}
          onPhotoPress={handlePhotoPress}
        />

        {/* ── Poster info (SUB-TASK 3: "(owner)" label) ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <View style={styles.posterRow}>
            {post.posterPhotoURL ? (
              <Image source={{ uri: post.posterPhotoURL }} style={[styles.posterAvatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.posterAvatarPlaceholder, { backgroundColor: colors.primary + '22', borderColor: colors.border }]}>
                <Text style={styles.posterAvatarEmoji}>🧑</Text>
              </View>
            )}
            <View style={styles.posterInfo}>
              {/* SUB-TASK 3: "(owner)" label inline with poster name */}
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
        </View>

        {/* ── Dog info (SUB-TASK 2: multi-dog names/breeds) ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🐶 Dog{post.dogIds && post.dogIds.length > 1 ? 's' : ''}</Text>
          <View style={styles.dogRow}>
            {allPhotos.length > 0 ? (
              <TouchableOpacity onPress={() => handlePhotoPress(0)}>
                <Image source={{ uri: allPhotos[0] }} style={[styles.dogThumb, { borderColor: colors.border }]} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.dogThumbPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                <Text style={styles.dogThumbEmoji}>🐕</Text>
              </View>
            )}
            <View style={styles.dogInfo}>
              <Text style={[styles.dogName, { color: colors.text }]}>{dogDisplayName}</Text>
              {dogDisplayBreed && (
                <Text style={[styles.dogBreed, { color: colors.textSecondary }]}>{dogDisplayBreed}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Dates</Text>
          <Text style={[styles.dates, { color: colors.text }]}>
            {startStr} – {endStr}
          </Text>
        </View>

        {/* Compensation */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Compensation</Text>
          <Text style={[styles.compText, { color: colors.text }]}>
            {compensationLabel()}
          </Text>
          {(post.compensationType === 'payment' || post.compensationType === 'either') && (
            <View style={[styles.offAppNote, { backgroundColor: '#FFF9E6', borderColor: '#F0C040' }]}>
              <Text style={[styles.offAppNoteText, { color: '#7A6000' }]}>
                💰 All payments are arranged and made outside of SwapDog. We do not process payments.
              </Text>
            </View>
          )}
        </View>

        {/* Care details */}
        <View style={[styles.section, { backgroundColor: colors.surface, ...shadow.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Care Details</Text>
          <Text style={[styles.careDetails, { color: colors.text }]}>{post.careDetails}</Text>
        </View>

        {/* ── Interested Helpers — RED accent section, owner only ── */}
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
              return (
                <View key={r.userId} style={styles.helperRow}>
                  <TouchableOpacity
                    onPress={() => handleMessageResponder(r.userId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${r.userName}`}
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
                    onPress={() => handleMessageResponder(r.userId)}
                    style={styles.helperInfo}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${r.userName}`}
                  >
                    <Text style={styles.helperName}>{r.userName}</Text>
                    {isApproved ? (
                      <Text style={styles.helperApprovedLabel}>✅ Approved sitter</Text>
                    ) : (
                      <Text style={styles.helperTap}>Tap to message →</Text>
                    )}
                  </TouchableOpacity>

                  {post.status === 'open' && !isApproved && (
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
                </View>
              );
            })}
          </View>
        )}

        {/* I Can Help button (not shown for own posts) */}
        {!isOwner && post.status === 'open' && (() => {
          const alreadyResponded = respondents.some((r) => r.userId === user?.uid);
          if (alreadyResponded) {
            return (
              <View
                style={[styles.helpBtn, styles.helpBtnAlreadyResponded]}
                accessibilityLabel="Already responded to this post"
              >
                <Text style={[styles.helpBtnText, { color: '#636E72' }]}>Already Responded ✓</Text>
              </View>
            );
          }
          return (
            <TouchableOpacity
              style={[styles.helpBtn, { backgroundColor: colors.primary, opacity: claiming ? 0.7 : 1 }]}
              onPress={handleHelp}
              disabled={claiming}
              accessibilityLabel={claiming ? 'Sending message...' : 'I can help!'}
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
      </ScrollView>
    </>
  );
};

// ─── Carousel Styles ──────────────────────────────────────────────────────────

const carouselStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#111',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  image: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  placeholder: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  safeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    margin: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  safeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dotsRow: {
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16 },
  section: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  // Poster
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1 },
  posterAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  posterAvatarEmoji: { fontSize: 22 },
  posterInfo: { flex: 1 },
  // SUB-TASK 3: name row with (owner) label
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
  careDetails: { fontSize: 14, lineHeight: 22 },
  // ── Interested Helpers RED section ──────────────────────────────────────────
  helpersSection: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: RED,
    backgroundColor: 'rgba(255,45,85,0.06)',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  helpersSectionHeader: {
    backgroundColor: RED,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpersSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  claimedBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  claimedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,45,85,0.25)',
  },
  helperAvatarTouchable: {},
  helperAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: RED },
  helperAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,45,85,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: RED,
  },
  helperAvatarEmoji: { fontSize: 20 },
  helperInfo: { flex: 1 },
  helperName: { fontSize: 15, fontWeight: '600', color: '#2D3436' },
  helperTap: { fontSize: 12, marginTop: 2, color: RED },
  helperApprovedLabel: { fontSize: 12, marginTop: 2, color: '#00B894', fontWeight: '600' },
  // Approve button
  approveBtn: {
    backgroundColor: RED,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  approveBtnDisabled: { opacity: 0.5 },
  approveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  // Help button
  helpBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm, marginHorizontal: spacing.md },
  helpBtnAlreadyResponded: { backgroundColor: '#E8E8E8' },
  helpBtnText: { color: '#fff', ...typography.button, fontSize: 17 },
  // Owner note
  ownerNote: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', marginHorizontal: spacing.md },
  ownerNoteText: { fontSize: 14 },
});

export default PostDetailScreen;
