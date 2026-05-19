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
  TextInput,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map height constraints
const MAP_HEIGHT_DEFAULT = Math.round(SCREEN_HEIGHT * 0.40);
const MAP_HEIGHT_MIN = Math.round(SCREEN_HEIGHT * 0.15);
const MAP_HEIGHT_MAX = Math.round(SCREEN_HEIGHT * 0.60);

// Drag handle height
const HANDLE_HEIGHT = 28;

// Fixed-pixel circle overlay size (constant on screen regardless of zoom)
// 60% of screen width, but at most 280px
const CIRCLE_SIZE = Math.min(Math.round(SCREEN_WIDTH * 0.60), 280);

// How long to wait after the last region change before updating radius/query
const REGION_DEBOUNCE_MS = 600;


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

// ─── Location Override Modal (Nominatim OpenStreetMap autocomplete) ───────────

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coords: GeoPoint, label: string) => void;
  onUseCurrentLocation: () => void;
  isOverride: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  onUseCurrentLocation,
  isOverride,
}) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when modal is dismissed
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSuggestions([]);
    }
  }, [visible]);

  const fetchSuggestions = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setFetching(true);
    void fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'SwapDogApp/1.0' } },
    )
      .then((r) => r.json() as Promise<NominatimResult[]>)
      .then((results) => setSuggestions(results))
      .catch(() => setSuggestions([]))
      .finally(() => setFetching(false));
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
    },
    [fetchSuggestions],
  );

  const handleSelectSuggestion = useCallback(
    (item: NominatimResult) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const parts = item.display_name.split(',');
      const label = parts.slice(0, 3).join(',').trim();
      setSuggestions([]);
      setQuery('');
      onConfirm({ latitude: lat, longitude: lng }, label);
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

          {/* Nominatim autocomplete search */}
          <View style={styles.autocompleteWrapper}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Brooklyn, NY or 27 Ridge Dr"
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleChangeText}
              autoFocus
              clearButtonMode="while-editing"
              returnKeyType="search"
              accessibilityLabel="Search for a location"
            />
            {fetching && (
              <View style={styles.resolvingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.resolvingText, { color: colors.textSecondary }]}>
                  Searching…
                </Text>
              </View>
            )}
            {suggestions.length > 0 && (
              <View
                style={[
                  styles.dropdown,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelectSuggestion(item)}
                    accessibilityLabel={item.display_name}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.dropdownItemText, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

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

  // Track the current map view height so we can calculate the circle/map ratio
  const [mapViewHeight, setMapViewHeight] = useState(MAP_HEIGHT_DEFAULT);

  const mapRef = useRef<MapView>(null);
  // Prevent re-processing onRegionChangeComplete events we triggered ourselves
  const isProgrammaticMoveRef = useRef(false);

  // Debounce timer ref for region changes
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Animate map zoom so the fixed circle represents the given radius ─────────
  // Formula: latitudeDelta such that CIRCLE_SIZE pixels == radiusMiles on screen.
  // The fixed circle covers (CIRCLE_SIZE / mapViewHeight) of the vertical map span.
  // Full map vertical span = latitudeDelta degrees. Circle spans half of that fraction.
  // => latitudeDelta = (radiusMiles / 69) * 2 * (mapViewHeight / CIRCLE_SIZE)
  const animateMapToRadius = useCallback(
    (lat: number, lng: number, miles: number, currentMapHeight: number) => {
      if (!mapRef.current) return;
      const heightToUse = currentMapHeight > 0 ? currentMapHeight : MAP_HEIGHT_DEFAULT;
      const ratio = heightToUse / CIRCLE_SIZE;
      const delta = Math.max(0.005, (miles / 69) * 2 * ratio);
      const region: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
      isProgrammaticMoveRef.current = true;
      mapRef.current.animateToRegion(region, 600);
    },
    [],
  );

  useEffect(() => {
    if (!location) return;
    animateMapToRadius(
      location.coords.latitude,
      location.coords.longitude,
      radiusMiles,
      mapViewHeight,
    );
    // Only runs when location changes — radius-preset button taps call
    // animateMapToRadius directly to avoid circular updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Zoom ↔ Radius sync: when user pinch-zooms, update radius ──────────────
  // Inverse formula: visibleRadiusMiles = (latitudeDelta * 69 / 2) * (CIRCLE_SIZE / mapViewHeight)
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      // Skip events we triggered programmatically (re-center / radius animations)
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }
      // Debounce to avoid firing on every micro-movement
      if (regionDebounceRef.current) {
        clearTimeout(regionDebounceRef.current);
      }
      regionDebounceRef.current = setTimeout(() => {
        const heightToUse = mapViewHeight > 0 ? mapViewHeight : MAP_HEIGHT_DEFAULT;
        const ratio = CIRCLE_SIZE / heightToUse;
        // The circle covers a fraction of the map height; compute what radius that fraction represents
        const visibleRadiusMiles = (region.latitudeDelta / 2) * 69 * ratio;
        const rounded = Math.round(visibleRadiusMiles * 10) / 10;
        // Only update if the change is significant (>0.2 mi) to avoid jitter
        setRadiusMiles((prev) => {
          return Math.abs(rounded - prev) >= 0.2 ? rounded : prev;
        });
        // Re-center map on the pin so the fixed circle overlay always tracks the pin.
        // Preserves the current zoom level (keeps latitudeDelta/longitudeDelta from user's gesture).
        if (mapRef.current && location) {
          isProgrammaticMoveRef.current = true;
          mapRef.current.animateToRegion(
            {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: region.latitudeDelta,
              longitudeDelta: region.longitudeDelta,
            },
            400,
          );
        }
      }, REGION_DEBOUNCE_MS);
    },
    [mapViewHeight, location],
  );

  // ── Preset button taps: animate map to show that radius ──────────────────
  const handlePresetSelect = useCallback(
    (r: RadiusMiles) => {
      setRadiusMiles(r);
      if (location) {
        animateMapToRadius(
          location.coords.latitude,
          location.coords.longitude,
          r,
          mapViewHeight,
        );
      }
    },
    [location, animateMapToRadius, mapViewHeight],
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
    // Initial delta accounts for the circle/map ratio so circle shows ~5mi at startup
    latitudeDelta: Math.max(0.01, (radiusMiles / 69) * 2 * (MAP_HEIGHT_DEFAULT / CIRCLE_SIZE)),
    longitudeDelta: Math.max(0.01, (radiusMiles / 69) * 2 * (MAP_HEIGHT_DEFAULT / CIRCLE_SIZE)),
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
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setMapViewHeight(h);
        }}
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
        </MapView>

        {/* ── FIXED-PIXEL RADIUS CIRCLE OVERLAY ──
            Sits on top of the map, centered, never moves or resizes with zoom.
            pointerEvents="none" so it doesn't block map touch/pan/pinch events. */}
        <View
          style={styles.circleOverlayContainer}
          pointerEvents="none"
        >
          <View
            style={[
              styles.circleOverlay,
              {
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                borderColor: colors.primary,
                backgroundColor: colors.primary + '1A', // ~10% opacity fill
              },
            ]}
          />
          {/* Radius label centered below the circle */}
          <Text style={[styles.circleRadiusLabel, { color: colors.primary }]}>
            {radiusMiles < 10
              ? radiusMiles.toFixed(1)
              : Math.round(radiusMiles).toString()} mi
          </Text>
        </View>

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

  // Fixed-pixel radius circle overlay
  circleOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOverlay: {
    borderWidth: 2,
  },
  circleRadiusLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    // slight text shadow for legibility on varied map backgrounds
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

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
    zIndex: 10,
  },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    marginBottom: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    maxHeight: 220,
    marginTop: 2,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemText: {
    fontSize: 14,
    lineHeight: 19,
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
