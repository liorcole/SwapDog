import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { MessagesStackParamList } from '../../navigation/types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMessaging } from '../../hooks/useMessaging';
import { Message } from '../../models/types';
import { spacing, borderRadius } from '../../config/theme';
import MessageBubble from '../../components/common/MessageBubble';

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'Chat'>;
  route: RouteProp<MessagesStackParamList, 'Chat'>;
};

const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { subscribeToMessages, sendMessage, markConversationRead } = useMessaging();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Always show a chevron back arrow — whether coming from a post or the messages tab
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 30, color: colors.primary, lineHeight: 36 }}>‹</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.primary]);

  // Mark conversation as read when the user opens the chat
  useEffect(() => {
    if (user?.uid) {
      void markConversationRead(route.params.conversationId, user.uid);
    }
  }, [route.params.conversationId, user?.uid, markConversationRead]);

  useEffect(() => {
    const unsub = subscribeToMessages(route.params.conversationId, (msgs) => {
      setMessages(msgs.reverse()); // inverted for FlatList inverted
    });
    return unsub;
  }, [route.params.conversationId]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const toSend = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage(route.params.conversationId, user.uid, toSend);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        renderItem={({ item }) => (
          <MessageBubble text={item.text} isMe={item.senderId === user?.uid} createdAt={item.createdAt} />
        )}
        contentContainerStyle={styles.list}
      />
      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          accessibilityLabel="Message input"
          accessibilityRole="none"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityHint="Sends your message"
        >
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    marginRight: spacing.sm,
    fontSize: 15,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 16 },
});

export default ChatScreen;
