import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const conversationId = route.params?.conversationId ?? '';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { subscribeToMessages, sendMessage, markConversationRead } = useMessaging();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Hide the React Navigation header — we render our own in the component body
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Mark conversation as read when the user opens the chat
  useEffect(() => {
    if (user?.uid) {
      void markConversationRead(conversationId, user.uid);
    }
  }, [conversationId, user?.uid, markConversationRead]);

  useEffect(() => {
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs.reverse()); // inverted for FlatList inverted
    });
    return unsub;
  }, [conversationId]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const toSend = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage(conversationId, user.uid, toSend);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Cross-tab navigation: came from RequestsStack "I Can Help" flow.
      // Navigate to the ConversationsList screen in the MessagesTab.
      (navigation as any).getParent()?.navigate('MessagesTab', {
        screen: 'ConversationsList',
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Custom in-component header — always visible, always has back ── */}
      <View
        style={[
          styles.customHeader,
          {
            backgroundColor: colors.surface,
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backIcon, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Chat
        </Text>
        {/* right spacer to keep title centred */}
        <View style={styles.headerSpacer} />
      </View>

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
  // ── Custom header ──────────────────────────────────────────────────────────
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 50,
    paddingLeft: 4,
    paddingRight: 8,
  },
  backIcon: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { minWidth: 50 },
  // ── Chat body ──────────────────────────────────────────────────────────────
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
