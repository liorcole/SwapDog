import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
import {
  GooglePlacesAutocomplete,
  GooglePlaceData,
  GooglePlaceDetail,
} from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { DiscoverStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUsers } from '../../hooks/useUsers';
import { useDiscoverLocation } from '../../hooks/useDiscoverLocation';
import { User, GeoPoint } from '../../models/types';
import { calculateDistance, formatDistance } from '../../utils/calculateDistance';
import { spacing, borderRadius, shadow, typography } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';
import ShimmerLoading from '../../components/common/ShimmerLoading';

// ─── Constants ───────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map height constraints
const MAP_HEIGHT_DEFAULT = Math.round(SCREEN_HEIGHT * 0.40);
const MAP_HEIGHT_MIN = Math.round(SCREEN_HEIGHT * 0.15);
const MAP_HEIGHT_MAX = Math.round(SCREEN_HEIGHT * 0.60);

// Drag handle height
const HANDLE_HEIGHT = 28;

// How long to wait after the last region change before updating radius/query
const REGION_DEBOUNCE_MS = 600;

// Google Maps API key (same project as Firebase — swapdog-d0cfe)
const GOOGLE_API_KEY = 'AIzaSyBOF66WalEIXlKnowKip26mxkIAR4EfTpA';

// Preset radius options in miles
const RADIUS_OPTIONS = [1, 5, 10, 25] as const;
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'Discover'>;
};

// ─── Radius Selector ─────────────────────────────────────────────────────────

interface RadiusSelectorProps {
  radiusMiles: number;
  onSelectPreset: (r: RadiusMiles) => void;
}

const RadiusSelector: React.FC<RadiusSelectorProps> = memo(({ radiusMiles, onSelectPreset }) => {
  const { colors } = useTheme();
  // Show a preset as "active" only when the value exactly matches
  const activePreset = (RADIUS_OPTIONS as readonly number[]).includes(radiusMiles)
    ? (radiusMiles as RadiusMiles)
    : null;

  return (
    <View style={styles.radiusRow}>
      <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>Radius:</Text>
      {RADIUS_OPTIONS.map((r) => {
        const active = r === activePreset;
        return (
          <TouchableOpacity
            key={r}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectPreset(r);
            }}
            style={[
              styles.radiusChip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            accessibilityLabel={`Set radius to ${r} mile${r > 1 ? 's' : ''}`}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.radiusChipText,
                { color: active ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {r} mi
            </Text>
          </TouchableOpacity>
        );
      })}
      {/* Live radius display when not matching a preset */}
      {activePreset === null && (
        <View
          style={[
            styles.radiusChip,
            { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.radiusChipText, { color: '#FFFFFF' }]}>
            {radiusMiles < 10
              ? radiusMiles.toFixed(1)
              : Math.round(radiusMiles).toString()} mi
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── User Row ────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: User;
  distanceMiles: number;
  dogCount: number;
  onPress: () => void;
}

const UserRow: React.FC<UserRowProps> = memo(({ user, distanceMiles, dogCount, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: colors.surface, ...shadow.sm }]}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel={`${user.displayName}, ${formatDistance(distanceMiles)}`}
      accessibilityRole="button"
      accessibilityHint="Opens this user's full profile"
    >
      <Image
        source={
          user.photoURL ? { uri: user.photoURL } : require('../../../assets/icon.png')
        }
        style={styles.avatar}
        accessibilityLabel={`${user.displayName}'s profile photo`}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>{user.displayName}</Text>
        <Text style={[styles.userDistance, { color: colors.primary }]}>
          📍 {formatDistance(distanceMiles)}
        </Text>
        {dogCount > 0 && (
          <Text style={[styles.userDogs, { color: colors.textSecondary }]}>
            🐶 {dogCount} dog{dogCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
      <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
});

// ─── Location Override Modal (with Google Places Autocomplete) ───────────────

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coords: GeoPoint, label: string) => void;
  onUseCurrentLocation: () => void;
  isOverride: boolean;
}

const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  onUseCurrentLocation,
  isOverride,
}) => {
  const { colors } = useTheme();
  const [resolving, setResolving] = useState(false);

  const handlePlaceSelect = useCallback(
    (data: GooglePlaceData, details: GooglePlaceDetail | null) => {
      if (!details?.geometry?.location) {
        // Fallback: geocode using expo-location if details are missing
        setResolving(true);
        void Location.geocodeAsync(data.description)
          .then((results) => {
            if (results.length === 0) {
              Alert.alert('Not found', 'Could not find that location. Try a different address.');
              return;
            }
            const { latitude, longitude } = results[0];
            onConfirm({ latitude, longitude }, data.description);
          })
          .catch(() => {
            Alert.alert('Error', 'Could not resolve that location. Please try again.');
          })
          .finally(() => setResolving(false));
        return;
      }
      const { lat, lng } = details.geometry.location;
      onConfirm({ latitude: lat, longitude: lng }, data.description);
    },
    [onConfirm],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Change Location</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Search for a city, neighborhood, or address to find dogs nearby.
          </Text>

          {/* Google Places Autocomplete */}
          <View style={styles.autocompleteWrapper}>
            <GooglePlacesAutocomplete
              placeholder="e.g. Brooklyn, NY or 27 Ridge Dr"
              onPress={handlePlaceSelect}
              fetchDetails
              query={{
                key: GOOGLE_API_KEY,
                language: 'en',
                components: 'country:us',
              }}
              enablePoweredByContainer={false}
              keepResultsAfterBlur={false}
              autoFillOnNotFound={false}
              styles={{
                textInput: {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1.5,
                  borderRadius: borderRadius.md,
                  color: colors.text,
                  fontSize: 16,
                  paddingHorizontal: spacing.md,
                  height: 48,
                },
                textInputContainer: {
                  paddingHorizontal: 0,
                  backgroundColor: 'transparent',
                },
                listView: {
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: 4,
                  maxHeight: 220,
                },
                row: {
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
                description: {
                  color: colors.text,
                  fontSize: 14,
                },
                poweredContainer: { display: 'none' },
              }}
            />
          </View>

          {resolving && (
            <View style={styles.resolvingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.resolvingText, { color: colors.textSecondary }]}>
                Resolving location…
              </Text>
            </View>
          )}

          {isOverride && (
            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.secondary }]}
              onPress={() => {
                onUseCurrentLocation();
                onClose();
              }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.secondary }]}>
                📡 Use My Current Location
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.modalCancel}>
            <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

interface NearbyUser {
  user: User;
  distanceMiles: number;
  dogCount: number;
}

const DiscoverScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { userProfile } = useAuthContext();
  const { getUsersByLocation } = useUsers();

  const {
    location,
    loading: locationLoading,
    setLocationOverride,
    clearLocationOverride,
  } = useDiscoverLocation();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [radiusMiles, setRadiusMiles] = useState<number>(5);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const mapRef = useRef<MapView>(null);

  // Debounce timer ref for region changes
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Radius in meters for the Circle overlay
  const radiusMeters = useMemo(() => radiusMiles * 1609.34, [radiusMiles]);

  // ── Collapsible map: Animated height ────────────────────────────────────────
  const mapHeightAnim = useRef(new Animated.Value(MAP_HEIGHT_DEFAULT)).current;
  // We track the "committed" height so PanResponder can offset from it
  const committedMapHeight = useRef(MAP_HEIGHT_DEFAULT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Capture current animated value so we can offset from it
        mapHeightAnim.stopAnimation((val) => {
          committedMapHeight.current = val;
        });
      },
      onPanResponderMove: (_evt, gestureState) => {
        const newHeight = committedMapHeight.current + gestureState.dy;
        const clamped = Math.max(MAP_HEIGHT_MIN, Math.min(MAP_HEIGHT_MAX, newHeight));
        mapHeightAnim.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const newHeight = committedMapHeight.current + gestureState.dy;
        const clamped = Math.max(MAP_HEIGHT_MIN, Math.min(MAP_HEIGHT_MAX, newHeight));
        // Snap: if dragged past halfway towards min, snap to min; otherwise to default/max
        let snapTarget: number;
        const midDown = (MAP_HEIGHT_MIN + MAP_HEIGHT_DEFAULT) / 2;
        const midUp = (MAP_HEIGHT_DEFAULT + MAP_HEIGHT_MAX) / 2;
        if (clamped < midDown) {
          snapTarget = MAP_HEIGHT_MIN;
        } else if (clamped > midUp) {
          snapTarget = MAP_HEIGHT_MAX;
        } else {
          snapTarget = MAP_HEIGHT_DEFAULT;
        }
        committedMapHeight.current = snapTarget;
        Animated.spring(mapHeightAnim, {
          toValue: snapTarget,
          useNativeDriver: false,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  // ── Fetch nearby users whenever location or radius changes ──────────────────
  const fetchNearby = useCallback(async () => {
    if (!location) return;
    setUsersLoading(true);
    try {
      const radiusKm = radiusMiles * 1.60934;
      const all = await getUsersByLocation(location.coords, radiusKm);
      const filtered = all.filter((u) => u.id !== userProfile?.id && u.location != null);
      const withDistance: NearbyUser[] = filtered
        .map((u) => ({
          user: u,
          distanceMiles: calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            u.location!.latitude,
            u.location!.longitude,
          ),
          dogCount: 0,
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles);
      setNearbyUsers(withDistance);
    } catch {
      // silent
    } finally {
      setUsersLoading(false);
    }
  }, [location, radiusMiles, userProfile?.id, getUsersByLocation]);

  useEffect(() => {
    void fetchNearby();
  }, [fetchNearby]);

  // ── Re-center map when location or radius changes (from preset buttons) ──────
  const animateMapToRadius = useCallback(
    (lat: number, lng: number, miles: number) => {
      if (!mapRef.current) return;
      // latitudeDelta ≈ miles * 2 / 69  (then ×2.5 for comfortable padding)
      const delta = Math.max(0.02, (miles / 69) * 2 * 2.5);
      const region: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
      mapRef.current.animateToRegion(region, 600);
    },
    [],
  );

  useEffect(() => {
    if (!location) return;
    animateMapToRadius(location.coords.latitude, location.coords.longitude, radiusMiles);
    // NOTE: only runs when location changes — radius-preset button taps call
    // animateMapToRadius directly to avoid circular updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Zoom ↔ Radius sync: when user pinch-zooms, update radius ─────────────
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      // Debounce to avoid firing on every micro-movement
      if (regionDebounceRef.current) {
        clearTimeout(regionDebounceRef.current);
      }
      regionDebounceRef.current = setTimeout(() => {
        // 1° latitude ≈ 69 miles; visible half-height = latitudeDelta/2
        const visibleRadiusMiles = (region.latitudeDelta / 2) * 69;
        const rounded = Math.round(visibleRadiusMiles * 10) / 10;
        // Only update if the change is significant (>0.2 mi) to avoid jitter
        setRadiusMiles((prev) => {
          return Math.abs(rounded - prev) >= 0.2 ? rounded : prev;
        });
      }, REGION_DEBOUNCE_MS);
    },
    [],
  );

  // ── Preset button taps: set radius AND animate map ───────────────────────
  const handlePresetSelect = useCallback(
    (r: RadiusMiles) => {
      setRadiusMiles(r);
      if (location) {
        animateMapToRadius(location.coords.latitude, location.coords.longitude, r);
      }
    },
    [location, animateMapToRadius],
  );

  // ── Handle location override confirmed ──────────────────────────────────────
  const handleLocationConfirm = useCallback(
    async (coords: GeoPoint, label: string) => {
      await setLocationOverride(coords, label);
      setLocationModalVisible(false);
    },
    [setLocationOverride],
  );

  // ── Memoized FlatList renderItem to prevent re-renders ───────────────────
  const renderUserItem = useCallback(
    ({ item }: { item: NearbyUser }) => (
      <UserRow
        user={item.user}
        distanceMiles={item.distanceMiles}
        dogCount={item.dogCount}
        onPress={() => navigation.navigate('UserDetail', { userId: item.user.id })}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: NearbyUser) => item.user.id, []);

  // ── Memoized list header ──────────────────────────────────────────────────
  const listHeader = useMemo(
    () => (
      <Text style={[styles.listHeader, { color: colors.textSecondary }]}>
        {nearbyUsers.length === 0
          ? 'No dog owners found in this area'
          : `${nearbyUsers.length} dog owner${nearbyUsers.length !== 1 ? 's' : ''} within ${
              radiusMiles < 10
                ? radiusMiles.toFixed(1)
                : Math.round(radiusMiles).toString()
            } mi`}
      </Text>
    ),
    [nearbyUsers.length, radiusMiles, colors.textSecondary],
  );

  // ── Loading state ────────────────────────────────────────────────────────────
  if (locationLoading || !location) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ height: MAP_HEIGHT_DEFAULT, margin: spacing.md }}>
          <ShimmerLoading height={MAP_HEIGHT_DEFAULT} borderRadius={borderRadius.lg} />
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}>
            <ShimmerLoading height={72} borderRadius={borderRadius.md} />
          </View>
        ))}
      </View>
    );
  }

  const initialRegion: Region = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: Math.max(0.05, (radiusMiles / 69) * 2 * 2.5),
    longitudeDelta: Math.max(0.05, (radiusMiles / 69) * 2 * 2.5),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── ANIMATED MAP CONTAINER ── */}
      <Animated.View
        style={[
          styles.mapContainer,
          {
            height: mapHeightAnim,
            borderBottomLeftRadius: borderRadius.lg,
            borderBottomRightRadius: borderRadius.lg,
            overflow: 'hidden',
          },
        ]}
      >
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {/* User's own position marker */}
          <Marker
            coordinate={location.coords}
            title={location.isOverride ? (location.label ?? 'Custom Location') : 'Your Location'}
            pinColor={colors.primary}
          />
          {/* Search radius circle overlay */}
          <Circle
            center={location.coords}
            radius={radiusMeters}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor={colors.primary + "1E"}
          />
        </MapView>

        {/* Change Location button — overlaid on map */}
        <TouchableOpacity
          style={[styles.locationBtn, { backgroundColor: colors.surface, ...shadow.md }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLocationModalVisible(true);
          }}
          accessibilityLabel="Change search location"
        >
          <Text style={[styles.locationBtnText, { color: colors.text }]}>
            {location.isOverride ? `📍 ${location.label ?? 'Custom'}` : '📍 Change Location'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── DRAG HANDLE ── */}
      <View
        style={[styles.dragHandle, { backgroundColor: colors.surface, borderColor: colors.border }]}
        {...panResponder.panHandlers}
        accessibilityLabel="Drag to resize map"
        accessibilityRole="adjustable"
      >
        <View style={[styles.dragPill, { backgroundColor: colors.border }]} />
      </View>

      {/* ── RADIUS SELECTOR ── */}
      <View
        style={[
          styles.radiusContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <RadiusSelector radiusMiles={radiusMiles} onSelectPreset={handlePresetSelect} />
      </View>

      {/* ── USER LIST ── */}
      {usersLoading ? (
        <View style={styles.listLoadingContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}>
              <ShimmerLoading height={72} borderRadius={borderRadius.md} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={nearbyUsers}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyStateView
              emoji="🐕"
              title="No dog owners nearby"
              subtitle="Try expanding your radius or changing your location"
            />
          }
          renderItem={renderUserItem}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* ── LOCATION OVERRIDE MODAL ── */}
      <LocationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onConfirm={(coords, label) => { void handleLocationConfirm(coords, label); }}
        onUseCurrentLocation={() => { void clearLocationOverride(); }}
        isOverride={location.isOverride}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Map
  mapContainer: {
    position: 'relative',
  },
  locationBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  locationBtnText: { fontSize: 13, fontWeight: '600' },

  // Drag handle
  dragHandle: {
    height: HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  dragPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // Radius selector
  radiusContainer: {
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  radiusLabel: { fontSize: 13, fontWeight: '600', marginRight: spacing.xs },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  radiusChipText: { fontSize: 13, fontWeight: '600' },

  // List
  listLoadingContainer: { flex: 1, paddingTop: spacing.md },
  list: { padding: spacing.md, paddingTop: spacing.sm },
  listHeader: {
    ...typography.caption,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: spacing.md },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userDistance: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  userDogs: { fontSize: 12 },
  chevron: { fontSize: 22, fontWeight: '300', marginLeft: spacing.xs },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: { ...typography.h3, marginBottom: spacing.xs },
  modalSubtitle: { ...typography.bodySmall, marginBottom: spacing.md },
  autocompleteWrapper: {
    marginBottom: spacing.md,
    // Must have a fixed or min-height so the dropdown doesn't get clipped by the sheet
    zIndex: 10,
    minHeight: 50,
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resolvingText: { fontSize: 14 },
  modalBtnOutline: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  modalBtnOutlineText: { fontSize: 15, fontWeight: '600' },
  modalCancel: { alignItems: 'center', paddingVertical: spacing.sm },
  modalCancelText: { fontSize: 15 },
});

export default DiscoverScreen;
