import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { MessagesStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMessaging } from '../../hooks/useMessaging';
import { Conversation } from '../../models/types';
import { spacing, borderRadius, shadow } from '../../config/theme';
import EmptyStateView from '../../components/common/EmptyStateView';

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'ConversationsList'>;
};

const SYSTEM_SENDER_ID = 'swapdog-team';

const getOtherParticipantLabel = (participantIds: string[], myUid: string): string => {
  const otherId = participantIds.find((id) => id !== myUid) ?? '';
  if (otherId === SYSTEM_SENDER_ID) return '🐾 SwapDog Team';
  return otherId; // fallback; real app would resolve display name
};

const ConversationsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { subscribeToConversations } = useMessaging();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, setConversations);
    return unsub;
  }, [user]);

  const renderItem = ({ item }: { item: Conversation }) => {
    const otherId = item.participantIds.find((id) => id !== user?.uid) ?? '';
    const otherLabel = getOtherParticipantLabel(item.participantIds, user?.uid ?? '');
    const unread = item.unreadCounts[user?.uid ?? ''] ?? 0;

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: colors.surface, ...shadow.sm }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('Chat', { conversationId: item.id, otherUserId: otherId });
        }}
        accessibilityLabel={`Conversation with ${otherLabel}, last message: ${item.lastMessage ?? 'No messages yet'}`}
        accessibilityRole="button"
        accessibilityHint="Opens this conversation"
      >
        <View style={styles.info}>
          <Text style={[styles.otherName, { color: colors.primary }]} numberOfLines={1}>
            {otherLabel}
          </Text>
          <Text style={[styles.preview, { color: colors.text }]} numberOfLines={1}>
            {item.lastMessage ?? 'No messages yet'}
          </Text>
          {item.lastMessageAt && (
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {item.lastMessageAt.toLocaleDateString()}
            </Text>
          )}
        </View>
        {unread > 0 && (
          <View
            style={[styles.dot, { backgroundColor: '#FF2D55' }]}
            accessibilityLabel="Unread message"
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<EmptyStateView emoji="💬" title="No conversations yet" subtitle="Start by requesting a swap" />}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  info: { flex: 1 },
  otherName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  preview: { fontSize: 15 },
  time: { fontSize: 12, marginTop: 2 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: spacing.sm,
  },
});

export default ConversationsListScreen;
