import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
  or,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SwapRequest, SwapStatus } from '../models/types';
import { toDate } from '../utils/firestoreConverters';

const parseSwap = (id: string, data: Record<string, unknown>): SwapRequest => ({
  id,
  requesterId: data.requesterId as string,
  receiverId: data.receiverId as string,
  requesterDogIds: (data.requesterDogIds as string[]) ?? [],
  receiverDogIds: (data.receiverDogIds as string[]) ?? [],
  startDate: toDate(data.startDate as Parameters<typeof toDate>[0]),
  endDate: toDate(data.endDate as Parameters<typeof toDate>[0]),
  message: data.message as string | undefined,
  careDetails: data.careDetails as string | undefined,
  status: data.status as SwapStatus,
  conversationId: data.conversationId as string | undefined,
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
  updatedAt: toDate(data.updatedAt as Parameters<typeof toDate>[0]),
});

export const useSwaps = () => {
  const createSwap = async (
    data: Omit<SwapRequest, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'swapRequests'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  };

  const getSwapsByUser = async (userId: string): Promise<SwapRequest[]> => {
    const q = query(
      collection(db, 'swapRequests'),
      or(where('requesterId', '==', userId), where('receiverId', '==', userId))
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => parseSwap(d.id, d.data() as Record<string, unknown>));
  };

  const updateSwapStatus = async (id: string, status: SwapStatus): Promise<void> => {
    await updateDoc(doc(db, 'swapRequests', id), { status, updatedAt: serverTimestamp() });
  };

  return { createSwap, getSwapsByUser, updateSwapStatus };
};
