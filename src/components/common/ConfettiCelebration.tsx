import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Animated, Dimensions, StyleSheet, TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');
const CONFETTI_COUNT = 60;
const COLORS = ['#FF2D55', '#FFD700', '#00B894', '#0984E3', '#6C5CE7', '#FF6B6B', '#FDCB6E', '#55E6C1', '#FF9FF3', '#48DBFB'];
const SHAPES = ['\u25A0', '\u25CF', '\u25B2', '\u2605', '\u2666', '\U0001F389', '\U0001F436', '\U0001F38A'];

interface Piece {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  shape: string;
  size: number;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  emoji?: string;
}

const ConfettiCelebration: React.FC<Props> = ({ visible, onDismiss, title, subtitle, emoji = '\U0001F389' }) => {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: new Animated.Value(Math.random() * W),
      y: new Animated.Value(-50 - Math.random() * 200),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 10 + Math.random() * 14,
    }))
  );
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Animate background
    Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Animate card
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();

    // Animate confetti pieces
    const anims = pieces.map((p) => {
      p.y.setValue(-50 - Math.random() * 200);
      p.x.setValue(Math.random() * W);
      p.rotate.setValue(0);
      p.opacity.setValue(1);

      const duration = 2000 + Math.random() * 1500;
      const drift = (Math.random() - 0.5) * 150;
      return Animated.parallel([
        Animated.timing(p.y, { toValue: H + 50, duration, useNativeDriver: true }),
        Animated.timing(p.x, { toValue: Math.random() * W + drift, duration, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 3 + Math.random() * 5, duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(duration * 0.7),
          Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.stagger(30, anims).start();

    // Auto-dismiss after 4s
    const timer = setTimeout(() => {
      handleDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleDismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: bgOpacity }]} />

        {/* Confetti */}
        {pieces.map((p, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.confettiPiece,
              {
                fontSize: p.size,
                color: p.color,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            {p.shape}
          </Animated.Text>
        ))}

        {/* Card */}
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  confettiPiece: { position: 'absolute' },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    maxWidth: W * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  cardEmoji: { fontSize: 56, marginBottom: 12 },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  cardSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
});

export default ConfettiCelebration;
