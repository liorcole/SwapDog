import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  rating: number;
  maxRating?: number;
  onRate?: (rating: number) => void;
  size?: number;
}

const StarRating: React.FC<Props> = ({ rating, maxRating = 5, onRate, size = 24 }) => {
  const handlePress = (star: number) => {
    if (onRate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRate(star);
    }
  };

  return (
    <View style={styles.container} accessibilityRole="adjustable" accessibilityLabel={`Rating: ${rating} of ${maxRating} stars`}>
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          disabled={!onRate}
          accessibilityLabel={`${star} star${star !== 1 ? 's' : ''}`}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: size }}>{star <= rating ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
});

export default StarRating;
