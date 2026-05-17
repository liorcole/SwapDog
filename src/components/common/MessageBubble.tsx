import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../config/theme';

interface Props {
  text: string;
  isMe: boolean;
  createdAt: Date;
}

const MessageBubble: React.FC<Props> = ({ text, isMe, createdAt }) => {
  const { colors } = useTheme();
  const timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.container, isMe ? styles.meContainer : styles.themContainer]}>
      <View
        style={[
          styles.bubble,
          isMe ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface },
        ]}
        accessibilityRole="none"
      >
        <Text
          style={[styles.text, { color: isMe ? '#fff' : colors.text }]}
          accessibilityLabel={`${isMe ? 'You' : 'Them'}: ${text}`}
        >
          {text}
        </Text>
        <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
          {timeStr}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 2, paddingHorizontal: spacing.sm },
  meContainer: { alignItems: 'flex-end' },
  themContainer: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  text: { fontSize: 15 },
  time: { fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
});

export default MessageBubble;
