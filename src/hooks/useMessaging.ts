import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  or,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Message, Conversation } from '../models/types';
import { toDate } from '../utils/firestoreConverters';

const parseMessage = (id: string, data: Record<string, unknown>): Message => ({
  id,
  conversationId: data.conversationId as string,
  senderId: data.senderId as string,
  text: data.text as string,
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
  read: (data.read as boolean) ?? false,
});

const parseConversation = (id: string, data: Record<string, unknown>): Conversation => ({
  id,
  participantIds: (data.participantIds as string[]) ?? [],
  swapRequestId: data.swapRequestId as string | undefined,
  lastMessage: data.lastMessage as string | undefined,
  lastMessageAt: data.lastMessageAt ? toDate(data.lastMessageAt as Parameters<typeof toDate>[0]) : undefined,
  unreadCounts: (data.unreadCounts as Record<string, number>) ?? {},
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
  updatedAt: toDate(data.updatedAt as Parameters<typeof toDate>[0]),
});

export const useMessaging = () => {
  const sendMessage = async (
    convId: string,
    senderId: string,
    text: string
  ): Promise<void> => {
    // Add the message
    await addDoc(collection(db, 'conversations', convId, 'messages'), {
      conversationId: convId,
      senderId,
      text,
      read: false,
      createdAt: serverTimestamp(),
    });
    // Update conversation metadata
    await updateDoc(doc(db, 'conversations', convId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const subscribeToMessages = (
    convId: string,
    cb: (messages: Message[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) =>
        parseMessage(d.id, d.data() as Record<string, unknown>)
      );
      cb(msgs);
    });
  };

  const getConversations = async (userId: string): Promise<Conversation[]> => {
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => parseConversation(d.id, d.data() as Record<string, unknown>));
  };

  const subscribeToConversations = (
    userId: string,
    cb: (conversations: Conversation[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const convs = snap.docs.map((d) =>
        parseConversation(d.id, d.data() as Record<string, unknown>)
      );
      cb(convs);
    });
  };

  /**
   * Find an existing conversation between two users, or create a new one.
   * Optionally links it to a swapRequestId.
   */
  const getOrCreateConversation = async (
    userIdA: string,
    userIdB: string,
    swapRequestId?: string
  ): Promise<string> => {
    // Look for an existing conversation between these two participants
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userIdA)
    );
    const snap = await getDocs(q);
    const existing = snap.docs.find((d) => {
      const participants = (d.data().participantIds as string[]) ?? [];
      return participants.includes(userIdB);
    });
    if (existing) return existing.id;

    // Create a new conversation
    const ref = await addDoc(collection(db, 'conversations'), {
      participantIds: [userIdA, userIdB],
      swapRequestId: swapRequestId ?? null,
      unreadCounts: { [userIdA]: 0, [userIdB]: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  };

  return {
    sendMessage,
    subscribeToMessages,
    getConversations,
    subscribeToConversations,
    getOrCreateConversation,
  };
};
