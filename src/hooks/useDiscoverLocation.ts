import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeoPoint } from '../models/types';

const STORAGE_KEY = '@swapdog:location_override';

export interface DiscoverLocation {
  coords: GeoPoint;
  isOverride: boolean;
  label?: string;
}

interface UseDiscoverLocationResult {
  location: DiscoverLocation | null;
  loading: boolean;
  error: string | null;
  setLocationOverride: (coords: GeoPoint, label?: string) => Promise<void>;
  clearLocationOverride: () => Promise<void>;
}

export function useDiscoverLocation(): UseDiscoverLocationResult {
  const [location, setLocation] = useState<DiscoverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCurrentLocation = useCallback(async (): Promise<GeoPoint | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      setError('Unable to get current location');
      return null;
    }
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check for a stored override first
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { coords: GeoPoint; label?: string };
        setLocation({ coords: parsed.coords, isOverride: true, label: parsed.label });
        setLoading(false);
        return;
      }
    } catch {
      // Ignore storage errors
    }
    // Fall back to GPS
    const gps = await loadCurrentLocation();
    if (gps) {
      setLocation({ coords: gps, isOverride: false });
    } else {
      // Ultimate fallback: San Francisco
      setLocation({ coords: { latitude: 37.7749, longitude: -122.4194 }, isOverride: false });
    }
    setLoading(false);
  }, [loadCurrentLocation]);

  useEffect(() => {
    void init();
  }, [init]);

  const setLocationOverride = useCallback(async (coords: GeoPoint, label?: string) => {
    const payload = JSON.stringify({ coords, label });
    await AsyncStorage.setItem(STORAGE_KEY, payload);
    setLocation({ coords, isOverride: true, label });
  }, []);

  const clearLocationOverride = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setLoading(true);
    const gps = await loadCurrentLocation();
    setLocation(
      gps
        ? { coords: gps, isOverride: false }
        : { coords: { latitude: 37.7749, longitude: -122.4194 }, isOverride: false },
    );
    setLoading(false);
  }, [loadCurrentLocation]);

  return { location, loading, error, setLocationOverride, clearLocationOverride };
}
