import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  height?: number;
  width?: string | number;
  borderRadius?: number;
  style?: ViewStyle;
}

const ShimmerLoading: React.FC<Props> = ({ height = 60, width = '100%', borderRadius = 8, style }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ height, width: width as number, borderRadius, backgroundColor: colors.border, opacity }, style]}
      accessibilityElementsHidden
    />
  );
};

export default ShimmerLoading;
