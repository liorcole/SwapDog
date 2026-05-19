import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.40;

// Preset radius options in miles
const RADIUS_OPTIONS = [1, 5, 10, 25] as const;
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'Discover'>;
};

// ─── Radius Selector ─────────────────────────────────────────────────────────

interface RadiusSelectorProps {
  selected: number;
  onSelect: (r: RadiusMiles) => void;
}

const RadiusSelector: React.FC<RadiusSelectorProps> = ({ selected, onSelect }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.radiusRow}>
      <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>Radius:</Text>
      {RADIUS_OPTIONS.map((r) => {
        const active = r === selected;
        return (
          <TouchableOpacity
            key={r}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(r);
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
    </View>
  );
};

// ─── User Row ────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: User;
  distanceMiles: number;
  dogCount: number;
  onPress: () => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, distanceMiles, dogCount, onPress }) => {
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
};

// ─── Location Override Modal ─────────────────────────────────────────────────

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
  const [text, setText] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleConfirm = async () => {
    if (!text.trim()) return;
    setResolving(true);
    try {
      const results = await Location.geocodeAsync(text.trim());
      if (results.length === 0) {
        Alert.alert('Not found', 'Could not find that location. Try a different city or address.');
        setResolving(false);
        return;
      }
      const { latitude, longitude } = results[0];
      onConfirm({ latitude, longitude }, text.trim());
      setText('');
    } catch {
      Alert.alert('Error', 'Could not geocode that location. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Change Location</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Enter a city, neighborhood, or address to search from a different location.
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="e.g. Brooklyn, NY"
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => { void handleConfirm(); }}
          />
          <TouchableOpacity
            style={[
              styles.modalBtn,
              { backgroundColor: !text.trim() ? colors.border : colors.primary },
            ]}
            onPress={() => { void handleConfirm(); }}
            disabled={resolving || !text.trim()}
          >
            {resolving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalBtnText}>Search This Location</Text>
            )}
          </TouchableOpacity>
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

  const [radiusMiles, setRadiusMiles] = useState<number>(5);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const mapRef = useRef<MapView>(null);

  // Radius in meters for the Circle overlay
  const radiusMeters = radiusMiles * 1609.34;

  // ── Fetch nearby users whenever location or radius changes ──────────────────
  const fetchNearby = useCallback(async () => {
    if (!location) return;
    setUsersLoading(true);
    try {
      // getUsersByLocation takes radius in km
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

  // ── Re-center map when location or radius changes ────────────────────────────
  useEffect(() => {
    if (!location || !mapRef.current) return;
    const delta = Math.max(0.02, radiusMiles / 50);
    const region: Region = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: delta * 2.5,
      longitudeDelta: delta * 2.5,
    };
    mapRef.current.animateToRegion(region, 600);
  }, [location, radiusMiles]);

  // ── Handle location override confirmed ──────────────────────────────────────
  const handleLocationConfirm = async (coords: GeoPoint, label: string) => {
    await setLocationOverride(coords, label);
    setLocationModalVisible(false);
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (locationLoading || !location) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ height: MAP_HEIGHT, margin: spacing.md }}>
          <ShimmerLoading height={MAP_HEIGHT} borderRadius={borderRadius.lg} />
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
    latitudeDelta: Math.max(0.05, (radiusMiles / 50) * 2.5),
    longitudeDelta: Math.max(0.05, (radiusMiles / 50) * 2.5),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── MAP ── */}
      <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {/* User's own position marker */}
          <Marker
            coordinate={location.coords}
            title={location.isOverride ? (location.label ?? 'Custom Location') : 'Your Location'}
            pinColor={colors.primary}
          />
          {/* Search radius circle overlay — translucent coral */}
          <Circle
            center={location.coords}
            radius={radiusMeters}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor="rgba(255, 107, 107, 0.15)"
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
      </View>

      {/* ── RADIUS SELECTOR ── */}
      <View
        style={[
          styles.radiusContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <RadiusSelector
          selected={radiusMiles}
          onSelect={(r) => setRadiusMiles(r)}
        />
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
          keyExtractor={(item) => item.user.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.textSecondary }]}>
              {nearbyUsers.length === 0
                ? 'No dog owners found in this area'
                : `${nearbyUsers.length} dog owner${nearbyUsers.length !== 1 ? 's' : ''} within ${radiusMiles} mi`}
            </Text>
          }
          ListEmptyComponent={
            <EmptyStateView
              emoji="🐕"
              title="No dog owners nearby"
              subtitle="Try expanding your radius or changing your location"
            />
          }
          renderItem={({ item }) => (
            <UserRow
              user={item.user}
              distanceMiles={item.distanceMiles}
              dogCount={item.dogCount}
              onPress={() => navigation.navigate('UserDetail', { userId: item.user.id })}
            />
          )}
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
    overflow: 'hidden',
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  map: { ...StyleSheet.absoluteFillObject },
  locationBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  locationBtnText: { fontSize: 13, fontWeight: '600' },

  // Radius selector
  radiusContainer: {
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  modalInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  modalBtn: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
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
