import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Review } from '../models/types';
import { toDate } from '../utils/firestoreConverters';

const parseReview = (id: string, data: Record<string, unknown>): Review => ({
  id,
  reviewerId: data.reviewerId as string,
  revieweeId: data.revieweeId as string,
  swapRequestId: data.swapRequestId as string,
  rating: data.rating as number,
  comment: data.comment as string | undefined,
  createdAt: toDate(data.createdAt as Parameters<typeof toDate>[0]),
});

export const useReviews = () => {
  const createReview = async (
    data: Omit<Review, 'id' | 'createdAt'>
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'reviews'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const getReviewsForUser = async (userId: string): Promise<Review[]> => {
    const q = query(collection(db, 'reviews'), where('revieweeId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => parseReview(d.id, d.data() as Record<string, unknown>));
  };

  return { createReview, getReviewsForUser };
};
