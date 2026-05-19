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
import {
  SwapRequest,
  SwapStatus,
  PaymentType,
  SitterPreference,
  SwapPost,
  PostStatus,
} from '../models/types';
import { toDate } from '../utils/firestoreConverters';

// ─── Legacy SwapRequest parser ────────────────────────────────────────────────
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
  pointsCost: (data.pointsCost as number) ?? 1,
  paymentOffered: data.paymentOffered as number | undefined,
  paymentType: ((data.paymentType as PaymentType) ?? 'points'),
  sitterPreference: data.sitterPreference as SitterPreference | undefined,
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
  updatedAt: toDate(data.updatedAt as Parameters<typeof toDate>[0]),
});

// ─── SwapPost parser ──────────────────────────────────────────────────────────
const parsePost = (id: string, data: Record<string, unknown>): SwapPost => ({
  id,
  posterId: data.posterId as string,
  posterName: data.posterName as string,
  posterPhotoURL: data.posterPhotoURL as string | undefined,
  posterLocation: data.posterLocation as { latitude: number; longitude: number } | undefined,
  dogId: data.dogId as string,
  dogName: data.dogName as string,
  dogBreed: data.dogBreed as string | undefined,
  dogPhotoURL: data.dogPhotoURL as string | undefined,
  startDate: toDate(data.startDate as Parameters<typeof toDate>[0]),
  endDate: toDate(data.endDate as Parameters<typeof toDate>[0]),
  careDetails: data.careDetails as string,
  compensationType: (data.compensationType as SwapPost['compensationType']) ?? 'points',
  pointsCost: (data.pointsCost as number) ?? 1,
  paymentAmount: data.paymentAmount as number | undefined,
  paymentRate: data.paymentRate as SwapPost['paymentRate'],
  totalPayment: data.totalPayment as number | undefined,
  totalUnits: data.totalUnits as number | undefined,
  status: (data.status as PostStatus) ?? 'open',
  claimedBy: data.claimedBy as string | undefined,
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
  updatedAt: toDate(data.updatedAt as Parameters<typeof toDate>[0]),
});

// ─── Distance helper (Haversine) ──────────────────────────────────────────────
export function distanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const useSwaps = () => {
  // ── Legacy SwapRequest ops (kept for old records) ─────────────────────────
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

  const updateSwapSitterPreference = async (
    id: string,
    sitterPreference: SitterPreference,
    status: SwapStatus
  ): Promise<void> => {
    await updateDoc(doc(db, 'swapRequests', id), {
      sitterPreference,
      status,
      updatedAt: serverTimestamp(),
    });
  };

  // ── NEW: Public post ops ──────────────────────────────────────────────────

  /** Create a new public post visible to everyone in the poster's area */
  const createPost = async (
    data: Omit<SwapPost, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    // Firestore rejects undefined field values — strip them before writing
    const cleanData = Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(([, v]) => v !== undefined)
    );
    const ref = await addDoc(collection(db, 'swapPosts'), {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  };

  /** Fetch all open posts, optionally filtered by distance */
  const getAreaPosts = async (
    location?: { latitude: number; longitude: number },
    radiusMiles = 25
  ): Promise<SwapPost[]> => {
    const q = query(
      collection(db, 'swapPosts'),
      where('status', '==', 'open')
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => parsePost(d.id, d.data() as Record<string, unknown>));

    if (!location) return all;

    return all.filter((p) => {
      if (!p.posterLocation) return true; // include posts without location
      return (
        distanceMiles(
          location.latitude, location.longitude,
          p.posterLocation.latitude, p.posterLocation.longitude
        ) <= radiusMiles
      );
    });
  };

  /** Fetch all posts by a specific user (for "My Posts" section) */
  const getMyPosts = async (userId: string): Promise<SwapPost[]> => {
    const q = query(
      collection(db, 'swapPosts'),
      where('posterId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => parsePost(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  /** Mark a post as claimed by a sitter */
  const claimPost = async (postId: string, sitterId: string): Promise<void> => {
    await updateDoc(doc(db, 'swapPosts', postId), {
      status: 'claimed' as PostStatus,
      claimedBy: sitterId,
      updatedAt: serverTimestamp(),
    });
  };

  /** Cancel a post (poster only) */
  const cancelPost = async (postId: string): Promise<void> => {
    await updateDoc(doc(db, 'swapPosts', postId), {
      status: 'cancelled' as PostStatus,
      updatedAt: serverTimestamp(),
    });
  };

  return {
    // Legacy
    createSwap,
    getSwapsByUser,
    updateSwapStatus,
    updateSwapSitterPreference,
    // New posts
    createPost,
    getAreaPosts,
    getMyPosts,
    claimPost,
    cancelPost,
  };
};
